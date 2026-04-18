import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query, queryOne, transaction } from '../db/pool';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { sensitiveOpLimiter, financialOpLimiter } from '../middleware/rateLimit';
import { createAuditLog } from '../services/auditService';
import { runFraudChecks } from '../services/fraudService';
import { v4 as uuidv4 } from 'uuid';
import { addDays, addHours } from 'date-fns';

const router = Router();
router.use(authenticate);

router.post('/p2p/transfer',
  financialOpLimiter,
  body('recipient').trim().notEmpty().isLength({ max: 255 }),
  body('recipientType').isIn(['email', 'phone', 'username']),
  body('amount').isFloat({ min: 0.01, max: 50000 }).withMessage('Transfer amount must be between $0.01 and $50,000'),
  body('currency').isIn(['USD', 'EUR', 'GBP', 'NGN']),
  body('note').optional().trim().isLength({ max: 255 }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const { recipient, recipientType, amount, currency, note } = req.body;
    const amountCents = Math.round(amount * 100);

    let recipientUser;
    if (recipientType === 'email') {
      recipientUser = await queryOne<any>('SELECT id, email, full_name FROM users WHERE email = $1', [recipient]);
    } else if (recipientType === 'phone') {
      recipientUser = await queryOne<any>('SELECT id, email, full_name FROM users WHERE phone = $1', [recipient]);
    } else {
      recipientUser = await queryOne<any>('SELECT id, email, full_name FROM users WHERE full_name ILIKE $1', [recipient]);
    }

    if (!recipientUser) {
      throw new AppError('Recipient not found', 404, 'RECIPIENT_NOT_FOUND');
    }

    if (recipientUser.id === req.user!.id) {
      throw new AppError('Cannot transfer to yourself', 400, 'SELF_TRANSFER');
    }

    const senderWallet = await queryOne<any>(`
      SELECT balance_cents, reserved_cents FROM wallets WHERE user_id = $1 AND currency = $2
    `, [req.user!.id, currency]);

    if (!senderWallet || Number(senderWallet.balance_cents) - Number(senderWallet.reserved_cents) < amountCents) {
      throw new AppError('Insufficient balance', 400, 'INSUFFICIENT_BALANCE');
    }

    const fraudCheck = await runFraudChecks({
      userId: req.user!.id,
      action: 'P2P_TRANSFER',
      amount: amountCents,
    });

    if (fraudCheck.flags.includes('HIGH_VELOCITY_TRANSFERS')) {
      throw new AppError('Transfer temporarily blocked due to unusual activity', 429, 'FRAUD_BLOCKED');
    }

    const txId = await transaction(async (client) => {
      const outgoingTx = await client.query(`
        INSERT INTO transactions (user_id, type, status, amount_cents, currency, description, metadata)
        VALUES ($1, 'transfer_out', 'SUCCESS', $2, $3, $4, $5)
        RETURNING id
      `, [req.user!.id, amountCents, currency, note || `P2P to ${recipientUser.full_name}`, JSON.stringify({ recipientId: recipientUser.id, type: 'p2p' })]);

      await client.query(`
        INSERT INTO transactions (user_id, type, status, amount_cents, currency, description, reference)
        VALUES ($1, 'transfer_in', 'SUCCESS', $2, $3, $4, $5)
      `, [recipientUser.id, amountCents, currency, `P2P from ${req.user!.email}`, outgoingTx.rows[0].id]);

      await client.query(`
        UPDATE wallets SET balance_cents = balance_cents - $1, updated_at = NOW()
        WHERE user_id = $2 AND currency = $3
      `, [amountCents, req.user!.id, currency]);

      await client.query(`
        INSERT INTO wallets (user_id, currency, balance_cents)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, currency) 
        DO UPDATE SET balance_cents = wallets.balance_cents + $3, updated_at = NOW()
      `, [recipientUser.id, currency, amountCents]);

      return outgoingTx.rows[0].id;
    });

    await createAuditLog({
      userId: req.user!.id,
      action: 'P2P_TRANSFER',
      entityType: 'transaction',
      entityId: txId,
      newValues: { recipientId: recipientUser.id, amount: amountCents, currency },
    });

    res.status(201).json({
      success: true,
      data: {
        transactionId: txId,
        recipient: recipientUser.full_name,
        amount,
        currency,
      },
    });
  })
);

