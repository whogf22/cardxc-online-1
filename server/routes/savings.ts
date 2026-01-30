import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query, queryOne, transaction } from '../db/pool';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { sensitiveOpLimiter } from '../middleware/rateLimit';
import { createAuditLog } from '../services/auditService';

const router = Router();
router.use(authenticate);

router.get('/vaults', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const vaults = await query(`
    SELECT id, name, target_cents, balance_cents, currency, emoji, color, created_at
    FROM savings_vaults
    WHERE user_id = $1
    ORDER BY created_at DESC
  `, [req.user!.id]);

  res.json({ success: true, data: { vaults } });
}));

router.post('/vaults',
  body('name').trim().notEmpty().isLength({ max: 50 }),
  body('targetAmount').isFloat({ min: 0 }),
  body('currency').isIn(['USD', 'EUR', 'GBP', 'NGN']),
  body('emoji').optional().isLength({ max: 4 }),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const { name, targetAmount, currency, emoji = '💰', color = '#22c55e' } = req.body;
    const targetCents = Math.round(targetAmount * 100);

    const vault = await queryOne(`
      INSERT INTO savings_vaults (user_id, name, target_cents, currency, emoji, color)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, target_cents, balance_cents, currency, emoji, color, created_at
    `, [req.user!.id, name, targetCents, currency, emoji, color]);

    await createAuditLog({
      userId: req.user!.id,
      action: 'VAULT_CREATED',
      entityType: 'savings_vault',
      entityId: vault.id,
      newValues: { name, targetCents, currency },
    });

    res.status(201).json({ success: true, data: { vault } });
  })
);

router.post('/vaults/:id/deposit',
  sensitiveOpLimiter,
  body('amount').isFloat({ min: 0.01 }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }
    const id = req.params.id as string;
    const { amount } = req.body;
    const amountCents = Math.round(amount * 100);

    const vault = await queryOne<any>(`
      SELECT id, currency FROM savings_vaults WHERE id = $1 AND user_id = $2
    `, [id, req.user!.id]);

    if (!vault) {
      throw new AppError('Vault not found', 404, 'NOT_FOUND');
    }

    const wallet = await queryOne<any>(`
      SELECT balance_cents FROM wallets WHERE user_id = $1 AND currency = $2
    `, [req.user!.id, vault.currency]);

    if (!wallet || Number(wallet.balance_cents) < amountCents) {
      throw new AppError('Insufficient balance', 400, 'INSUFFICIENT_BALANCE');
    }

    await transaction(async (client) => {
      await client.query(`
        UPDATE wallets SET balance_cents = balance_cents - $1, updated_at = NOW()
        WHERE user_id = $2 AND currency = $3
      `, [amountCents, req.user!.id, vault.currency]);

      await client.query(`
        UPDATE savings_vaults SET balance_cents = balance_cents + $1, updated_at = NOW()
        WHERE id = $2
      `, [amountCents, id]);

      await client.query(`
        INSERT INTO transactions (user_id, type, status, amount_cents, currency, description, metadata)
        VALUES ($1, 'transfer_out', 'SUCCESS', $2, $3, 'Savings vault deposit', $4)
      `, [req.user!.id, amountCents, vault.currency, JSON.stringify({ vaultId: id })]);
    });

    const updated = await queryOne(`
      SELECT id, name, target_cents, balance_cents, currency FROM savings_vaults WHERE id = $1
    `, [id]);

    res.json({ success: true, data: { vault: updated } });
  })
);

router.post('/vaults/:id/withdraw',
  sensitiveOpLimiter,
  body('amount').isFloat({ min: 0.01 }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }
    const id = req.params.id as string;
    const { amount } = req.body;
    const amountCents = Math.round(amount * 100);

    const vault = await queryOne<any>(`
      SELECT id, balance_cents, currency FROM savings_vaults WHERE id = $1 AND user_id = $2
    `, [id, req.user!.id]);

    if (!vault) {
      throw new AppError('Vault not found', 404, 'NOT_FOUND');
    }

    if (Number(vault.balance_cents) < amountCents) {
      throw new AppError('Insufficient vault balance', 400, 'INSUFFICIENT_BALANCE');
    }

    await transaction(async (client) => {
      await client.query(`
        UPDATE savings_vaults SET balance_cents = balance_cents - $1, updated_at = NOW()
        WHERE id = $2
      `, [amountCents, id]);

      await client.query(`
        INSERT INTO wallets (user_id, currency, balance_cents)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, currency) 
        DO UPDATE SET balance_cents = wallets.balance_cents + $3, updated_at = NOW()
      `, [req.user!.id, vault.currency, amountCents]);

      await client.query(`
        INSERT INTO transactions (user_id, type, status, amount_cents, currency, description, metadata)
        VALUES ($1, 'transfer_in', 'SUCCESS', $2, $3, 'Savings vault withdrawal', $4)
      `, [req.user!.id, amountCents, vault.currency, JSON.stringify({ vaultId: id })]);
    });

    const updated = await queryOne(`
      SELECT id, name, target_cents, balance_cents, currency FROM savings_vaults WHERE id = $1
    `, [id]);

    res.json({ success: true, data: { vault: updated } });
  })
);

