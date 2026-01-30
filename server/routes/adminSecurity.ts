import { Router, Response } from 'express';
import { query, queryOne } from '../db/pool';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest, requireRole } from '../middleware/auth';
import { addToBlacklist, removeFromBlacklist, getBlacklistedIPs } from '../middleware/security';
import { createAuditLog } from '../services/auditService';

const router = Router();
router.use(authenticate);
router.use(requireRole('SUPER_ADMIN'));

// Security Dashboard Overview
router.get('/overview', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const [loginStats, fraudStats, securityEvents, activeUsers] = await Promise.all([
    queryOne<any>(`
      SELECT 
        COUNT(*) FILTER (WHERE success = TRUE) as successful_logins,
        COUNT(*) FILTER (WHERE success = FALSE) as failed_logins,
        COUNT(DISTINCT email) FILTER (WHERE success = FALSE) as unique_failed_emails
      FROM login_attempts
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `),
    queryOne<any>(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'active') as active_flags,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved_flags,
        COUNT(*) as total_flags
      FROM fraud_flags
      WHERE created_at > NOW() - INTERVAL '7 days'
    `),
    query(`
      SELECT action, COUNT(*) as count
      FROM audit_logs
      WHERE action IN ('LOGIN_FAILED', 'CARD_FROZEN', 'WITHDRAWAL_REJECTED', 'FRAUD_DETECTED', 'ACCOUNT_LOCKED')
        AND created_at > NOW() - INTERVAL '24 hours'
      GROUP BY action
      ORDER BY count DESC
    `),
    queryOne<any>(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM sessions
      WHERE is_active = TRUE AND expires_at > NOW()
    `),
  ]);

  res.json({
    success: true,
    data: {
      loginStats: {
        successful: parseInt(loginStats?.successful_logins || '0'),
        failed: parseInt(loginStats?.failed_logins || '0'),
        uniqueFailedEmails: parseInt(loginStats?.unique_failed_emails || '0'),
      },
      fraudStats: {
        active: parseInt(fraudStats?.active_flags || '0'),
        resolved: parseInt(fraudStats?.resolved_flags || '0'),
        total: parseInt(fraudStats?.total_flags || '0'),
      },
      securityEvents,
      activeUsers: parseInt(activeUsers?.count || '0'),
      blacklistedIPs: getBlacklistedIPs().length,
    },
  });
}));

// Get failed login attempts
router.get('/failed-logins', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  
  const attempts = await query(`
    SELECT email, ip_address, user_agent, failure_reason, created_at
    FROM login_attempts
    WHERE success = FALSE
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit]);

  // Group by email
  const byEmail = attempts.reduce((acc: any, attempt: any) => {
    if (!acc[attempt.email]) {
      acc[attempt.email] = { count: 0, lastAttempt: attempt.created_at, ips: new Set() };
    }
    acc[attempt.email].count++;
    acc[attempt.email].ips.add(attempt.ip_address);
    return acc;
  }, {});

  const suspicious = Object.entries(byEmail)
    .filter(([_, data]: [string, any]) => data.count >= 3)
    .map(([email, data]: [string, any]) => ({
      email,
      attempts: data.count,
      uniqueIPs: data.ips.size,
      lastAttempt: data.lastAttempt,
    }))
    .sort((a, b) => b.attempts - a.attempts);

  res.json({ success: true, data: { recentAttempts: attempts.slice(0, 50), suspiciousAccounts: suspicious } });
}));

// Get IP blacklist
router.get('/blacklist', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: { blacklistedIPs: getBlacklistedIPs() } });
}));

// Add IP to blacklist
router.post('/blacklist', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { ip, reason } = req.body;
  
  if (!ip || !/^[\d\.\:a-fA-F]+$/.test(ip)) {
    throw new AppError('Invalid IP address', 400, 'INVALID_IP');
  }

  addToBlacklist(ip);

  await createAuditLog({
    userId: req.user!.id,
    action: 'IP_BLACKLISTED',
    entityType: 'security',
    newValues: { ip, reason },
  });

  res.json({ success: true, message: `IP ${ip} added to blacklist` });
}));

// Remove IP from blacklist
router.delete('/blacklist/:ip', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { ip } = req.params;
  
  removeFromBlacklist(ip);

  await createAuditLog({
    userId: req.user!.id,
    action: 'IP_UNBLACKLISTED',
    entityType: 'security',
    newValues: { ip },
  });

  res.json({ success: true, message: `IP ${ip} removed from blacklist` });
}));

// Get active sessions
router.get('/sessions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const sessions = await query(`
    SELECT s.id, s.user_id, s.ip_address, s.user_agent, s.created_at, s.last_used_at, s.expires_at,
           u.email, u.full_name
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.is_active = TRUE AND s.expires_at > NOW()
    ORDER BY s.last_used_at DESC
    LIMIT 100
  `);

  res.json({ success: true, data: { sessions } });
}));

// Force logout all sessions for a user
router.post('/force-logout/:userId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params;
  const { reason } = req.body;

  await query(`
    UPDATE sessions SET is_active = FALSE
    WHERE user_id = $1 AND is_active = TRUE
  `, [userId]);

  await createAuditLog({
    userId: req.user!.id,
    action: 'FORCE_LOGOUT',
    entityType: 'user',
    entityId: userId,
    newValues: { reason },
  });

  res.json({ success: true, message: 'All sessions terminated' });
}));

// Get security audit log
router.get('/audit', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const securityActions = [
    'LOGIN_FAILED', 'LOGIN_SUCCESS', 'PASSWORD_RESET', 'TWO_FACTOR_ENABLED',
    'TWO_FACTOR_DISABLED', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED', 'IP_BLACKLISTED',
    'FORCE_LOGOUT', 'FRAUD_DETECTED', 'WITHDRAWAL_REJECTED', 'CARD_FROZEN'
  ];

  const logs = await query(`
    SELECT al.*, u.email, u.full_name
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE al.action = ANY($1)
    ORDER BY al.created_at DESC
    LIMIT $2
  `, [securityActions, limit]);

  res.json({ success: true, data: { logs } });
}));

// Lock user account
router.post('/lock-account/:userId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params;
  const { reason, duration } = req.body;
  
  const lockUntil = duration ? new Date(Date.now() + duration * 60 * 1000) : null;

  await query(`
    UPDATE users SET account_status = 'suspended', locked_until = $1
    WHERE id = $2
  `, [lockUntil, userId]);

  await query(`
    UPDATE sessions SET is_active = FALSE WHERE user_id = $1
  `, [userId]);

  await createAuditLog({
    userId: req.user!.id,
    action: 'ACCOUNT_LOCKED',
    entityType: 'user',
    entityId: userId,
    newValues: { reason, lockUntil },
  });

  res.json({ success: true, message: 'Account locked' });
}));

// Unlock user account
router.post('/unlock-account/:userId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params;

  await query(`
    UPDATE users SET account_status = 'active', locked_until = NULL, failed_login_attempts = 0
    WHERE id = $1
  `, [userId]);

  await createAuditLog({
    userId: req.user!.id,
    action: 'ACCOUNT_UNLOCKED',
    entityType: 'user',
    entityId: userId,
  });

  res.json({ success: true, message: 'Account unlocked' });
}));

export { router as adminSecurityRouter };