router.post('/payment-links',
  body('amount').optional().isFloat({ min: 0.01, max: 100000 }).withMessage('Amount must be between $0.01 and $100,000'),
  body('currency').isIn(['USD', 'EUR', 'GBP', 'NGN']),
  body('description').optional().trim().isLength({ max: 255 }),
  body('expiresInHours').optional().isInt({ min: 1, max: 168 }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const { amount, currency, description, expiresInHours = 24 } = req.body;
    const amountCents = amount ? Math.round(amount * 100) : null;
    const code = uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase();
    const expiresAt = addHours(new Date(), expiresInHours);

    const result = await queryOne(`
      INSERT INTO payment_links (user_id, code, amount_cents, currency, description, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, code, amount_cents, currency, description, expires_at, created_at
    `, [req.user!.id, code, amountCents, currency, description, expiresAt]);

    res.status(201).json({
      success: true,
      data: {
        paymentLink: result,
        url: `${process.env.VITE_APP_DOMAIN || ''}/pay/${code}`,
      },
    });
  })
);

router.get('/payment-links', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const links = await query(`
    SELECT id, code, amount_cents, currency, description, status, expires_at, created_at
    FROM payment_links
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 50
  `, [req.user!.id]);

  res.json({ success: true, data: { paymentLinks: links } });
}));

router.get('/payment-links/:code/public', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { code } = req.params;

  const link = await queryOne(`
    SELECT pl.id, pl.amount_cents, pl.currency, pl.description, pl.status, pl.expires_at,
           u.full_name as recipient_name
    FROM payment_links pl
    JOIN users u ON u.id = pl.user_id
    WHERE pl.code = $1
  `, [code]);

  if (!link) {
    throw new AppError('Payment link not found', 404, 'NOT_FOUND');
  }

  res.json({ success: true, data: { paymentLink: link } });
}));

router.post('/payment-links/:code/pay',
  sensitiveOpLimiter,
  body('amount').optional().isFloat({ min: 0.01, max: 100000 }).withMessage('Amount must be between $0.01 and $100,000'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { code } = req.params;
    const { amount } = req.body;

    const link = await queryOne<any>(`
      SELECT id, user_id, amount_cents, currency, status, expires_at
      FROM payment_links WHERE code = $1
    `, [code]);

    if (!link) {
      throw new AppError('Payment link not found', 404, 'NOT_FOUND');
    }

    if (link.status !== 'active') {
      throw new AppError('Payment link is no longer active', 400, 'LINK_INACTIVE');
    }

    if (new Date(link.expires_at) < new Date()) {
      throw new AppError('Payment link has expired', 400, 'LINK_EXPIRED');
    }

    if (link.user_id === req.user!.id) {
      throw new AppError('Cannot pay your own link', 400, 'SELF_PAYMENT');
    }

    const amountCents = link.amount_cents || Math.round(amount * 100);
    if (!amountCents || amountCents <= 0) {
      throw new AppError('Amount is required', 400, 'AMOUNT_REQUIRED');
    }

    const senderWallet = await queryOne<any>(`
      SELECT balance_cents FROM wallets WHERE user_id = $1 AND currency = $2
    `, [req.user!.id, link.currency]);

    if (!senderWallet || Number(senderWallet.balance_cents) - Number(senderWallet.reserved_cents || 0) < amountCents) {
      throw new AppError('Insufficient balance', 400, 'INSUFFICIENT_BALANCE');
    }

    const txId = await transaction(async (client) => {
      const outgoingTx = await client.query(`
        INSERT INTO transactions (user_id, type, status, amount_cents, currency, description, metadata)
        VALUES ($1, 'transfer_out', 'SUCCESS', $2, $3, 'Payment link payment', $4)
        RETURNING id
      `, [req.user!.id, amountCents, link.currency, JSON.stringify({ paymentLinkId: link.id })]);

      await client.query(`
        INSERT INTO transactions (user_id, type, status, amount_cents, currency, description, reference)
        VALUES ($1, 'transfer_in', 'SUCCESS', $2, $3, 'Payment link received', $4)
      `, [link.user_id, amountCents, link.currency, outgoingTx.rows[0].id]);

      await client.query(`
        UPDATE wallets SET balance_cents = balance_cents - $1 WHERE user_id = $2 AND currency = $3
      `, [amountCents, req.user!.id, link.currency]);

      await client.query(`
        INSERT INTO wallets (user_id, currency, balance_cents)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, currency) DO UPDATE SET balance_cents = wallets.balance_cents + $3
      `, [link.user_id, link.currency, amountCents]);

      if (link.amount_cents) {
        await client.query(`UPDATE payment_links SET status = 'completed' WHERE id = $1`, [link.id]);
      }

      return outgoingTx.rows[0].id;
    });

    res.json({ success: true, data: { transactionId: txId, message: 'Payment successful' } });
  })
);