router.delete('/vaults/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;

  const vault = await queryOne<any>(`
    SELECT id, balance_cents, currency FROM savings_vaults WHERE id = $1 AND user_id = $2
  `, [id, req.user!.id]);

  if (!vault) {
    throw new AppError('Vault not found', 404, 'NOT_FOUND');
  }

  if (Number(vault.balance_cents) > 0) {
    await transaction(async (client) => {
      await client.query(`
        INSERT INTO wallets (user_id, currency, balance_cents)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, currency) 
        DO UPDATE SET balance_cents = wallets.balance_cents + $3
      `, [req.user!.id, vault.currency, vault.balance_cents]);

      await client.query(`DELETE FROM savings_vaults WHERE id = $1`, [id]);
    });
  } else {
    await query(`DELETE FROM savings_vaults WHERE id = $1`, [id]);
  }

  res.json({ success: true, message: 'Vault deleted, balance returned to wallet' });
}));

router.get('/roundup', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const rule = await queryOne(`
    SELECT id, enabled, vault_id, multiplier, created_at
    FROM roundup_rules
    WHERE user_id = $1
  `, [req.user!.id]);

  res.json({ success: true, data: { roundupRule: rule } });
}));

router.post('/roundup',
  body('enabled').isBoolean(),
  body('vaultId').optional().isUUID(),
  body('multiplier').optional().isInt({ min: 1, max: 10 }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { enabled, vaultId, multiplier = 1 } = req.body;

    if (enabled && vaultId) {
      const vault = await queryOne(`
        SELECT id FROM savings_vaults WHERE id = $1 AND user_id = $2
      `, [vaultId, req.user!.id]);

      if (!vault) {
        throw new AppError('Vault not found', 404, 'VAULT_NOT_FOUND');
      }
    }

    const existing = await queryOne(`
      SELECT id FROM roundup_rules WHERE user_id = $1
    `, [req.user!.id]);

    let rule;
    if (existing) {
      rule = await queryOne(`
        UPDATE roundup_rules SET enabled = $1, vault_id = $2, multiplier = $3, updated_at = NOW()
        WHERE user_id = $4
        RETURNING id, enabled, vault_id, multiplier
      `, [enabled, vaultId, multiplier, req.user!.id]);
    } else {
      rule = await queryOne(`
        INSERT INTO roundup_rules (user_id, enabled, vault_id, multiplier)
        VALUES ($1, $2, $3, $4)
        RETURNING id, enabled, vault_id, multiplier
      `, [req.user!.id, enabled, vaultId, multiplier]);
    }

    res.json({ success: true, data: { roundupRule: rule } });
  })
);

router.get('/budgets', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const budgets = await query(`
    SELECT id, category, limit_cents, spent_cents, period, currency, alert_threshold, created_at
    FROM budgets
    WHERE user_id = $1
    ORDER BY category
  `, [req.user!.id]);

  res.json({ success: true, data: { budgets } });
}));

router.post('/budgets',
  body('category').isIn(['shopping', 'food', 'transport', 'entertainment', 'utilities', 'travel', 'subscriptions', 'other']),
  body('limit').isFloat({ min: 0.01 }),
  body('period').isIn(['weekly', 'monthly']),
  body('currency').isIn(['USD', 'EUR', 'GBP', 'NGN']),
  body('alertThreshold').optional().isFloat({ min: 0, max: 100 }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const { category, limit, period, currency, alertThreshold = 80 } = req.body;
    const limitCents = Math.round(limit * 100);

    const existing = await queryOne(`
      SELECT id FROM budgets WHERE user_id = $1 AND category = $2 AND currency = $3
    `, [req.user!.id, category, currency]);

    if (existing) {
      throw new AppError('Budget for this category already exists', 400, 'DUPLICATE_BUDGET');
    }

    const budget = await queryOne(`
      INSERT INTO budgets (user_id, category, limit_cents, period, currency, alert_threshold)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, category, limit_cents, spent_cents, period, currency, alert_threshold
    `, [req.user!.id, category, limitCents, period, currency, alertThreshold]);

    res.status(201).json({ success: true, data: { budget } });
  })
);

