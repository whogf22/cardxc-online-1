import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query, queryOne, transaction } from '../db/pool';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { createAuditLog } from '../services/auditService';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cashbackSummary = await queryOne<any>(`
    SELECT 
      COALESCE(SUM(cashback_cents), 0) as total_earned,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN cashback_cents ELSE 0 END), 0) as pending,
      COALESCE(SUM(CASE WHEN status = 'credited' THEN cashback_cents ELSE 0 END), 0) as credited
    FROM reward_ledger
    WHERE user_id = $1
  `, [req.user!.id]);

  const referralCode = await queryOne(`
    SELECT code, total_referrals, total_earned_cents
    FROM referral_codes
    WHERE user_id = $1
  `, [req.user!.id]);

  const subscriptionCount = await queryOne<{ count: string }>(`
    SELECT COUNT(*) as count FROM subscriptions WHERE user_id = $1 AND status = 'active'
  `, [req.user!.id]);

  res.json({
    success: true,
    data: {
      cashback: {
        totalEarned: Number(cashbackSummary?.total_earned || 0) / 100,
        pending: Number(cashbackSummary?.pending || 0) / 100,
        credited: Number(cashbackSummary?.credited || 0) / 100,
      },
      referral: referralCode ? {
        code: referralCode.code,
        totalReferrals: referralCode.total_referrals,
        totalEarned: Number(referralCode.total_earned_cents || 0) / 100,
      } : null,
      activeSubscriptions: parseInt(subscriptionCount?.count || '0'),
    },
  });
}));

router.get('/cashback', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const summary = await queryOne<any>(`
    SELECT 
      SUM(cashback_cents) as total_earned,
      SUM(CASE WHEN status = 'pending' THEN cashback_cents ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'credited' THEN cashback_cents ELSE 0 END) as credited
    FROM reward_ledger
    WHERE user_id = $1
  `, [req.user!.id]);

  const recentRewards = await query(`
    SELECT id, transaction_id, cashback_cents, status, description, created_at
    FROM reward_ledger
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 20
  `, [req.user!.id]);

  res.json({
    success: true,
    data: {
      summary: {
        totalEarned: Number(summary?.total_earned || 0) / 100,
        pending: Number(summary?.pending || 0) / 100,
        credited: Number(summary?.credited || 0) / 100,
      },
      recentRewards,
    },
  });
}));

router.get('/referral', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  let referral = await queryOne(`
    SELECT id, code, total_referrals, total_earned_cents, created_at
    FROM referral_codes
    WHERE user_id = $1
  `, [req.user!.id]);

  if (!referral) {
    const code = `CARDXC${uuidv4().replace(/-/g, '').substring(0, 6).toUpperCase()}`;
    referral = await queryOne(`
      INSERT INTO referral_codes (user_id, code)
      VALUES ($1, $2)
      RETURNING id, code, total_referrals, total_earned_cents, created_at
    `, [req.user!.id, code]);
  }

  const referrals = await query(`
    SELECT r.id, r.status, r.bonus_cents, r.created_at, u.full_name as invitee_name
    FROM referrals r
    JOIN users u ON u.id = r.invitee_id
    WHERE r.inviter_id = $1
    ORDER BY r.created_at DESC
    LIMIT 20
  `, [req.user!.id]);

  res.json({
    success: true,
    data: {
      referralCode: referral,
      referralLink: `${process.env.VITE_APP_DOMAIN || ''}/signup?ref=${referral.code}`,
      referrals,
    },
  });
}));

router.post('/referral/apply',
  body('code').trim().notEmpty(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { code } = req.body;

    const existingReferral = await queryOne(`
      SELECT id FROM referrals WHERE invitee_id = $1
    `, [req.user!.id]);

    if (existingReferral) {
      throw new AppError('You have already used a referral code', 400, 'ALREADY_REFERRED');
    }

    const referralCode = await queryOne<any>(`
      SELECT id, user_id FROM referral_codes WHERE code = $1
    `, [code]);

    if (!referralCode) {
      throw new AppError('Invalid referral code', 404, 'INVALID_CODE');
    }

    if (referralCode.user_id === req.user!.id) {
      throw new AppError('Cannot use your own referral code', 400, 'SELF_REFERRAL');
    }

    const BONUS_CENTS = 500;

    await transaction(async (client) => {
      await client.query(`
        INSERT INTO referrals (inviter_id, invitee_id, code_id, bonus_cents, status)
        VALUES ($1, $2, $3, $4, 'completed')
      `, [referralCode.user_id, req.user!.id, referralCode.id, BONUS_CENTS]);

      await client.query(`
        UPDATE referral_codes 
        SET total_referrals = total_referrals + 1, total_earned_cents = total_earned_cents + $1
        WHERE id = $2
      `, [BONUS_CENTS, referralCode.id]);

      await client.query(`
        INSERT INTO wallets (user_id, currency, balance_cents)
        VALUES ($1, 'USD', $2)
        ON CONFLICT (user_id, currency) 
        DO UPDATE SET balance_cents = wallets.balance_cents + $2
      `, [referralCode.user_id, BONUS_CENTS]);

      await client.query(`
        INSERT INTO wallets (user_id, currency, balance_cents)
        VALUES ($1, 'USD', $2)
        ON CONFLICT (user_id, currency) 
        DO UPDATE SET balance_cents = wallets.balance_cents + $2
      `, [req.user!.id, BONUS_CENTS]);

      await client.query(`
        INSERT INTO transactions (user_id, type, status, amount_cents, currency, description)
        VALUES ($1, 'deposit', 'SUCCESS', $2, 'USD', 'Referral bonus')
      `, [referralCode.user_id, BONUS_CENTS]);

      await client.query(`
        INSERT INTO transactions (user_id, type, status, amount_cents, currency, description)
        VALUES ($1, 'deposit', 'SUCCESS', $2, 'USD', 'Welcome bonus from referral')
      `, [req.user!.id, BONUS_CENTS]);
    });

    await createAuditLog({
      userId: req.user!.id,
      action: 'REFERRAL_APPLIED',
      entityType: 'referral',
      newValues: { code, inviterId: referralCode.user_id, bonusCents: BONUS_CENTS },
    });

    res.json({
      success: true,
      message: `Referral code applied! You and the referrer each received $${BONUS_CENTS / 100} bonus.`,
    });
  })
);

