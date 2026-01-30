import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { query, queryOne, transaction } from '../db/pool';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { createAuditLog, getAuditLogs, exportAuditLogsToCSV } from '../services/auditService';
import { getFraudFlags } from '../services/fraudService';
import { isStripeConfigured, createPaymentIntent, getPaymentIntent } from '../services/stripeService';
import { getSecurityEvents, getSecurityEventsByType, getSecurityEventsByIP } from '../middleware/securityLogger';
import { getRateLimitViolations, clearRateLimitViolations } from '../middleware/rateLimit';

const router = Router();
router.use(authenticate);
router.use(requireRole('SUPER_ADMIN'));

router.get('/wallets', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const wallets = await query(`
    SELECT 
      w.user_id, w.currency, w.balance_cents, w.reserved_cents,
      u.email as user_email, u.full_name as user_name
    FROM wallets w
    JOIN users u ON w.user_id = u.id
    ORDER BY w.balance_cents DESC
    LIMIT 500
  `);

  res.json({
    success: true,
    data: { wallets }
  });
}));

router.get('/users/:userId/balance', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params;
  
  const wallet = await queryOne<any>(`
    SELECT balance_cents FROM wallets WHERE user_id = $1 AND currency = 'USD'
  `, [userId]);

  res.json({
    success: true,
    data: { balance: wallet?.balance_cents || 0 }
  });
}));

router.get('/overview', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const [userStats, transactionStats, pendingWithdrawals, fraudFlags] = await Promise.all([
    queryOne<any>(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE account_status = 'active') as active_users,
        COUNT(*) FILTER (WHERE kyc_status = 'approved') as verified_users
      FROM users WHERE role = 'USER'
    `),
    queryOne<any>(`
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(amount_cents) FILTER (WHERE type = 'deposit' AND status = 'SUCCESS'), 0) as total_deposits,
        COALESCE(SUM(amount_cents) FILTER (WHERE type = 'withdrawal' AND status = 'SUCCESS'), 0) as total_withdrawals
      FROM transactions
    `),
    queryOne<any>('SELECT COUNT(*) as count FROM withdrawal_requests WHERE status = $1', ['pending']),
    queryOne<any>('SELECT COUNT(*) as count FROM fraud_flags WHERE status = $1', ['active']),
  ]);

    res.json({
      success: true,
      data: {
        users: {
          total: parseInt(userStats?.total_users || '0'),
          active: parseInt(userStats?.active_users || '0'),
          verified: parseInt(userStats?.verified_users || '0'),
        },
        transactions: {
          total: parseInt(transactionStats?.total_transactions || '0'),
          totalDeposits: (Number(transactionStats?.total_deposits || 0)) / 100,
          totalWithdrawals: (Number(transactionStats?.total_withdrawals || 0)) / 100,
        },
        pendingWithdrawals: parseInt(pendingWithdrawals?.count || '0'),
        activeFraudFlags: parseInt(fraudFlags?.count || '0'),
      }
    });
}));

router.get('/users', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const search = req.query.search as string;

  let whereClause = '1=1';
  const params: any[] = [];

  if (search) {
    whereClause = '(email ILIKE $1 OR full_name ILIKE $1)';
    params.push(`%${search}%`);
  }

  const users = await query(`
    SELECT id, email, full_name, phone, role, kyc_status, account_status, created_at
    FROM users 
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, offset]);

  res.json({ success: true, data: { users } });
}));

