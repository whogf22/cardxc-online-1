import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { query, queryOne, transaction } from '../db/pool';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { createAuditLog, getAuditLogs, exportAuditLogsToCSV } from '../services/auditService';
import { getFraudFlags } from '../services/fraudService';
import { isStripeConfigured, createPaymentIntent, getPaymentIntent } from '../services/stripeService';
import { isFluzConfigured } from '../services/fluzClient';
import { getSecurityEvents, getSecurityEventsByType, getSecurityEventsByIP } from '../middleware/securityLogger';
import { getRateLimitViolations, clearRateLimitViolations } from '../middleware/rateLimit';
import { logger } from '../middleware/logger';

const router = Router();
router.use(authenticate);
router.use(requireRole('SUPER_ADMIN'));

router.get('/wallets', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const wallets = await query(`
    SELECT 
      w.user_id, w.currency, w.balance_cents, w.reserved_cents, w.updated_at,
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

router.get('/local-user-db', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [users, sessions, wallets] = await Promise.all([
      query<any>(`
        SELECT id, email, full_name, phone, country, role, kyc_status, account_status,
               email_verified, two_factor_enabled, failed_login_attempts, locked_until,
               referral_code, referred_by, created_at, updated_at
        FROM users ORDER BY created_at DESC LIMIT 500
      `),
      query<any>(`
        SELECT id, user_id, token_hash, ip_address, user_agent, device_info, is_active,
               created_at, last_used_at, expires_at
        FROM sessions ORDER BY last_used_at DESC NULLS LAST LIMIT 500
      `),
      query<any>(`
        SELECT id, user_id, currency, balance_cents, reserved_cents, usdt_balance_cents, created_at, updated_at
        FROM wallets ORDER BY updated_at DESC LIMIT 500
      `),
    ]);
    res.json({
      success: true,
      data: { users, sessions, wallets },
    });
  } catch (err: any) {
    if (err.code === '42P01') {
      res.status(503).json({
        success: false,
        error: 'Local user DB tables (users, sessions, wallets) not found. Run local-user-schema.sql.',
      });
      return;
    }
    throw err;
  }
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
  const [userStats, transactionStats, pendingWithdrawals, fraudFlags, transactionHistory] = await Promise.all([
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
    query<{ day: string, total: string }>(`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM-DD') as day,
        COUNT(*) as total
      FROM transactions
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY day
      ORDER BY day ASC
    `),
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
        history: (transactionHistory || []).map((h: any) => ({
          day: h.day,
          count: parseInt(h.total)
        })),
      },
      pendingWithdrawals: parseInt(pendingWithdrawals?.count || '0'),
      activeFraudFlags: parseInt(fraudFlags?.count || '0'),
    }
  });
}));

router.get('/users', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
  const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);
  const rawSearch = req.query.search;

  // Enforce a max length on the search term to block expensive wildcard
  // queries (ILIKE '%...%' with huge inputs is very slow on large tables).
  let search: string | null = null;
  if (typeof rawSearch === 'string' && rawSearch.trim().length > 0) {
    if (rawSearch.length > 100) {
      throw new AppError('Search term must be 100 characters or fewer', 400, 'VALIDATION_ERROR');
    }
    search = rawSearch;
  }

  let whereClause = '1=1';
  const params: any[] = [];

  if (search) {
    whereClause = '(email ILIKE $1 OR full_name ILIKE $1)';
    params.push(`%${search}%`);
  }

  const users = await query(`
    SELECT id, email, full_name, phone, country, role, kyc_status, account_status, created_at
    FROM users 
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, offset]);

  res.json({ success: true, data: { users } });
}));

