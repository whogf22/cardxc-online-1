import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query, queryOne, transaction } from '../db/pool';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { apiLimiter, sensitiveOpLimiter, financialOpLimiter } from '../middleware/rateLimit';
import { createAuditLog } from '../services/auditService';
import { runFraudChecks } from '../services/fraudService';
import { logger } from '../middleware/logger';
import * as fluzApi from '../services/fluzApi';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);
router.use(apiLimiter);

router.get('/profile', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = await queryOne(`
    SELECT id, email, full_name, phone, country, role, kyc_status, account_status, 
           two_factor_enabled, created_at, updated_at
    FROM users WHERE id = $1
  `, [req.user!.id]);

  res.json({ success: true, data: { user } });
}));

router.put('/profile',
  body('fullName').optional().trim().isLength({ min: 2 }),
  body('phone').optional().trim(),
  body('country').optional().trim(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const { fullName, phone, country } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (fullName) {
      updates.push(`full_name = $${paramIndex++}`);
      values.push(fullName);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone);
    }
    if (country !== undefined) {
      updates.push(`country = $${paramIndex++}`);
      values.push(country);
    }

    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      values.push(req.user!.id);

      await query(`
        UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
      `, values);

      await createAuditLog({
        userId: req.user!.id,
        action: 'PROFILE_UPDATED',
        entityType: 'user',
        entityId: req.user!.id,
        newValues: { fullName, phone, country },
      });
    }

    res.json({ success: true, message: 'Profile updated' });
  })
);

router.get('/wallets', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const wallets = await query(`
    SELECT currency, balance_cents, reserved_cents, COALESCE(usdt_balance_cents, 0) as usdt_balance_cents, created_at
    FROM wallets WHERE user_id = $1
  `, [req.user!.id]);

  const formatted = wallets.map(w => ({
    currency: w.currency,
    balance: Number(w.balance_cents) / 100,
    balanceCents: Number(w.balance_cents),
    reserved: Number(w.reserved_cents) / 100,
    reservedCents: Number(w.reserved_cents),
    available: (Number(w.balance_cents) - Number(w.reserved_cents)) / 100,
    usdtBalance: Number(w.usdt_balance_cents) / 100,
    usdtBalanceCents: Number(w.usdt_balance_cents),
  }));

  const usdWallet = wallets.find(w => w.currency === 'USD');
  const totalUsdBalance = usdWallet ? Number(usdWallet.balance_cents) / 100 : 0;
  const totalUsdtBalance = usdWallet ? Number(usdWallet.usdt_balance_cents) / 100 : 0;

  let fluzBalance: any = null;
  if (fluzApi.isConfigured()) {
    try {
      const fluzWallet = await fluzApi.getWallet();
      fluzBalance = {
        cashBalance: fluzWallet.balances.cashBalance.available,
        rewardsBalance: fluzWallet.balances.rewardsBalance.available,
        giftCardBalance: fluzWallet.balances.giftCardCashBalance.available,
        totalAvailable: fluzWallet.balances.cashBalance.available + fluzWallet.balances.rewardsBalance.available,
      };
    } catch (err: any) {
      logger.error('Failed to fetch Fluz balance', { error: err?.message });
      fluzBalance = { error: 'Failed to fetch Fluz balance' };
    }
  }

  res.json({
    success: true,
    data: {
      wallets: formatted,
      usdBalance: totalUsdBalance,
      usdtBalance: totalUsdtBalance,
      fluzBalance,
      fluzConfigured: fluzApi.isConfigured(),
    }
  });
}));

const MAX_PAGE_SIZE = 100;
const MAX_OFFSET = 10000;
const safeLimit = (v: unknown) => Math.min(MAX_PAGE_SIZE, Math.max(1, Number(v) || 50));
const safeOffset = (v: unknown) => Math.max(0, Math.min(MAX_OFFSET, Number(v) || 0));

