import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query, queryOne, transaction } from '../db/pool';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest, requireAdmin } from '../middleware/auth';
import { sensitiveOpLimiter, financialOpLimiter } from '../middleware/rateLimit';
import { createAuditLog } from '../services/auditService';
import { runFraudChecks } from '../services/fraudService';
import { v4 as uuidv4 } from 'uuid';
import {
  getUnifiedHistory,
  decodeCursor,
  VALID_TYPES,
  VALID_STATUSES,
  type HistoryFilters,
} from '../services/transactionHistoryService';

const router = Router();
router.use(authenticate);

const MAX_PAGE_SIZE = 100;
const MAX_OFFSET = 10000;
const safeLimit = (v: unknown) => Math.min(MAX_PAGE_SIZE, Math.max(1, Number(v) || 50));
const safeOffset = (v: unknown) => Math.max(0, Math.min(MAX_OFFSET, Number(v) || 0));

// ── Unified transaction history (cursor-based) ───────────────

router.get('/history', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { cursor: rawCursor, limit: rawLimit, type, status, fromDate, toDate } = req.query;

  // Validate type
  if (type && !VALID_TYPES.includes(type as any)) {
    throw new AppError(
      `Invalid type. Allowed: ${VALID_TYPES.join(', ')}`,
      400,
      'VALIDATION_ERROR',
    );
  }

  // Validate status
  if (status && !VALID_STATUSES.includes((status as string).toUpperCase() as any)) {
    throw new AppError(
      `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}`,
      400,
      'VALIDATION_ERROR',
    );
  }

  // Validate dates
  if (fromDate && isNaN(Date.parse(fromDate as string))) {
    throw new AppError('Invalid fromDate (ISO 8601 expected)', 400, 'VALIDATION_ERROR');
  }
  if (toDate && isNaN(Date.parse(toDate as string))) {
    throw new AppError('Invalid toDate (ISO 8601 expected)', 400, 'VALIDATION_ERROR');
  }

  // Decode cursor
  let cursor = null;
  if (rawCursor) {
    cursor = decodeCursor(rawCursor as string);
    if (!cursor) {
      throw new AppError('Invalid cursor', 400, 'VALIDATION_ERROR');
    }
  }

  const filters: HistoryFilters = {
    type: type as string | undefined,
    status: status as string | undefined,
    fromDate: fromDate as string | undefined,
    toDate: toDate as string | undefined,
  };

  const limit = Math.min(100, Math.max(1, Number(rawLimit) || 20));

  const result = await getUnifiedHistory(req.user!.id, filters, cursor, limit);

  res.json({ success: true, data: result });
}));

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { limit = 50, offset = 0, type, status } = req.query;
  const limitNum = safeLimit(limit);
  const offsetNum = safeOffset(offset);

  let whereClause = 'WHERE user_id = $1';
  const params: any[] = [req.user!.id];
  let paramIndex = 2;

  if (type) {
    whereClause += ` AND type = $${paramIndex++}`;
    params.push(type);
  }

  if (status) {
    whereClause += ` AND status = $${paramIndex++}`;
    params.push(status);
  }

  const transactions = await query(`
    SELECT id, type, status, amount_cents, currency, reference, description, merchant_name, merchant_display_name, created_at, updated_at
    FROM transactions
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `, [...params, limitNum, offsetNum]);

  const countResult = await queryOne<{ count: string }>(`
    SELECT COUNT(*) as count FROM transactions ${whereClause}
  `, params);

  res.json({
    success: true,
    data: {
      transactions: transactions.map(tx => ({
        ...tx,
        amount: Number(tx.amount_cents) / 100,
        merchantDisplayName: tx.merchant_display_name || tx.merchant_name || null,
      })),
      total: parseInt(countResult?.count || '0'),
      limit: limitNum,
      offset: offsetNum,
    }
  });
}));

router.post('/deposit',
  requireAdmin,
  financialOpLimiter,
  body('amount').isFloat({ min: 1, max: 100000 }).withMessage('Deposit amount must be between $1 and $100,000'),
  body('currency').isIn(['USD', 'EUR', 'GBP', 'NGN']),
  body('idempotencyKey').optional().isUUID(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const { amount, currency, idempotencyKey } = req.body;
    const amountCents = Math.round(amount * 100);
    const key = idempotencyKey || uuidv4();

    const existingTx = await queryOne(`
      SELECT id, status FROM transactions WHERE idempotency_key = $1
    `, [key]);

    if (existingTx) {
      return res.json({
        success: true,
        data: {
          transactionId: existingTx.id,
          status: existingTx.status,
          message: 'Duplicate request - returning existing transaction',
        }
      });
    }

    const result = await transaction(async (client) => {
      const txResult = await client.query(`
        INSERT INTO transactions (user_id, idempotency_key, type, status, amount_cents, currency, description)
        VALUES ($1, $2, 'deposit', 'PENDING', $3, $4, $5)
        RETURNING id
      `, [req.user!.id, key, amountCents, currency, 'Payment Account Deposit']);

      const txId = txResult.rows[0].id;

      await client.query(`
        INSERT INTO wallets (user_id, currency, balance_cents)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, currency) 
        DO UPDATE SET balance_cents = wallets.balance_cents + $3, updated_at = NOW()
      `, [req.user!.id, currency, amountCents]);

      await client.query(`
        UPDATE transactions SET status = 'SUCCESS', updated_at = NOW() WHERE id = $1
      `, [txId]);

      return txId;
    });

    await createAuditLog({
      userId: req.user!.id,
      action: 'DEPOSIT_COMPLETED',
      entityType: 'transaction',
      entityId: result,
      newValues: { amount: amountCents, currency },
    });

    res.status(201).json({
      success: true,
      data: {
        transactionId: result,
        status: 'SUCCESS',
      }
    });
  })
);