function escapeCsvCell(val: any): string {
  if (val == null) return '';
  const s = String(val);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

router.get('/users/export', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 10000, 50000);
  const users = await query<any>(`
    SELECT id, email, full_name, role, account_status, created_at
    FROM users
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit]);

  const header = ['id', 'email', 'full_name', 'role', 'account_status', 'created_at'];
  const rows = users.map((u: any) =>
    header.map((h) => escapeCsvCell(u[h])).join(',')
  );
  const csv = [header.join(','), ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=users-export.csv');
  res.send(csv);
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

    if (status === 'active') {
      await query('UPDATE users SET account_status = $1, failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $2', [status, userId]);
    } else {
      await query('UPDATE users SET account_status = $1, updated_at = NOW() WHERE id = $2', [status, userId]);
    }

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
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
  const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);

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

    // NEW-1: this handler settles a FIAT reserve (it debits balance_cents and
    // releases reserved_cents). A USDT-funded withdrawal has no fiat reserve — its
    // funds were taken from usdt_balance_cents — so approving it here would debit
    // the wrong asset and drive reserved_cents negative. Refuse it and direct the
    // operator to the USDT resolver. Checked BEFORE the status check so the
    // failure names the real problem.
    if ((withdrawal.asset_type ?? 'fiat') !== 'fiat') {
      throw new AppError(
        'This is a USDT-funded withdrawal. Resolve it via /withdrawals/:id/usdt/settle or /usdt/refund.',
        400,
        'WRONG_ASSET_TYPE',
      );
    }

    // Fail closed: a legacy-flagged row has unknown funding provenance and must
    // be manually reconciled before any money moves. (See assertNotLegacyUnverified.)
    assertNotLegacyUnverified(withdrawal);

    if (withdrawal.status !== 'pending') {
      throw new AppError('Withdrawal already processed', 400, 'ALREADY_PROCESSED');
    }

    await transaction(async (client) => {
      // Atomically claim the withdrawal so two concurrent admin actions (or an
      // approve racing a reject) cannot both move money. The out-of-transaction
      // status check above is only a fast-fail; this WHERE status = 'pending'
      // AND asset_type = 'fiat' is the real guard.
      const claim = await client.query(`
        UPDATE withdrawal_requests
        SET status = 'approved', admin_notes = $1, approved_by = $2, updated_at = NOW()
        WHERE id = $3 AND status = 'pending' AND asset_type = 'fiat'
      `, [notes, req.user!.id, withdrawalId]);

      if (claim.rowCount === 0) {
        throw new AppError('Withdrawal already processed', 400, 'ALREADY_PROCESSED');
      }

      // The guarded debit MUST affect exactly the one wallet row. If it affects
      // 0 rows (insufficient balance, or the reserve was already released) the
      // money was never debited — approving anyway would pay out funds the user
      // does not have. Throwing here rolls back the whole approval, so the
      // withdrawal stays 'pending' and its transaction is NOT marked SUCCESS.
      //
      // NEW-4: this settles THIS withdrawal's own reserve, so the correct floor
      // is gross balance AND an existing reserve of at least this amount — not
      // available balance (the reserve here is the withdrawal itself). COALESCE
      // stops `NULL - n` from erasing the reserve, which would silently inflate
      // available balance afterwards.
      const debit = await client.query(`
        UPDATE wallets
        SET balance_cents = balance_cents - $1,
            reserved_cents = COALESCE(reserved_cents, 0) - $1,
            updated_at = NOW()
        WHERE user_id = $2 AND currency = $3
          AND balance_cents >= $1
          AND COALESCE(reserved_cents, 0) >= $1
      `, [withdrawal.amount_cents, withdrawal.user_id, withdrawal.currency]);

      if (debit.rowCount !== 1) {
        logger.error('[Admin] Withdrawal approval aborted: guarded wallet debit affected no row', {
          withdrawalId, userId: withdrawal.user_id, currency: withdrawal.currency, rowCount: debit.rowCount,
        });
        throw new AppError('Insufficient balance to settle this withdrawal', 400, 'INSUFFICIENT_BALANCE');
      }

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

    // NEW-1: rejecting here releases a FIAT reserve. A USDT-funded withdrawal
    // never incremented reserved_cents, so decrementing it would drive the
    // reserve negative — which INFLATES available balance (balance - (-x)).
    // Refuse and direct the operator to the USDT resolver.
    if ((withdrawal.asset_type ?? 'fiat') !== 'fiat') {
      throw new AppError(
        'This is a USDT-funded withdrawal. Resolve it via /withdrawals/:id/usdt/settle or /usdt/refund.',
        400,
        'WRONG_ASSET_TYPE',
      );
    }

    // Fail closed: never release a reserve on a legacy row whose funding source
    // was never recorded. (See assertNotLegacyUnverified.)
    assertNotLegacyUnverified(withdrawal);

    if (withdrawal.status !== 'pending') {
      throw new AppError('Withdrawal already processed', 400, 'ALREADY_PROCESSED');
    }

    await transaction(async (client) => {
      // Atomically claim the withdrawal so a concurrent approve/reject cannot
      // both release the reserve (which would corrupt reserved_cents).
      const claim = await client.query(`
        UPDATE withdrawal_requests
        SET status = 'rejected', admin_notes = $1, approved_by = $2, updated_at = NOW()
        WHERE id = $3 AND status = 'pending' AND asset_type = 'fiat'
      `, [reason, req.user!.id, withdrawalId]);

      if (claim.rowCount === 0) {
        throw new AppError('Withdrawal already processed', 400, 'ALREADY_PROCESSED');
      }

      // Release the reserve without letting it go negative or stay NULL. A
      // 0-row result means the reserve was already released, which must abort the
      // rejection rather than silently corrupt the wallet.
      const release = await client.query(`
        UPDATE wallets
        SET reserved_cents = COALESCE(reserved_cents, 0) - $1, updated_at = NOW()
        WHERE user_id = $2 AND currency = $3 AND COALESCE(reserved_cents, 0) >= $1
      `, [withdrawal.amount_cents, withdrawal.user_id, withdrawal.currency]);

      if (release.rowCount !== 1) {
        logger.error('[Admin] Withdrawal rejection aborted: reserve release affected no row', {
          withdrawalId, userId: withdrawal.user_id, currency: withdrawal.currency, rowCount: release.rowCount,
        });
        throw new AppError('Reserved balance does not cover this withdrawal', 400, 'RESERVE_MISMATCH');
      }

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

/**
 * NEW-1: resolution path for USDT-funded withdrawals.
 *
 * A USDT withdrawal (every crypto payout, plus a bank withdrawal funded from the
 * USDT balance) debits `usdt_balance_cents` at request time — there is no USDT
 * reserve column to release. Such a row is created in the 'held' state and was
 * previously unreachable: the fiat approve/reject handlers only accept
 * 'pending', and no worker touched it, so the user's funds were debited with no
 * code path able to settle or refund them.
 *
 * These two endpoints are the only resolvers for that state:
 *   settle — the operator confirms the payout went out; the debit stands.
 *   refund — the operator declines; the debit is reversed atomically.
 *
 * Both claim the row with `WHERE status IN (<allowed>) AND asset_type = 'usdt'` as
 * the FIRST statement in the transaction, so repeated or concurrent resolution
 * produces exactly one effect, and neither touches `balance_cents` or
 * `reserved_cents`.
 *
 * R3-11: the crypto payout path now records its outcome as 'sent' (provider
 * confirmed the broadcast) or 'reconcile' (the call threw or returned an
 * ambiguous outcome, so an on-chain transfer MAY have happened). Both are
 * resolvable by SETTLE — otherwise those rows would be stranded exactly like the
 * original 'held' defect. REFUND stays restricted to 'held': crediting a wallet
 * for a row whose funds may already be on-chain is a double payout, so it is
 * deliberately not reachable through this endpoint and requires out-of-band
 * reconciliation instead.
 */
const USDT_TX_HASH_RE = /^[0-9a-fA-F]{64}$/;

/** States a USDT withdrawal may be SETTLED from (debit stands, no balance change). */
const USDT_SETTLEABLE_STATES = ['held', 'sent', 'reconcile'] as const;
/** States a USDT withdrawal may be REFUNDED from (wallet is credited back). */
const USDT_REFUNDABLE_STATES = ['held'] as const;

/**
 * Legacy-flag marker. A row carrying this in admin_notes was created before the
 * `asset_type` column existed and the funding wallet was never persisted, so it
 * is genuinely ambiguous (fiat-funded vs USDT-funded). The one-time migration
 * flags it for human triage rather than guessing.
 *
 * The runtime contract is FAIL-CLOSED: no money may move — approve, reject,
 * settle or refund — for a flagged row until an operator has manually reconciled
 * its provenance. Otherwise approve could settle a USDT-funded legacy row against
 * a fiat reserve (debit balance_cents on money that came from usdt_balance_cents).
 */
const LEGACY_UNVERIFIED_MARKER = 'LEGACY_ASSET_TYPE_UNVERIFIED';

/** Refuse to move money on a legacy-flagged withdrawal. Fail closed, before any
 *  balance/status mutation. */
function assertNotLegacyUnverified(withdrawal: { admin_notes?: string | null } | null) {
  if (withdrawal?.admin_notes?.includes(LEGACY_UNVERIFIED_MARKER)) {
    throw new AppError(
      'This withdrawal predates asset-type tracking and its funding wallet is unverified. Reconcile it manually before resolving.',
      400,
      'LEGACY_ASSET_TYPE_UNVERIFIED',
    );
  }
}

/** Shared pre-flight: the row must exist, be USDT-funded, and be in an allowed state. */
async function loadUsdtWithdrawalForResolution(withdrawalId: string, allowed: readonly string[]) {
  const withdrawal = await queryOne<any>(`
    SELECT * FROM withdrawal_requests WHERE id = $1
  `, [withdrawalId]);

  if (!withdrawal) {
    throw new AppError('Withdrawal not found', 404, 'NOT_FOUND');
  }
  // Fail closed on a legacy-flagged row even on the USDT path (defense-in-depth;
  // flagged rows are fiat-defaulted today, but no money may move either way).
  assertNotLegacyUnverified(withdrawal);
  if ((withdrawal.asset_type ?? 'fiat') !== 'usdt') {
    throw new AppError(
      'This is a fiat withdrawal. Resolve it via /withdrawals/:id/approve or /reject.',
      400,
      'WRONG_ASSET_TYPE',
    );
  }
  if (!allowed.includes(withdrawal.status)) {
    throw new AppError(
      `This withdrawal cannot be resolved here (current status: ${withdrawal.status}; allowed: ${allowed.join(', ')}).`,
      400,
      'NOT_HELD',
    );
  }
  return withdrawal;
}

/**
 * R3-8: the two statements that finalise the ONE canonical user-visible
 * `transactions` row for a withdrawal.
 *
 * `reference` is the join key both withdrawal paths write (the withdrawal id),
 * and `status = 'PENDING'` scopes the write to a still-unresolved ledger row, so
 * a late resolver cannot stamp SUCCESS over a committed FAILED or vice versa.
 * Held as two literals rather than one interpolated string: nothing here is
 * built from a value, so there is no way for the status to become dynamic.
 */
const FINALISE_WITHDRAWAL_TX_SQL = {
  SUCCESS: `
    UPDATE transactions SET status = 'SUCCESS', updated_at = NOW()
    WHERE reference = $1 AND type = 'withdrawal' AND status = 'PENDING'
  `,
  FAILED: `
    UPDATE transactions SET status = 'FAILED', updated_at = NOW()
    WHERE reference = $1 AND type = 'withdrawal' AND status = 'PENDING'
  `,
} as const;

/**
 * Finalise a withdrawal's canonical transaction row inside the caller's already
 * claimed transaction.
 *
 * The rowCount is CHECKED rather than discarded: silently finalising nothing is
 * how withdrawal state and ledger state diverged permanently — the request
 * reached 'completed'/'rejected' while the user-visible entry stayed PENDING,
 * and a 0-row UPDATE is not an error, so nothing could notice.
 *
 * It is deliberately NOT fatal. A crypto withdrawal created before R3-8 has no
 * canonical row at all, and neither settling funds that already left custody nor
 * returning money the user is owed may be blocked by a missing bookkeeping row —
 * that is exactly how the original defect stranded withdrawals.
 */
async function finaliseWithdrawalTransaction(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rowCount: number | null }> },
  withdrawalId: string,
  intendedStatus: keyof typeof FINALISE_WITHDRAWAL_TX_SQL,
): Promise<void> {
  const finalise = await client.query(FINALISE_WITHDRAWAL_TX_SQL[intendedStatus], [withdrawalId]);

  if (finalise.rowCount !== 1) {
    logger.error('[Admin] USDT resolution finalised no canonical transaction row', {
      withdrawalId, intendedStatus, rowCount: finalise.rowCount,
    });
  }
}

router.post('/withdrawals/:withdrawalId/usdt/settle',
  body('txHash').optional().trim(),
  body('notes').optional().trim(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { withdrawalId } = req.params;
    const { txHash, notes } = req.body;

    if (txHash !== undefined && txHash !== '' && !USDT_TX_HASH_RE.test(String(txHash))) {
      throw new AppError('txHash must be a 64-character hex transaction id', 400, 'VALIDATION_ERROR');
    }

    const priorWithdrawal = await loadUsdtWithdrawalForResolution(withdrawalId as string, USDT_SETTLEABLE_STATES);

    await transaction(async (client) => {
      // Atomic claim FIRST. A concurrent settle/refund that already won leaves
      // this at 0 rows, and we abort without touching any balance.
      const claim = await client.query(`
        UPDATE withdrawal_requests
        SET status = 'completed',
            tx_hash = COALESCE($1, tx_hash),
            admin_notes = $2,
            approved_by = $3,
            updated_at = NOW()
        WHERE id = $4 AND asset_type = 'usdt'
          AND status IN ('held', 'sent', 'reconcile')
      `, [txHash || null, notes ?? 'Settled manually by operator', req.user!.id, withdrawalId]);

      if (claim.rowCount === 0) {
        throw new AppError('Withdrawal already resolved', 400, 'ALREADY_RESOLVED');
      }

      // The USDT was debited when the request was created, so settling makes no
      // balance change. Only the withdrawal transaction record is finalised.
      await finaliseWithdrawalTransaction(client, withdrawalId as string, 'SUCCESS');
    });

    await createAuditLog({
      userId: req.user!.id,
      action: 'USDT_WITHDRAWAL_SETTLED',
      entityType: 'withdrawal',
      entityId: withdrawalId as string,
      oldValues: { status: priorWithdrawal.status },
      newValues: { status: 'completed', txHash: txHash || null, notes },
    });

    res.json({ success: true, message: 'USDT withdrawal settled' });
  })
);

router.post('/withdrawals/:withdrawalId/usdt/refund',
  body('reason').trim().notEmpty(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { withdrawalId } = req.params;
    const { reason } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const withdrawal = await loadUsdtWithdrawalForResolution(withdrawalId as string, USDT_REFUNDABLE_STATES);

    await transaction(async (client) => {
      // Atomic claim FIRST, so the refund below can only run for the single
      // caller that moved the row out of 'held'. This is what makes a duplicate
      // or concurrent refund a no-op instead of a double credit.
      const claim = await client.query(`
        UPDATE withdrawal_requests
        SET status = 'rejected', admin_notes = $1, approved_by = $2, updated_at = NOW()
        WHERE id = $3 AND status = 'held' AND asset_type = 'usdt'
      `, [reason, req.user!.id, withdrawalId]);

      if (claim.rowCount === 0) {
        throw new AppError('Withdrawal already resolved', 400, 'ALREADY_RESOLVED');
      }

      // Restore the USDT that was debited at request time. Same transaction as
      // the claim, so a rollback cannot leave the row rejected but unrefunded.
      const refund = await client.query(`
        UPDATE wallets
        SET usdt_balance_cents = COALESCE(usdt_balance_cents, 0) + $1, updated_at = NOW()
        WHERE user_id = $2 AND currency = $3
      `, [withdrawal.amount_cents, withdrawal.user_id, withdrawal.currency]);

      if (refund.rowCount !== 1) {
        logger.error('[Admin] USDT refund aborted: wallet row not found', {
          withdrawalId, userId: withdrawal.user_id, currency: withdrawal.currency, rowCount: refund.rowCount,
        });
        throw new AppError('Wallet not found for refund', 400, 'WALLET_NOT_FOUND');
      }

      await finaliseWithdrawalTransaction(client, withdrawalId as string, 'FAILED');
    });

    await createAuditLog({
      userId: req.user!.id,
      action: 'USDT_WITHDRAWAL_REFUNDED',
      entityType: 'withdrawal',
      entityId: withdrawalId as string,
      oldValues: { status: 'held' },
      newValues: { status: 'rejected', reason, refundedCents: withdrawal.amount_cents },
    });

    res.json({ success: true, message: 'USDT withdrawal refunded' });
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

        if (type === 'credit') {
          await client.query(`
            INSERT INTO wallets (user_id, currency, balance_cents)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, currency)
            DO UPDATE SET balance_cents = wallets.balance_cents + $3, updated_at = NOW()
          `, [userId, currency, amountCents]);
        } else {
          // A debit may only ever reduce an existing, sufficient balance. The
          // guarded predicate makes an over-debit match 0 rows (and a missing
          // wallet match 0 rows), so it can never drive a balance negative or
          // seed a new wallet at a negative balance. A 0-row result aborts the
          // whole transaction, rolling back the APPROVED adjustment and ledger
          // insert with it.
          // NEW-4: guard on AVAILABLE balance, not gross balance. Guarding only
          // `balance_cents >= $1` let an admin debit consume funds already
          // reserved for a pending withdrawal: balance_cents stayed
          // non-negative, but available (balance - reserved) went negative, which
          // then starves the withdrawal at approval time. COALESCE keeps a NULL
          // reserve from blocking a legitimate debit. This matches every other
          // guarded debit in the tree (payments.ts, transactions.ts, savings.ts,
          // giftCards.ts).
          const debit = await client.query(`
            UPDATE wallets
            SET balance_cents = balance_cents - $1, updated_at = NOW()
            WHERE user_id = $2 AND currency = $3
              AND balance_cents - COALESCE(reserved_cents, 0) >= $1
          `, [amountCents, userId, currency]);
          if (debit.rowCount !== 1) {
            throw new AppError('Insufficient available balance for this debit adjustment', 400, 'INSUFFICIENT_BALANCE');
          }
        }

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

    // R3-7: single-winner claim.
    //
    // This handler used to read the adjustment with an UNLOCKED query outside the
    // transaction, check `status !== 'PENDING'` in application code, and then issue
    // its terminal UPDATE with neither a status predicate nor a rowCount check. Two
    // consequences, both money:
    //   1. two concurrent approvals both passed the check and both ran the additive
    //      credit upsert, so the user was credited TWICE for one adjustment;
    //   2. with no predicate, an approval that lost the race to a REJECTION stamped
    //      APPROVED over the committed REJECTED and paid the money anyway.
    //
    // The claim is now the FIRST statement in the transaction, predicated on
    // PENDING, and it RETURNS the row that every money statement below is driven
    // from — never a stale pre-read (LOW-1). Exactly one concurrent request can see
    // rowCount === 1; the loser throws and the transaction rolls back, so it writes
    // no balance mutation, no ledger row and no audit entry.
    await transaction(async (client) => {
      const claim = await client.query(`
        UPDATE admin_adjustments
        SET status = 'APPROVED', approved_by = $1, updated_at = NOW()
        WHERE id = $2 AND status = 'PENDING'
        RETURNING id, user_id, type, amount_cents, currency, reason
      `, [req.user!.id, adjustmentId]);

      if (claim.rowCount !== 1) {
        // A 0-row claim is NOT automatically "already processed": reload the
        // authoritative row so a missing adjustment is still reported as 404.
        const current = await client.query(`
          SELECT status FROM admin_adjustments WHERE id = $1
        `, [adjustmentId]);
        if (current.rowCount === 0) {
          throw new AppError('Adjustment not found', 404, 'NOT_FOUND');
        }
        throw new AppError('Adjustment already processed', 400, 'ALREADY_PROCESSED');
      }

      const adjustment = claim.rows[0];

      if (adjustment.type === 'credit') {
        await client.query(`
          INSERT INTO wallets (user_id, currency, balance_cents)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, currency)
          DO UPDATE SET balance_cents = wallets.balance_cents + $3, updated_at = NOW()
        `, [adjustment.user_id, adjustment.currency, adjustment.amount_cents]);
      } else {
        // Guarded debit: only reduces an existing, sufficient balance. A 0-row
        // result aborts the transaction so the adjustment stays PENDING and no
        // negative balance is written.
        // NEW-4: guard on AVAILABLE balance so approving a debit adjustment
        // cannot consume funds reserved for a pending withdrawal. A 0-row result
        // aborts the transaction so the adjustment stays PENDING.
        const debit = await client.query(`
          UPDATE wallets
          SET balance_cents = balance_cents - $1, updated_at = NOW()
          WHERE user_id = $2 AND currency = $3
            AND balance_cents - COALESCE(reserved_cents, 0) >= $1
        `, [adjustment.amount_cents, adjustment.user_id, adjustment.currency]);
        if (debit.rowCount !== 1) {
          throw new AppError('Insufficient available balance for this debit adjustment', 400, 'INSUFFICIENT_BALANCE');
        }
      }

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

    // LOW-6: the PENDING predicate was already here, but the result was discarded.
    // A rejection that changed nothing still answered `{ success: true }` and still
    // wrote an ADJUSTMENT_REJECTED audit entry, so the log showed a rejection that
    // never happened. Claim with RETURNING and check the result.
    //
    // `pool.query()` resolves to `result.rows` — an ARRAY with no `.rowCount` — so
    // the row count is the array length here, not a `rowCount` property.
    const claimed = await query<{ id: string }>(`
      UPDATE admin_adjustments
      SET status = 'REJECTED', approved_by = $1, updated_at = NOW()
      WHERE id = $2 AND status = 'PENDING'
      RETURNING id
    `, [req.user!.id, adjustmentId]);

    if (claimed.length !== 1) {
      const current = await queryOne<{ status: string }>(`
        SELECT status FROM admin_adjustments WHERE id = $1
      `, [adjustmentId]);
      if (!current) {
        throw new AppError('Adjustment not found', 404, 'NOT_FOUND');
      }
      throw new AppError('Adjustment already processed', 400, 'ALREADY_PROCESSED');
    }

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
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
  const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);
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
    limit: Math.min(parseInt(req.query.limit as string, 10) || 100, 500),
    offset: Math.max(0, parseInt(req.query.offset as string, 10) || 0),
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
    limit: Math.min(parseInt(req.query.limit as string, 10) || 100, 500),
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
  res.json({
    success: true,
    data: { configured: isFluzConfigured() },
  });
}));

router.get('/gift-card-requests', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 500);
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
           gcr.rate, gcr.cost_cents, gcr.profit_cents, gcr.market_rate, gcr.our_rate,
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

// Gift card profit analytics
router.get('/gift-cards/analytics', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const days = Math.min(Math.max(parseInt(req.query.days as string, 10) || 30, 1), 365);

  const analytics = await query(`
    SELECT 
      COUNT(*) FILTER (WHERE type = 'buy' AND status = 'completed') as total_sales,
      COUNT(*) FILTER (WHERE type = 'sell' AND status = 'completed') as total_purchases,
      COALESCE(SUM(profit_cents) FILTER (WHERE status = 'completed'), 0) as total_profit_cents,
      COALESCE(SUM(cost_cents) FILTER (WHERE status = 'completed'), 0) as total_cost_cents,
      COALESCE(SUM(amount_cents) FILTER (WHERE type = 'buy' AND status = 'completed'), 0) as revenue_cents,
      COUNT(DISTINCT brand) as unique_brands,
      AVG(profit_cents) FILTER (WHERE status = 'completed' AND profit_cents > 0) as avg_profit_per_transaction
    FROM gift_card_requests
    WHERE created_at > NOW() - ($1 * INTERVAL '1 day')
  `, [days]);

  const topBrands = await query(`
    SELECT 
      brand,
      COUNT(*) as transaction_count,
      SUM(profit_cents) as total_profit_cents,
      AVG(profit_cents) as avg_profit_cents,
      SUM(amount_cents) as total_volume_cents
    FROM gift_card_requests
    WHERE status = 'completed' AND created_at > NOW() - ($1 * INTERVAL '1 day')
    GROUP BY brand
    ORDER BY total_profit_cents DESC NULLS LAST
    LIMIT 10
  `, [days]);

  const profitByDay = await query(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as transactions,
      SUM(profit_cents) as profit_cents,
      SUM(cost_cents) as cost_cents
    FROM gift_card_requests
    WHERE status = 'completed' AND created_at > NOW() - ($1 * INTERVAL '1 day')
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `, [days]);

  res.json({
    success: true,
    data: {
      summary: analytics[0],
      topBrands,
      profitByDay
    }
  });
}));

// Security monitoring endpoints
router.get('/security/events', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 500);
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
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 500);
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