router.post('/qr/generate', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { amount, currency = 'USD' } = req.body;
  const amountCents = amount ? Math.round(amount * 100) : null;
  const code = uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase();
  const expiresAt = addHours(new Date(), 1);

  const result = await queryOne(`
    INSERT INTO qr_payment_intents (user_id, code, type, amount_cents, currency, expires_at)
    VALUES ($1, $2, 'receive', $3, $4, $5)
    RETURNING id, code, amount_cents, currency, expires_at
  `, [req.user!.id, code, amountCents, currency, expiresAt]);

  const qrData = JSON.stringify({
    type: 'cardxc_pay',
    code,
    amount: amount || null,
    currency,
    recipient: req.user!.email,
  });

  res.json({ success: true, data: { qrIntent: result, qrData } });
}));

router.post('/qr/:code/pay',
  sensitiveOpLimiter,
  body('amount').optional().isFloat({ min: 0.01 }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { code } = req.params;
    const { amount } = req.body;

    const qrIntent = await queryOne<any>(`
      SELECT id, user_id, amount_cents, currency, status, expires_at
      FROM qr_payment_intents WHERE code = $1
    `, [code]);

    if (!qrIntent) {
      throw new AppError('QR code not found', 404, 'NOT_FOUND');
    }

    if (qrIntent.status !== 'pending') {
      throw new AppError('QR code already used', 400, 'QR_USED');
    }

    if (new Date(qrIntent.expires_at) < new Date()) {
      throw new AppError('QR code has expired', 400, 'QR_EXPIRED');
    }

    if (qrIntent.user_id === req.user!.id) {
      throw new AppError('Cannot pay yourself', 400, 'SELF_PAYMENT');
    }

    const amountCents = qrIntent.amount_cents || Math.round(amount * 100);
    if (!amountCents || amountCents <= 0) {
      throw new AppError('Amount is required', 400, 'AMOUNT_REQUIRED');
    }

    const senderWallet = await queryOne<any>(`
      SELECT balance_cents FROM wallets WHERE user_id = $1 AND currency = $2
    `, [req.user!.id, qrIntent.currency]);

    if (!senderWallet || Number(senderWallet.balance_cents) - Number(senderWallet.reserved_cents || 0) < amountCents) {
      throw new AppError('Insufficient balance', 400, 'INSUFFICIENT_BALANCE');
    }

    const txId = await transaction(async (client) => {
      const outgoingTx = await client.query(`
        INSERT INTO transactions (user_id, type, status, amount_cents, currency, description)
        VALUES ($1, 'transfer_out', 'SUCCESS', $2, $3, 'QR payment')
        RETURNING id
      `, [req.user!.id, amountCents, qrIntent.currency]);

      await client.query(`
        INSERT INTO transactions (user_id, type, status, amount_cents, currency, description, reference)
        VALUES ($1, 'transfer_in', 'SUCCESS', $2, $3, 'QR payment received', $4)
      `, [qrIntent.user_id, amountCents, qrIntent.currency, outgoingTx.rows[0].id]);

      await client.query(`
        UPDATE wallets SET balance_cents = balance_cents - $1 WHERE user_id = $2 AND currency = $3
      `, [amountCents, req.user!.id, qrIntent.currency]);

      await client.query(`
        INSERT INTO wallets (user_id, currency, balance_cents)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, currency) DO UPDATE SET balance_cents = wallets.balance_cents + $3
      `, [qrIntent.user_id, qrIntent.currency, amountCents]);

      await client.query(`UPDATE qr_payment_intents SET status = 'completed' WHERE id = $1`, [qrIntent.id]);

      return outgoingTx.rows[0].id;
    });

    res.json({ success: true, data: { transactionId: txId, message: 'QR payment successful' } });
  })
);