router.get('/transactions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const limit = safeLimit(req.query.limit);
  const offset = safeOffset(req.query.offset);
  const type = req.query.type as string;

  let whereClause = 'user_id = $1';
  const params: any[] = [req.user!.id];

  if (type && ['deposit', 'withdrawal', 'transfer_in', 'transfer_out'].includes(type)) {
    whereClause += ' AND type = $2';
    params.push(type);
  }

  const transactions = await query(`
    SELECT id, type, status, amount_cents, currency, reference, description, created_at
    FROM transactions 
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, offset]);

  const formatted = transactions.map(t => ({
    ...t,
    amount: Number(t.amount_cents) / 100,
    amountCents: Number(t.amount_cents),
  }));

  res.json({ success: true, data: { transactions: formatted } });
}));

router.post('/withdraw',
  financialOpLimiter,
  body('amount').isFloat({ min: 1 }),
  body('currency').isIn(['USD', 'EUR', 'GBP', 'NGN']),
  body('walletType').optional().isIn(['fiat', 'usdt']).withMessage('Wallet type must be fiat or usdt'),
  body('bankName').trim().notEmpty(),
  body('accountNumber').trim().notEmpty(),
  body('accountName').trim().notEmpty(),
  body('idempotencyKey').optional().isUUID(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const { amount, currency, walletType = 'fiat', bankName, accountNumber, accountName, idempotencyKey } = req.body;
    const amountCents = Math.round(amount * 100);
    const key = idempotencyKey || uuidv4();

    const existing = await queryOne(`
      SELECT id FROM withdrawal_requests WHERE user_id = $1 AND amount_cents = $2 AND created_at > NOW() - INTERVAL '1 hour'
    `, [req.user!.id, amountCents]);

    if (existing) {
      throw new AppError('Duplicate withdrawal request detected', 409, 'DUPLICATE_REQUEST');
    }

    const fraudCheck = await runFraudChecks({
      userId: req.user!.id,
      action: 'WITHDRAWAL',
      amount: amountCents,
    });

    // Check balance based on wallet type
    const wallet = await queryOne<any>(`
      SELECT balance_cents, reserved_cents, usdt_balance_cents FROM wallets WHERE user_id = $1 AND currency = $2
    `, [req.user!.id, currency]);

    if (!wallet) {
      throw new AppError('Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    let available: number;
    if (walletType === 'usdt') {
      available = Number(wallet.usdt_balance_cents || 0);
      if (available < amountCents) {
        throw new AppError('Insufficient USDT balance', 400, 'INSUFFICIENT_USDT_BALANCE');
      }
    } else {
      available = Number(wallet.balance_cents) - Number(wallet.reserved_cents);
      if (available < amountCents) {
        throw new AppError('Insufficient balance', 400, 'INSUFFICIENT_BALANCE');
      }
    }

    const result = await transaction(async (client) => {
      // Reserve balance based on wallet type
      if (walletType === 'usdt') {
        // For USDT, we deduct immediately (no reserved_cents for USDT)
        await client.query(`
          UPDATE wallets SET usdt_balance_cents = usdt_balance_cents - $1 WHERE user_id = $2 AND currency = $3
        `, [amountCents, req.user!.id, currency]);
      } else {
        await client.query(`
          UPDATE wallets SET reserved_cents = reserved_cents + $1 WHERE user_id = $2 AND currency = $3
        `, [amountCents, req.user!.id, currency]);
      }

      const withdrawalResult = await client.query(`
        INSERT INTO withdrawal_requests (user_id, amount_cents, currency, bank_name, account_number, account_name)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [req.user!.id, amountCents, currency, bankName, accountNumber, accountName]);

      await client.query(`
        INSERT INTO transactions (user_id, idempotency_key, type, status, amount_cents, currency, reference, description)
        VALUES ($1, $2, 'withdrawal', 'PENDING', $3, $4, $5, $6)
      `, [req.user!.id, key, amountCents, currency, withdrawalResult.rows[0].id, `Withdrawal to ${bankName}`]);

      return withdrawalResult.rows[0];
    });

    await createAuditLog({
      userId: req.user!.id,
      action: 'WITHDRAWAL_REQUESTED',
      entityType: 'withdrawal',
      entityId: result.id,
      newValues: { amount: amountCents, currency, bankName },
    });

    res.status(201).json({
      success: true,
      data: {
        withdrawalId: result.id,
        status: 'pending',
        fraudFlags: fraudCheck.flags,
      }
    });
  })
);

router.get('/withdrawals', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const withdrawals = await query(`
    SELECT id, amount_cents, currency, bank_name, account_number, account_name, status, admin_notes, created_at, updated_at
    FROM withdrawal_requests 
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 50
  `, [req.user!.id]);

  const formatted = withdrawals.map(w => ({
    ...w,
    amount: Number(w.amount_cents) / 100,
  }));

  res.json({ success: true, data: { withdrawals: formatted } });
}));

router.get('/cards', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cards = await query(`
    SELECT id, card_name, last_four, card_type, balance_cents, spending_limit_cents, status, created_at
    FROM virtual_cards 
    WHERE user_id = $1
    ORDER BY created_at DESC
  `, [req.user!.id]);

  const formatted = cards.map(c => ({
    ...c,
    balance: Number(c.balance_cents) / 100,
    spendingLimit: c.spending_limit_cents ? Number(c.spending_limit_cents) / 100 : null,
  }));

  res.json({ success: true, data: { cards: formatted } });
}));

router.post('/cards',
  body('cardName').trim().isLength({ min: 1, max: 100 }),
  body('cardType').optional().isIn(['VISA', 'MASTERCARD']),
  body('spendingLimit').optional().isFloat({ min: 0 }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const { cardName, cardType, spendingLimit } = req.body;
    const lastFour = Math.floor(1000 + Math.random() * 9000).toString();
    const spendingLimitCents = spendingLimit ? Math.round(spendingLimit * 100) : null;

    const result = await queryOne(`
      INSERT INTO virtual_cards (user_id, card_name, last_four, card_type, spending_limit_cents)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, card_name, last_four, card_type, balance_cents, spending_limit_cents, status
    `, [req.user!.id, cardName, lastFour, cardType || 'VISA', spendingLimitCents]);

    await createAuditLog({
      userId: req.user!.id,
      action: 'CARD_CREATED',
      entityType: 'card',
      entityId: result!.id,
      newValues: { cardName, cardType },
    });

    res.status(201).json({ success: true, data: { card: result } });
  })
);

export { router as userRouter };