router.post('/users',
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('fullName').optional().trim(),
  body('phone').optional().trim(),
  body('role').optional().isIn(['USER', 'SUPER_ADMIN']).withMessage('Role must be USER or SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const { email, password, fullName, phone, role = 'USER' } = req.body;

    const existingUser = await queryOne<any>('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser) {
      throw new AppError('A user with this email already exists', 409, 'EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await queryOne<any>(`
      INSERT INTO users (email, password_hash, full_name, phone, role, account_status, kyc_status)
      VALUES ($1, $2, $3, $4, $5, 'active', 'not_started')
      RETURNING id, email, full_name, role, created_at
    `, [email, passwordHash, fullName || null, phone || null, role]);

    await query(`
      INSERT INTO wallets (user_id, currency, balance_cents)
      VALUES ($1, 'USD', 0)
      ON CONFLICT (user_id, currency) DO NOTHING
    `, [result.id]);

    await createAuditLog({
      userId: req.user!.id,
      action: 'USER_CREATED_BY_ADMIN',
      entityType: 'user',
      entityId: result.id,
      newValues: { email, role, fullName, phone },
    });

    res.status(201).json({
      success: true,
      data: { user: result },
      message: 'User created successfully'
    });
  })
);

router.get('/users/:userId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params;
  
  const user = await queryOne(`
    SELECT id, email, full_name, phone, country, role, kyc_status, account_status, 
           two_factor_enabled, failed_login_attempts, locked_until, created_at, updated_at
    FROM users WHERE id = $1
  `, [userId]);

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const wallets = await query(`
    SELECT currency, balance_cents, reserved_cents FROM wallets WHERE user_id = $1
  `, [userId]);

  res.json({ success: true, data: { user, wallets } });
}));

router.put('/users/:userId/status',
  body('status').isIn(['active', 'limited', 'suspended', 'closed']),
  body('reason').optional().trim(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const { status, reason } = req.body;

    const user = await queryOne<any>('SELECT email, account_status, role FROM users WHERE id = $1', [userId]);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.role === 'SUPER_ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
      throw new AppError('Cannot modify SUPER_ADMIN users', 403, 'FORBIDDEN');
    }

    await query('UPDATE users SET account_status = $1, updated_at = NOW() WHERE id = $2', [status, userId]);

    await createAuditLog({
      userId: req.user!.id,
      action: 'USER_STATUS_CHANGED',
      entityType: 'user',
      entityId: userId as string,
      oldValues: { status: user.account_status },
      newValues: { status, reason },
    });

    res.json({ success: true, message: 'User status updated' });
  })
);

router.put('/users/:userId/password',
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const { password } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const user = await queryOne<any>('SELECT email, role FROM users WHERE id = $1', [userId]);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.role === 'SUPER_ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
      throw new AppError('Cannot modify SUPER_ADMIN users', 403, 'FORBIDDEN');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, userId]);

    await createAuditLog({
      userId: req.user!.id,
      action: 'USER_PASSWORD_RESET',
      entityType: 'user',
      entityId: userId as string,
      newValues: { target_email: user.email },
    });

    res.json({ success: true, message: 'Password reset successfully' });
  })
);

router.get('/my-activity', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  const logs = await query(`
    SELECT id, action, entity_type, entity_id, old_values, new_values, ip_address, created_at
    FROM audit_logs
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `, [req.user!.id, limit, offset]);

  const totalResult = await queryOne<any>(
    'SELECT COUNT(*) as total FROM audit_logs WHERE user_id = $1',
    [req.user!.id]
  );

  res.json({
    success: true,
    data: {
      logs,
      total: parseInt(totalResult?.total || '0'),
      limit,
      offset
    }
  });
}));

router.put('/users/:userId/kyc-status',
  body('status').isIn(['not_started', 'pending', 'approved', 'rejected']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const { status } = req.body;

    const user = await queryOne<any>('SELECT email, kyc_status FROM users WHERE id = $1', [userId]);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    await query('UPDATE users SET kyc_status = $1, updated_at = NOW() WHERE id = $2', [status, userId]);

    await createAuditLog({
      userId: req.user!.id,
      action: 'KYC_STATUS_CHANGED',
      entityType: 'user',
      entityId: userId as string,
      oldValues: { kyc_status: user.kyc_status },
      newValues: { kyc_status: status },
    });

    res.json({ success: true, message: 'KYC status updated' });
  })
);

router.put('/users/:userId/role',
  requireRole('SUPER_ADMIN'),
  body('role').isIn(['USER']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const { role } = req.body;

    const user = await queryOne<any>('SELECT email, role FROM users WHERE id = $1', [userId]);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.role === 'SUPER_ADMIN') {
      throw new AppError('Cannot modify SUPER_ADMIN role', 403, 'FORBIDDEN');
    }

    await query('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2', [role, userId]);

    await createAuditLog({
      userId: req.user!.id,
      action: 'USER_ROLE_CHANGED',
      entityType: 'user',
      entityId: userId as string,
      oldValues: { role: user.role },
      newValues: { role },
    });

    res.json({ success: true, message: 'User role updated' });
  })
);

router.get('/withdrawals', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const status = req.query.status as string || 'pending';
  
  const withdrawals = await query(`
    SELECT w.*, u.email as user_email, u.full_name as user_name
    FROM withdrawal_requests w
    JOIN users u ON w.user_id = u.id
    WHERE w.status = $1
    ORDER BY w.created_at DESC
    LIMIT 100
  `, [status]);

  const formatted = withdrawals.map(w => ({
    ...w,
    amount: Number(w.amount_cents) / 100,
  }));

  res.json({ success: true, data: { withdrawals: formatted } });
}));

router.post('/withdrawals/:withdrawalId/approve',
  body('notes').optional().trim(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { withdrawalId } = req.params;
    const { notes } = req.body;

    const withdrawal = await queryOne<any>(`
      SELECT * FROM withdrawal_requests WHERE id = $1
    `, [withdrawalId]);

    if (!withdrawal) {
      throw new AppError('Withdrawal not found', 404, 'NOT_FOUND');
    }

    if (withdrawal.status !== 'pending') {
      throw new AppError('Withdrawal already processed', 400, 'ALREADY_PROCESSED');
    }

    await transaction(async (client) => {
      await client.query(`
        UPDATE withdrawal_requests 
        SET status = 'approved', admin_notes = $1, approved_by = $2, updated_at = NOW()
        WHERE id = $3
      `, [notes, req.user!.id, withdrawalId]);

      await client.query(`
        UPDATE wallets 
        SET balance_cents = balance_cents - $1, reserved_cents = reserved_cents - $1, updated_at = NOW()
        WHERE user_id = $2 AND currency = $3
      `, [withdrawal.amount_cents, withdrawal.user_id, withdrawal.currency]);

      await client.query(`
        UPDATE transactions SET status = 'SUCCESS', updated_at = NOW() 
        WHERE reference = $1 AND type = 'withdrawal'
      `, [withdrawalId]);
    });

    await createAuditLog({
      userId: req.user!.id,
      action: 'WITHDRAWAL_APPROVED',
      entityType: 'withdrawal',
      entityId: withdrawalId as string,
      oldValues: { status: 'pending' },
      newValues: { status: 'approved', notes },
    });

    res.json({ success: true, message: 'Withdrawal approved' });
  })
);

router.post('/withdrawals/:withdrawalId/reject',
  body('reason').trim().notEmpty(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { withdrawalId } = req.params;
    const { reason } = req.body;

    const withdrawal = await queryOne<any>(`
      SELECT * FROM withdrawal_requests WHERE id = $1
    `, [withdrawalId]);

    if (!withdrawal) {
      throw new AppError('Withdrawal not found', 404, 'NOT_FOUND');
    }

    if (withdrawal.status !== 'pending') {
      throw new AppError('Withdrawal already processed', 400, 'ALREADY_PROCESSED');
    }

    await transaction(async (client) => {
      await client.query(`
        UPDATE withdrawal_requests 
        SET status = 'rejected', admin_notes = $1, approved_by = $2, updated_at = NOW()
        WHERE id = $3
      `, [reason, req.user!.id, withdrawalId]);

      await client.query(`
        UPDATE wallets SET reserved_cents = reserved_cents - $1, updated_at = NOW()
        WHERE user_id = $2 AND currency = $3
      `, [withdrawal.amount_cents, withdrawal.user_id, withdrawal.currency]);

      await client.query(`
        UPDATE transactions SET status = 'FAILED', updated_at = NOW() 
        WHERE reference = $1 AND type = 'withdrawal'
      `, [withdrawalId]);
    });

    await createAuditLog({
      userId: req.user!.id,
      action: 'WITHDRAWAL_REJECTED',
      entityType: 'withdrawal',
      entityId: withdrawalId as string,
      oldValues: { status: 'pending' },
      newValues: { status: 'rejected', reason },
    });

    res.json({ success: true, message: 'Withdrawal rejected' });
  })
);

router.post('/adjustments',
  body('userId').isUUID(),
  body('type').isIn(['credit', 'debit']),
  body('amount').isFloat({ min: 0.01 }),
  body('currency').isIn(['USD', 'EUR', 'GBP', 'NGN']),
  body('reason').trim().isLength({ min: 10 }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const { userId, type, amount, currency, reason } = req.body;
    const amountCents = Math.round(amount * 100);

    const user = await queryOne('SELECT id FROM users WHERE id = $1', [userId]);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (req.user!.role === 'SUPER_ADMIN') {
      // Auto-approve for SUPER_ADMIN
      await transaction(async (client) => {
        const result = await client.query(`
          INSERT INTO admin_adjustments (user_id, requested_by, approved_by, type, amount_cents, currency, reason, status)
          VALUES ($1, $2, $2, $3, $4, $5, $6, 'APPROVED')
          RETURNING id
        `, [userId, req.user!.id, type, amountCents, currency, reason]);

        const adjustmentId = result.rows[0].id;
        const balanceChange = type === 'credit' ? amountCents : -amountCents;
        
        await client.query(`
          INSERT INTO wallets (user_id, currency, balance_cents)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, currency) 
          DO UPDATE SET balance_cents = wallets.balance_cents + $3, updated_at = NOW()
        `, [userId, currency, balanceChange]);

        await client.query(`
          INSERT INTO transactions (user_id, type, status, amount_cents, currency, reference, description)
          VALUES ($1, 'adjustment', 'SUCCESS', $2, $3, $4, $5)
          RETURNING id
        `, [userId, amountCents, currency, adjustmentId, reason]);
      });

      await createAuditLog({
        userId: req.user!.id,
        action: 'ADJUSTMENT_AUTO_APPROVED',
        entityType: 'adjustment',
        entityId: userId as string,
        newValues: { userId, type, amount: amountCents, currency, reason, autoApproved: true },
      });

      res.status(201).json({ 
        success: true, 
        data: { 
          status: 'SUCCESS',
        },
        message: 'Adjustment applied successfully'
      });
    } else {
      throw new AppError('Unauthorized to create adjustments', 403, 'FORBIDDEN');
    }
  })
);

router.get('/adjustments', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const status = req.query.status as string || 'PENDING';
  
  const adjustments = await query(`
    SELECT a.*, 
           u.email as user_email,
           r.email as requester_email,
           ap.email as approver_email
    FROM admin_adjustments a
    JOIN users u ON a.user_id = u.id
    JOIN users r ON a.requested_by = r.id
    LEFT JOIN users ap ON a.approved_by = ap.id
    WHERE a.status = $1
    ORDER BY a.created_at DESC
  `, [status]);

  res.json({ success: true, data: { adjustments } });
}));

router.post('/adjustments/:adjustmentId/approve',
  requireRole('SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { adjustmentId } = req.params;

    const adjustment = await queryOne<any>(`
      SELECT * FROM admin_adjustments WHERE id = $1
    `, [adjustmentId]);

    if (!adjustment) {
      throw new AppError('Adjustment not found', 404, 'NOT_FOUND');
    }

    if (adjustment.status !== 'PENDING') {
      throw new AppError('Adjustment already processed', 400, 'ALREADY_PROCESSED');
    }

    await transaction(async (client) => {
      await client.query(`
        UPDATE admin_adjustments 
        SET status = 'APPROVED', approved_by = $1, updated_at = NOW()
        WHERE id = $2
      `, [req.user!.id, adjustmentId]);

      const balanceChange = adjustment.type === 'credit' ? adjustment.amount_cents : -adjustment.amount_cents;
      
      await client.query(`
        INSERT INTO wallets (user_id, currency, balance_cents)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, currency) 
        DO UPDATE SET balance_cents = wallets.balance_cents + $3, updated_at = NOW()
      `, [adjustment.user_id, adjustment.currency, balanceChange]);

      await client.query(`
        INSERT INTO transactions (user_id, type, status, amount_cents, currency, reference, description)
        VALUES ($1, 'adjustment', 'SUCCESS', $2, $3, $4, $5)
      `, [adjustment.user_id, adjustment.amount_cents, adjustment.currency, adjustmentId, adjustment.reason]);
    });

    await createAuditLog({
      userId: req.user!.id,
      action: 'ADJUSTMENT_APPROVED',
      entityType: 'adjustment',
      entityId: adjustmentId as string,
      oldValues: { status: 'PENDING' },
      newValues: { status: 'APPROVED' },
    });

    res.json({ success: true, message: 'Adjustment approved and applied' });
  })
);

router.post('/adjustments/:adjustmentId/reject',
  requireRole('SUPER_ADMIN'),
  body('reason').trim().notEmpty(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { adjustmentId } = req.params;
    const { reason } = req.body;

    await query(`
      UPDATE admin_adjustments 
      SET status = 'REJECTED', approved_by = $1, updated_at = NOW()
      WHERE id = $2 AND status = 'PENDING'
    `, [req.user!.id, adjustmentId]);

    await createAuditLog({
      userId: req.user!.id,
      action: 'ADJUSTMENT_REJECTED',
      entityType: 'adjustment',
      entityId: adjustmentId as string,
      newValues: { status: 'REJECTED', reason },
    });

    res.json({ success: true, message: 'Adjustment rejected' });
  })
);

router.get('/transactions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const userId = req.query.userId as string;
  const type = req.query.type as string;
  const status = req.query.status as string;

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (userId) {
    whereClause += ` AND t.user_id = $${paramIndex++}`;
    params.push(userId);
  }
  if (type) {
    whereClause += ` AND t.type = $${paramIndex++}`;
    params.push(type);
  }
  if (status) {
    whereClause += ` AND t.status = $${paramIndex++}`;
    params.push(status);
  }

  const transactions = await query(`
    SELECT t.*, u.email as user_email, u.full_name as user_name
    FROM transactions t
    LEFT JOIN users u ON t.user_id = u.id
    ${whereClause}
    ORDER BY t.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `, [...params, limit, offset]);

  const countResult = await queryOne<{ count: string }>(`
    SELECT COUNT(*) as count FROM transactions t ${whereClause}
  `, params);

  res.json({
    success: true,
    data: {
      transactions,
      total: parseInt(countResult?.count || '0'),
      limit,
      offset,
    },
  });
}));

router.get('/audit-logs', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const filters = {
    userId: req.query.userId as string,
    action: req.query.action as string,
    entityType: req.query.entityType as string,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    limit: parseInt(req.query.limit as string) || 100,
    offset: parseInt(req.query.offset as string) || 0,
  };

  const logs = await getAuditLogs(filters);
  res.json({ success: true, data: { logs } });
}));

router.get('/audit-logs/export', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const filters = {
    userId: req.query.userId as string,
    action: req.query.action as string,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    limit: 10000,
  };

  const logs = await getAuditLogs(filters);
  const csv = exportAuditLogsToCSV(logs);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
  res.send(csv);
}));

router.get('/fraud-flags', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const flags = await getFraudFlags({
    userId: req.query.userId as string,
    status: req.query.status as string || 'active',
    severity: req.query.severity as string,
    limit: parseInt(req.query.limit as string) || 100,
  });

  res.json({ success: true, data: { flags } });
}));

router.post('/fraud-flags/:flagId/review',
  body('status').isIn(['reviewed', 'dismissed', 'confirmed']),
  body('notes').optional().trim(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { flagId } = req.params;
    const { status, notes } = req.body;

    await query(`
      UPDATE fraud_flags 
      SET status = $1, reviewed_by = $2, reviewed_at = NOW()
      WHERE id = $3
    `, [status, req.user!.id, flagId]);

    await createAuditLog({
      userId: req.user!.id,
      action: 'FRAUD_FLAG_REVIEWED',
      entityType: 'fraud_flag',
      entityId: flagId as string,
      newValues: { status, notes },
    });

    res.json({ success: true, message: 'Fraud flag reviewed' });
  })
);

router.get('/stripe-status', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      configured: isStripeConfigured(),
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    }
  });
}));

router.post('/card-deposit/create-intent',
  body('userId').notEmpty().withMessage('User ID is required'),
  body('amount').isFloat({ min: 0.50, max: 100000 }).withMessage('Amount must be between $0.50 and $100,000'),
  body('reason').trim().isLength({ min: 10 }).withMessage('Reason must be at least 10 characters'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    if (!isStripeConfigured()) {
      throw new AppError('Stripe is not configured. Contact system administrator.', 503, 'STRIPE_NOT_CONFIGURED');
    }

    const { userId, amount, reason } = req.body;
    const amountCents = Math.round(amount * 100);

    const user = await queryOne<any>('SELECT id, email, full_name FROM users WHERE id = $1', [userId]);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const { clientSecret, paymentIntentId } = await createPaymentIntent(amountCents, 'usd', {
      admin_deposit: 'true',
      user_id: userId,
      admin_id: req.user!.id,
      reason: reason.substring(0, 500),
    });

    await createAuditLog({
      userId: req.user!.id,
      action: 'CARD_DEPOSIT_INITIATED',
      entityType: 'card_deposit',
      entityId: paymentIntentId,
      newValues: { userId, amount: amountCents, reason },
    });

    res.json({
      success: true,
      data: {
        clientSecret,
        paymentIntentId,
        user: { id: user.id, email: user.email, full_name: user.full_name },
      }
    });
  })
);

router.post('/card-deposit/confirm',
  body('paymentIntentId').notEmpty().withMessage('Payment Intent ID is required'),
  body('userId').notEmpty().withMessage('User ID is required'),
  body('reason').trim().isLength({ min: 10 }).withMessage('Reason must be at least 10 characters'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    if (!isStripeConfigured()) {
      throw new AppError('Stripe is not configured', 503, 'STRIPE_NOT_CONFIGURED');
    }

    const { paymentIntentId, userId, reason } = req.body;

    const existingTx = await queryOne<any>(
      `SELECT id FROM transactions WHERE reference = $1 AND type = 'card_deposit'`,
      [paymentIntentId]
    );
    if (existingTx) {
      throw new AppError('This payment has already been processed', 400, 'ALREADY_PROCESSED');
    }

    const paymentIntent = await getPaymentIntent(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new AppError(`Payment not completed. Status: ${paymentIntent.status}`, 400, 'PAYMENT_NOT_COMPLETED');
    }

    const metadata = paymentIntent.metadata || {};
    if (metadata.user_id !== userId) {
      await createAuditLog({
        userId: req.user!.id,
        action: 'CARD_DEPOSIT_VALIDATION_FAILED',
        entityType: 'card_deposit',
        entityId: paymentIntentId,
        newValues: { 
          requestedUserId: userId, 
          metadataUserId: metadata.user_id,
          error: 'User ID mismatch' 
        },
      });
      throw new AppError('Payment verification failed: user mismatch', 403, 'USER_MISMATCH');
    }

    if (metadata.admin_id !== req.user!.id) {
      await createAuditLog({
        userId: req.user!.id,
        action: 'CARD_DEPOSIT_VALIDATION_FAILED',
        entityType: 'card_deposit',
        entityId: paymentIntentId,
        newValues: { 
          requestedAdminId: req.user!.id, 
          metadataAdminId: metadata.admin_id,
          error: 'Admin ID mismatch' 
        },
      });
      throw new AppError('Payment verification failed: admin mismatch', 403, 'ADMIN_MISMATCH');
    }

    const amountCents = paymentIntent.amount_received;

    await transaction(async (client) => {
      await client.query(`
        INSERT INTO wallets (user_id, currency, balance_cents)
        VALUES ($1, 'USD', $2)
        ON CONFLICT (user_id, currency) 
        DO UPDATE SET balance_cents = wallets.balance_cents + $2, updated_at = NOW()
      `, [userId, amountCents]);

      await client.query(`
        INSERT INTO transactions (user_id, type, status, amount_cents, currency, reference, description)
        VALUES ($1, 'card_deposit', 'SUCCESS', $2, 'USD', $3, $4)
      `, [userId, amountCents, paymentIntentId, `Admin card deposit: ${reason}`]);
    });

    await createAuditLog({
      userId: req.user!.id,
      action: 'CARD_DEPOSIT_COMPLETED',
      entityType: 'card_deposit',
      entityId: paymentIntentId,
      newValues: { 
        userId, 
        amount: amountCents, 
        reason, 
        stripePaymentIntentId: paymentIntentId,
        verifiedMetadata: { user_id: metadata.user_id, admin_id: metadata.admin_id }
      },
    });

    res.json({
      success: true,
      data: {
        amount: amountCents / 100,
        amountCents,
        paymentIntentId,
      },
      message: 'Card deposit completed successfully'
    });
  })
);

router.get('/payment-provider-status', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const configured = !!(process.env.FLUZ_AUTH_BASIC);

  res.json({
    success: true,
    data: { configured }
  });
}));

router.get('/gift-card-requests', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const status = req.query.status as string;
  const type = req.query.type as string;

  let whereClause = '1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (status) {
    whereClause += ` AND gcr.status = $${paramIndex++}`;
    params.push(status);
  }
  if (type) {
    whereClause += ` AND gcr.type = $${paramIndex++}`;
    params.push(type);
  }

  const requests = await query(`
    SELECT gcr.id, gcr.user_id, gcr.type, gcr.brand, gcr.amount_cents, gcr.currency, 
           gcr.status, gcr.card_code, gcr.created_at, gcr.updated_at,
           u.email as user_email, u.full_name as user_name
    FROM gift_card_requests gcr
    LEFT JOIN users u ON gcr.user_id = u.id
    WHERE ${whereClause}
    ORDER BY gcr.created_at DESC
    LIMIT $${paramIndex}
  `, [...params, limit]);

  res.json({
    success: true,
    data: { requests }
  });
}));

router.post('/gift-card-requests/:requestId/approve',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { requestId } = req.params;

    const request = await queryOne<any>('SELECT * FROM gift_card_requests WHERE id = $1', [requestId]);
    if (!request) {
      throw new AppError('Gift card request not found', 404, 'NOT_FOUND');
    }

    if (request.status !== 'pending') {
      throw new AppError('Request already processed', 400, 'ALREADY_PROCESSED');
    }

    await query(`
      UPDATE gift_card_requests SET status = 'completed', updated_at = NOW() WHERE id = $1
    `, [requestId]);

    await createAuditLog({
      userId: req.user!.id,
      action: 'GIFT_CARD_REQUEST_APPROVED',
      entityType: 'gift_card_request',
      entityId: requestId as string,
      newValues: { status: 'completed' },
    });

    res.json({ success: true, message: 'Gift card request approved' });
  })
);

router.post('/gift-card-requests/:requestId/reject',
  body('reason').optional().trim(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { requestId } = req.params;
    const { reason } = req.body;

    const request = await queryOne<any>('SELECT * FROM gift_card_requests WHERE id = $1', [requestId]);
    if (!request) {
      throw new AppError('Gift card request not found', 404, 'NOT_FOUND');
    }

    if (request.status !== 'pending') {
      throw new AppError('Request already processed', 400, 'ALREADY_PROCESSED');
    }

    await query(`
      UPDATE gift_card_requests SET status = 'rejected', updated_at = NOW() WHERE id = $1
    `, [requestId]);

    await createAuditLog({
      userId: req.user!.id,
      action: 'GIFT_CARD_REQUEST_REJECTED',
      entityType: 'gift_card_request',
      entityId: requestId as string,
      newValues: { status: 'rejected', reason },
    });

    res.json({ success: true, message: 'Gift card request rejected' });
  })
);

// Security monitoring endpoints
router.get('/security/events', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const type = req.query.type as string;
  const ip = req.query.ip as string;
  
  let events;
  if (type) {
    events = getSecurityEventsByType(type, limit);
  } else if (ip) {
    events = getSecurityEventsByIP(ip, limit);
  } else {
    events = getSecurityEvents(limit);
  }
  
  res.json({
    success: true,
    data: { events, count: events.length }
  });
}));

router.get('/security/rate-limits', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const violations = getRateLimitViolations();
  const violationsArray = Array.from(violations.entries()).map(([ip, count]) => ({ ip, violations: count }));
  
  res.json({
    success: true,
    data: { violations: violationsArray, count: violations.size }
  });
}));

router.post('/security/rate-limits/clear', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const ip = req.body.ip as string | undefined;
  clearRateLimitViolations(ip);
  
  await createAuditLog({
    userId: req.user!.id,
    action: 'SECURITY_RATE_LIMIT_CLEARED',
    entityType: 'security',
    newValues: { ip: ip || 'all' },
  });
  
  res.json({ success: true, message: ip ? `Rate limit cleared for ${ip}` : 'All rate limits cleared' });
}));

router.get('/card-transactions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const status = req.query.status as string;

  let whereClause = '1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (status) {
    whereClause += ` AND ct.status = $${paramIndex++}`;
    params.push(status);
  }

  const transactions = await query(`
    SELECT ct.id, ct.card_id, ct.amount_cents, ct.currency, ct.merchant, ct.category, 
           ct.status, ct.created_at,
           vc.card_name, vc.last_four as card_last_four, vc.user_id,
           u.email as user_email, u.full_name as user_name
    FROM card_transactions ct
    LEFT JOIN virtual_cards vc ON ct.card_id = vc.id
    LEFT JOIN users u ON vc.user_id = u.id
    WHERE ${whereClause}
    ORDER BY ct.created_at DESC
    LIMIT $${paramIndex}
  `, [...params, limit]);

  res.json({
    success: true,
    data: { transactions }
  });
}));

export { router as adminRouter };