router.get('/recurring', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const recurring = await query(`
    SELECT id, recipient_id, recipient_name, amount_cents, currency, frequency, next_run_at, status, created_at
    FROM recurring_transfers
    WHERE user_id = $1
    ORDER BY next_run_at ASC
  `, [req.user!.id]);

  res.json({ success: true, data: { recurringTransfers: recurring } });
}));

router.post('/recurring',
  body('recipientEmail').isEmail(),
  body('amount').isFloat({ min: 0.01 }),
  body('currency').isIn(['USD', 'EUR', 'GBP', 'NGN']),
  body('frequency').isIn(['daily', 'weekly', 'biweekly', 'monthly']),
  body('description').optional().trim().isLength({ max: 255 }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const { recipientEmail, amount, currency, frequency, description } = req.body;
    const amountCents = Math.round(amount * 100);

    const recipient = await queryOne<any>('SELECT id, full_name FROM users WHERE email = $1', [recipientEmail]);
    if (!recipient) {
      throw new AppError('Recipient not found', 404, 'RECIPIENT_NOT_FOUND');
    }

    let nextRunAt: Date;
    switch (frequency) {
      case 'daily': nextRunAt = addDays(new Date(), 1); break;
      case 'weekly': nextRunAt = addDays(new Date(), 7); break;
      case 'biweekly': nextRunAt = addDays(new Date(), 14); break;
      case 'monthly': nextRunAt = addDays(new Date(), 30); break;
      default: nextRunAt = addDays(new Date(), 30);
    }

    const result = await queryOne(`
      INSERT INTO recurring_transfers (user_id, recipient_id, recipient_name, amount_cents, currency, frequency, next_run_at, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, recipient_name, amount_cents, currency, frequency, next_run_at, status
    `, [req.user!.id, recipient.id, recipient.full_name, amountCents, currency, frequency, nextRunAt, description]);

    res.status(201).json({ success: true, data: { recurringTransfer: result } });
  })
);

router.delete('/recurring/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  await query(`
    UPDATE recurring_transfers SET status = 'cancelled' WHERE id = $1 AND user_id = $2
  `, [id, req.user!.id]);

  res.json({ success: true, message: 'Recurring transfer cancelled' });
}));

router.post('/split',
  body('title').trim().notEmpty().isLength({ max: 100 }),
  body('totalAmount').isFloat({ min: 0.01 }),
  body('currency').isIn(['USD', 'EUR', 'GBP', 'NGN']),
  body('participants').isArray({ min: 1, max: 10 }),
  body('participants.*.email').isEmail(),
  body('participants.*.amount').isFloat({ min: 0.01 }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const { title, totalAmount, currency, participants } = req.body;
    const totalCents = Math.round(totalAmount * 100);

    const splitId = await transaction(async (client) => {
      const splitResult = await client.query(`
        INSERT INTO split_bills (creator_id, title, total_cents, currency)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [req.user!.id, title, totalCents, currency]);

      const splitId = splitResult.rows[0].id;

      for (const participant of participants) {
        const userResult = await client.query('SELECT id, full_name FROM users WHERE email = $1', [participant.email]);
        const user = userResult.rows[0] || null;
        const amountCents = Math.round(participant.amount * 100);

        await client.query(`
          INSERT INTO split_participants (split_id, user_id, email, name, amount_cents)
          VALUES ($1, $2, $3, $4, $5)
        `, [splitId, user?.id || null, participant.email, user?.full_name || participant.email, amountCents]);
      }

      return splitId;
    });

    res.status(201).json({ success: true, data: { splitId, message: 'Bill split created' } });
  })
);