router.post('/transfer',
  sensitiveOpLimiter,
  body('recipientEmail').isEmail().normalizeEmail(),
  body('amount').isFloat({ min: 0.01, max: 50000 }).withMessage('Transfer amount must be between $0.01 and $50,000'),
  body('currency').isIn(['USD', 'EUR', 'GBP', 'NGN']),
  body('description').optional().trim().isLength({ max: 255 }),
  body('idempotencyKey').optional().isUUID(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const { recipientEmail, amount, currency, description, idempotencyKey } = req.body;
    const amountCents = Math.round(amount * 100);
    const key = idempotencyKey || uuidv4();

    if (recipientEmail === req.user!.email) {
      throw new AppError('Cannot transfer to yourself', 400, 'SELF_TRANSFER');
    }

    const existingTx = await queryOne(`
      SELECT id, status FROM transactions WHERE idempotency_key = $1
    `, [key]);

    if (existingTx) {
      return res.json({
        success: true,
        data: {
          transactionId: existingTx.id,
          status: existingTx.status,
          message: 'Duplicate request - returning existing transaction',
        }
      });
    }

    const recipient = await queryOne<any>('SELECT id FROM users WHERE email = $1', [recipientEmail]);
    if (!recipient) {
      throw new AppError('Recipient not found', 404, 'RECIPIENT_NOT_FOUND');
    }

    const fraudCheck = await runFraudChecks({
      userId: req.user!.id,
      action: 'TRANSFER',
      amount: amountCents,
    });

    if (fraudCheck.flags.includes('HIGH_VELOCITY_TRANSFERS')) {
      throw new AppError('Transfer temporarily blocked due to unusual activity', 429, 'FRAUD_BLOCKED');
    }

    const senderWallet = await queryOne<any>(`
      SELECT balance_cents, reserved_cents FROM wallets WHERE user_id = $1 AND currency = $2
    `, [req.user!.id, currency]);

    if (!senderWallet) {
      throw new AppError('Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const available = Number(senderWallet.balance_cents) - Number(senderWallet.reserved_cents);
    if (available < amountCents) {
      throw new AppError('Insufficient balance', 400, 'INSUFFICIENT_BALANCE');
    }

    const result = await transaction(async (client) => {
      const outgoingTx = await client.query(`
        INSERT INTO transactions (user_id, idempotency_key, type, status, amount_cents, currency, description)
        VALUES ($1, $2, 'transfer_out', 'PENDING', $3, $4, $5)
        RETURNING id
      `, [req.user!.id, key, amountCents, currency, description || `Transfer to ${recipientEmail}`]);

      const incomingTx = await client.query(`
        INSERT INTO transactions (user_id, type, status, amount_cents, currency, description, reference)
        VALUES ($1, 'transfer_in', 'PENDING', $2, $3, $4, $5)
        RETURNING id
      `, [recipient.id, amountCents, currency, `Transfer from ${req.user!.email}`, outgoingTx.rows[0].id]);

      await client.query(`
        UPDATE wallets SET balance_cents = balance_cents - $1, updated_at = NOW()
        WHERE user_id = $2 AND currency = $3
      `, [amountCents, req.user!.id, currency]);

      await client.query(`
        INSERT INTO wallets (user_id, currency, balance_cents)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, currency) 
        DO UPDATE SET balance_cents = wallets.balance_cents + $3, updated_at = NOW()
      `, [recipient.id, currency, amountCents]);

      await client.query(`
        UPDATE transactions SET status = 'SUCCESS', updated_at = NOW() 
        WHERE id IN ($1, $2)
      `, [outgoingTx.rows[0].id, incomingTx.rows[0].id]);

      return outgoingTx.rows[0].id;
    });

    await createAuditLog({
      userId: req.user!.id,
      action: 'TRANSFER_COMPLETED',
      entityType: 'transaction',
      entityId: result,
      newValues: { recipientEmail, amount: amountCents, currency },
    });

    res.status(201).json({
      success: true,
      data: {
        transactionId: result,
        status: 'SUCCESS',
        fraudFlags: fraudCheck.flags,
      }
    });
  })
);

router.get('/:transactionId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { transactionId } = req.params;

  const tx = await queryOne(`
    SELECT id, type, status, amount_cents, currency, reference, description, merchant_name, merchant_display_name, created_at, updated_at
    FROM transactions 
    WHERE id = $1 AND user_id = $2
  `, [transactionId, req.user!.id]);

  if (!tx) {
    throw new AppError('Transaction not found', 404, 'NOT_FOUND');
  }

  res.json({
    success: true,
    data: {
      transaction: {
        ...tx,
        amount: Number(tx.amount_cents) / 100,
        merchantDisplayName: tx.merchant_display_name || tx.merchant_name || null,
      }
    }
  });
}));

export { router as transactionRouter };