router.put('/budgets/:id',
  body('limit').optional().isFloat({ min: 0.01 }),
  body('alertThreshold').optional().isFloat({ min: 0, max: 100 }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id as string;
    const { limit, alertThreshold } = req.body;

    const budget = await queryOne(`
      SELECT id FROM budgets WHERE id = $1 AND user_id = $2
    `, [id, req.user!.id]);

    if (!budget) {
      throw new AppError('Budget not found', 404, 'NOT_FOUND');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (limit !== undefined) {
      updates.push(`limit_cents = $${paramIndex++}`);
      values.push(Math.round(limit * 100));
    }
    if (alertThreshold !== undefined) {
      updates.push(`alert_threshold = $${paramIndex++}`);
      values.push(alertThreshold);
    }

    if (updates.length === 0) {
      throw new AppError('No updates provided', 400, 'NO_UPDATES');
    }

    values.push(id);
    const updated = await queryOne(`
      UPDATE budgets SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING id, category, limit_cents, spent_cents, period, currency, alert_threshold
    `, values);

    res.json({ success: true, data: { budget: updated } });
  })
);

router.delete('/budgets/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;

  await query(`DELETE FROM budgets WHERE id = $1 AND user_id = $2`, [id, req.user!.id]);

  res.json({ success: true, message: 'Budget deleted' });
}));

router.get('/analytics', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { period = 'month', currency = 'USD' } = req.query;

  let dateFilter: string;
  if (period === 'week') {
    dateFilter = "created_at >= NOW() - INTERVAL '7 days'";
  } else if (period === 'month') {
    dateFilter = "created_at >= NOW() - INTERVAL '30 days'";
  } else {
    dateFilter = "created_at >= NOW() - INTERVAL '365 days'";
  }

  const spendingByCategory = await query(`
    SELECT 
      COALESCE(metadata->>'category', 'other') as category,
      SUM(amount_cents) as total_cents,
      COUNT(*) as transaction_count
    FROM transactions
    WHERE user_id = $1 
      AND type IN ('transfer_out', 'withdrawal')
      AND status = 'SUCCESS'
      AND currency = $2
      AND ${dateFilter}
    GROUP BY COALESCE(metadata->>'category', 'other')
    ORDER BY total_cents DESC
  `, [req.user!.id, currency]);

  const dailySpending = await query(`
    SELECT 
      DATE(created_at) as date,
      SUM(amount_cents) as total_cents
    FROM transactions
    WHERE user_id = $1 
      AND type IN ('transfer_out', 'withdrawal')
      AND status = 'SUCCESS'
      AND currency = $2
      AND ${dateFilter}
    GROUP BY DATE(created_at)
    ORDER BY date
  `, [req.user!.id, currency]);

  const totalSpent = await queryOne<any>(`
    SELECT SUM(amount_cents) as total
    FROM transactions
    WHERE user_id = $1 
      AND type IN ('transfer_out', 'withdrawal')
      AND status = 'SUCCESS'
      AND currency = $2
      AND ${dateFilter}
  `, [req.user!.id, currency]);

  const totalReceived = await queryOne<any>(`
    SELECT SUM(amount_cents) as total
    FROM transactions
    WHERE user_id = $1 
      AND type IN ('transfer_in', 'deposit')
      AND status = 'SUCCESS'
      AND currency = $2
      AND ${dateFilter}
  `, [req.user!.id, currency]);

  res.json({
    success: true,
    data: {
      spendingByCategory,
      dailySpending,
      summary: {
        totalSpent: Number(totalSpent?.total || 0),
        totalReceived: Number(totalReceived?.total || 0),
        netFlow: Number(totalReceived?.total || 0) - Number(totalSpent?.total || 0),
      },
    },
  });
}));

router.get('/alerts', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const alerts = await query(`
    SELECT ba.id, ba.budget_id, ba.message, ba.triggered_at, ba.read,
           b.category, b.limit_cents, b.spent_cents
    FROM budget_alerts ba
    JOIN budgets b ON b.id = ba.budget_id
    WHERE b.user_id = $1
    ORDER BY ba.triggered_at DESC
    LIMIT 50
  `, [req.user!.id]);

  res.json({ success: true, data: { alerts } });
}));

router.post('/alerts/:id/read', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;

  await query(`
    UPDATE budget_alerts SET read = TRUE
    WHERE id = $1 AND budget_id IN (SELECT id FROM budgets WHERE user_id = $2)
  `, [id, req.user!.id]);

  res.json({ success: true, message: 'Alert marked as read' });
}));

export { router as savingsRouter };