router.get('/subscriptions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const subscriptions = await query(`
    SELECT id, merchant, amount_cents, currency, frequency, next_charge_date, status, created_at
    FROM subscriptions
    WHERE user_id = $1
    ORDER BY next_charge_date ASC
  `, [req.user!.id]);

  const totalMonthly = await queryOne<any>(`
    SELECT SUM(
      CASE 
        WHEN frequency = 'weekly' THEN amount_cents * 4
        WHEN frequency = 'biweekly' THEN amount_cents * 2
        WHEN frequency = 'yearly' THEN amount_cents / 12
        ELSE amount_cents
      END
    ) as total
    FROM subscriptions
    WHERE user_id = $1 AND status = 'active'
  `, [req.user!.id]);

  res.json({
    success: true,
    data: {
      subscriptions,
      monthlyTotal: Number(totalMonthly?.total || 0) / 100,
    },
  });
}));

router.post('/subscriptions',
  body('merchant').trim().notEmpty().isLength({ max: 100 }),
  body('amount').isFloat({ min: 0.01 }),
  body('currency').isIn(['USD', 'EUR', 'GBP', 'NGN']),
  body('frequency').isIn(['weekly', 'biweekly', 'monthly', 'yearly']),
  body('nextChargeDate').isISO8601(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const { merchant, amount, currency, frequency, nextChargeDate } = req.body;
    const amountCents = Math.round(amount * 100);

    const subscription = await queryOne(`
      INSERT INTO subscriptions (user_id, merchant, amount_cents, currency, frequency, next_charge_date)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, merchant, amount_cents, currency, frequency, next_charge_date, status, created_at
    `, [req.user!.id, merchant, amountCents, currency, frequency, nextChargeDate]);

    res.status(201).json({ success: true, data: { subscription } });
  })
);

router.put('/subscriptions/:id',
  body('amount').optional().isFloat({ min: 0.01 }),
  body('frequency').optional().isIn(['weekly', 'biweekly', 'monthly', 'yearly']),
  body('nextChargeDate').optional().isISO8601(),
  body('status').optional().isIn(['active', 'paused', 'cancelled']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id as string;
    const { amount, frequency, nextChargeDate, status } = req.body;

    const subscription = await queryOne(`
      SELECT id FROM subscriptions WHERE id = $1 AND user_id = $2
    `, [id, req.user!.id]);

    if (!subscription) {
      throw new AppError('Subscription not found', 404, 'NOT_FOUND');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (amount !== undefined) {
      updates.push(`amount_cents = $${paramIndex++}`);
      values.push(Math.round(amount * 100));
    }
    if (frequency !== undefined) {
      updates.push(`frequency = $${paramIndex++}`);
      values.push(frequency);
    }
    if (nextChargeDate !== undefined) {
      updates.push(`next_charge_date = $${paramIndex++}`);
      values.push(nextChargeDate);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (updates.length === 0) {
      throw new AppError('No updates provided', 400, 'NO_UPDATES');
    }

    values.push(id);
    const updated = await queryOne(`
      UPDATE subscriptions SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING id, merchant, amount_cents, currency, frequency, next_charge_date, status
    `, values);

    res.json({ success: true, data: { subscription: updated } });
  })
);

router.delete('/subscriptions/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;

  await query(`DELETE FROM subscriptions WHERE id = $1 AND user_id = $2`, [id, req.user!.id]);

  res.json({ success: true, message: 'Subscription deleted' });
}));

router.get('/subscriptions/detect', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const detected = await query(`
    SELECT 
      description,
      amount_cents,
      currency,
      COUNT(*) as occurrence_count,
      MAX(created_at) as last_occurrence
    FROM transactions
    WHERE user_id = $1 
      AND type = 'transfer_out'
      AND status = 'SUCCESS'
      AND created_at >= NOW() - INTERVAL '90 days'
    GROUP BY description, amount_cents, currency
    HAVING COUNT(*) >= 2
    ORDER BY occurrence_count DESC, amount_cents DESC
    LIMIT 20
  `, [req.user!.id]);

  const potentialSubscriptions = detected.map((d: any) => ({
    merchant: d.description,
    amount: Number(d.amount_cents) / 100,
    currency: d.currency,
    occurrences: d.occurrence_count,
    lastSeen: d.last_occurrence,
    estimatedFrequency: d.occurrence_count >= 4 ? 'weekly' : d.occurrence_count >= 2 ? 'monthly' : 'unknown',
  }));

  res.json({ success: true, data: { potentialSubscriptions } });
}));

export { router as rewardsRouter };