router.get('/splits', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const createdSplits = await query(`
    SELECT sb.id, sb.title, sb.total_cents, sb.currency, sb.status, sb.created_at,
           COUNT(sp.id) as participant_count,
           SUM(CASE WHEN sp.status = 'paid' THEN sp.amount_cents ELSE 0 END) as paid_cents
    FROM split_bills sb
    LEFT JOIN split_participants sp ON sp.split_id = sb.id
    WHERE sb.creator_id = $1
    GROUP BY sb.id
    ORDER BY sb.created_at DESC
  `, [req.user!.id]);

  const participatingSplits = await query(`
    SELECT sb.id, sb.title, sb.total_cents, sb.currency, sb.status, sb.created_at,
           sp.amount_cents as my_amount, sp.status as my_status,
           u.full_name as creator_name
    FROM split_participants sp
    JOIN split_bills sb ON sb.id = sp.split_id
    JOIN users u ON u.id = sb.creator_id
    WHERE sp.user_id = $1
    ORDER BY sb.created_at DESC
  `, [req.user!.id]);

  res.json({ success: true, data: { createdSplits, participatingSplits } });
}));

router.post('/splits/:id/pay',
  sensitiveOpLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const participant = await queryOne<any>(`
      SELECT sp.id, sp.amount_cents, sp.status, sb.creator_id, sb.currency
      FROM split_participants sp
      JOIN split_bills sb ON sb.id = sp.split_id
      WHERE sp.split_id = $1 AND sp.user_id = $2
    `, [id, req.user!.id]);

    if (!participant) {
      throw new AppError('Not a participant in this split', 404, 'NOT_FOUND');
    }

    if (participant.status === 'paid') {
      throw new AppError('Already paid', 400, 'ALREADY_PAID');
    }

    const wallet = await queryOne<any>(`
      SELECT balance_cents FROM wallets WHERE user_id = $1 AND currency = $2
    `, [req.user!.id, participant.currency]);

    if (!wallet || Number(wallet.balance_cents) < participant.amount_cents) {
      throw new AppError('Insufficient balance', 400, 'INSUFFICIENT_BALANCE');
    }

    await transaction(async (client) => {
      await client.query(`
        INSERT INTO transactions (user_id, type, status, amount_cents, currency, description)
        VALUES ($1, 'transfer_out', 'SUCCESS', $2, $3, 'Split bill payment')
      `, [req.user!.id, participant.amount_cents, participant.currency]);

      await client.query(`
        INSERT INTO transactions (user_id, type, status, amount_cents, currency, description)
        VALUES ($1, 'transfer_in', 'SUCCESS', $2, $3, 'Split bill received')
      `, [participant.creator_id, participant.amount_cents, participant.currency]);

      await client.query(`
        UPDATE wallets SET balance_cents = balance_cents - $1 WHERE user_id = $2 AND currency = $3
      `, [participant.amount_cents, req.user!.id, participant.currency]);

      await client.query(`
        INSERT INTO wallets (user_id, currency, balance_cents)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, currency) DO UPDATE SET balance_cents = wallets.balance_cents + $3
      `, [participant.creator_id, participant.currency, participant.amount_cents]);

      await client.query(`UPDATE split_participants SET status = 'paid', paid_at = NOW() WHERE id = $1`, [participant.id]);
    });

    res.json({ success: true, message: 'Split payment successful' });
  })
);

export { router as paymentsRouter };
