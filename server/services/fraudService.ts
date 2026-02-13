import { query, queryOne } from '../db/pool';
import { logger } from '../middleware/logger';
import { createNotification } from './notificationService';

interface FraudCheckParams {
  userId: string;
  action: 'LOGIN' | 'P2P_TRANSFER' | 'TRANSFER' | 'WITHDRAWAL' | 'CARD_PAYMENT' | 'CARD_CREATION';
  amount?: number;
  ipAddress?: string;
  metadata?: Record<string, any>;
}

interface TransactionLimits {
  dailyLimit: number;
  weeklyLimit: number;
  monthlyLimit: number;
  singleTransactionLimit: number;
}

const DEFAULT_LIMITS: TransactionLimits = {
  dailyLimit: 500000, // $5,000 per day
  weeklyLimit: 2000000, // $20,000 per week
  monthlyLimit: 5000000, // $50,000 per month
  singleTransactionLimit: 100000, // $1,000 single transaction
};

export async function checkLoginVelocity(email: string, ipAddress?: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const recentFailures = await queryOne<{ count: string }>(`
      SELECT COUNT(*) as count FROM login_attempts
      WHERE email = $1 AND success = FALSE AND created_at > NOW() - INTERVAL '1 hour'
    `, [email]);

    const failCount = parseInt(recentFailures?.count || '0');
    if (failCount >= 10) {
      logger.warn(`[Fraud] Login velocity check failed - too many failed attempts for email ${email}: ${failCount} failures`);
      return { allowed: false, reason: 'Too many failed login attempts. Please try again later.' };
    }

    if (ipAddress) {
      const ipFailures = await queryOne<{ count: string }>(`
        SELECT COUNT(*) as count FROM login_attempts
        WHERE ip_address = $1 AND success = FALSE AND created_at > NOW() - INTERVAL '1 hour'
      `, [ipAddress]);

      const ipFailCount = parseInt(ipFailures?.count || '0');
      if (ipFailCount >= 20) {
        logger.warn(`[Fraud] Login velocity check failed - too many failures from IP ${ipAddress}: ${ipFailCount} failures`);
        return { allowed: false, reason: 'Too many failed login attempts from this location.' };
      }
    }

    return { allowed: true };
  } catch (error) {
    logger.error('[Fraud] Error checking login velocity:', error);
    return { allowed: true };
  }
}

export async function runFraudChecks(params: FraudCheckParams): Promise<{ passed: boolean; flags: string[]; score: number }> {
  const flags: string[] = [];
  let riskScore = 0;

  try {
    // Check 1: Login velocity (multiple failed logins)
    if (params.action === 'LOGIN') {
      const user = await queryOne<{ email: string }>('SELECT email FROM users WHERE id = $1', [params.userId]);
      if (user) {
        const recentFailures = await queryOne<{ count: string }>(`
          SELECT COUNT(*) as count FROM login_attempts
          WHERE email = $1 AND success = FALSE AND created_at > NOW() - INTERVAL '1 hour'
        `, [user.email]);

        const failCount = parseInt(recentFailures?.count || '0');
        if (failCount >= 5) {
          flags.push('HIGH_LOGIN_FAILURE_RATE');
          riskScore += 30;
        }
      }
    }

    // Check 2: High velocity transfers
    if (params.action === 'P2P_TRANSFER' && params.amount) {
      const recentTransfers = await queryOne<{ total: string; count: string }>(`
        SELECT COALESCE(SUM(amount_cents), 0) as total, COUNT(*) as count
        FROM transactions
        WHERE user_id = $1 AND type = 'transfer_out' AND status = 'SUCCESS'
          AND created_at > NOW() - INTERVAL '1 hour'
      `, [params.userId]);

      const hourlyTotal = parseInt(recentTransfers?.total || '0');
      const hourlyCount = parseInt(recentTransfers?.count || '0');

      if (hourlyCount >= 10) {
        flags.push('HIGH_VELOCITY_TRANSFERS');
        riskScore += 25;
      }

      if (hourlyTotal > 50000) { // $500 in 1 hour
        flags.push('HIGH_HOURLY_VOLUME');
        riskScore += 20;
      }
    }

    // Check 3: Transaction limits
    if (params.amount && ['P2P_TRANSFER', 'WITHDRAWAL', 'CARD_PAYMENT'].includes(params.action)) {
      const limitCheck = await checkTransactionLimits(params.userId, params.amount);
      if (!limitCheck.withinLimits) {
        flags.push(...limitCheck.exceededLimits);
        riskScore += 40;
      }
    }

    // Check 4: Large single transaction
    if (params.amount && params.amount > DEFAULT_LIMITS.singleTransactionLimit) {
      flags.push('LARGE_SINGLE_TRANSACTION');
      riskScore += 15;
    }

    // Check 5: Unusual withdrawal pattern
    if (params.action === 'WITHDRAWAL') {
      const recentWithdrawals = await queryOne<{ count: string }>(`
        SELECT COUNT(*) as count FROM withdrawal_requests
        WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
      `, [params.userId]);

      if (parseInt(recentWithdrawals?.count || '0') >= 3) {
        flags.push('MULTIPLE_WITHDRAWAL_REQUESTS');
        riskScore += 20;
      }
    }

    // Check 6: New account making large transactions
    if (params.amount && params.amount > 10000) { // > $100
      const accountAge = await queryOne<{ created_at: string }>(`
        SELECT created_at FROM users WHERE id = $1
      `, [params.userId]);

      if (accountAge) {
        const daysSinceCreation = (Date.now() - new Date(accountAge.created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceCreation < 7) {
          flags.push('NEW_ACCOUNT_HIGH_VALUE');
          riskScore += 25;
        }
      }
    }

    // Check 7: IP/Device Mismatch Detection
    if (params.ipAddress) {
      const knownDevices = await query<{ ip_address: string; is_trusted: boolean }>(`
        SELECT ip_address, is_trusted FROM user_devices WHERE user_id = $1
      `, [params.userId]);

      const isKnownIP = knownDevices.some(d => d.ip_address === params.ipAddress);
      const hasTrustedDevices = knownDevices.some(d => d.is_trusted);

      if (!isKnownIP && knownDevices.length > 0) {
        // New IP for an existing user
        flags.push('NEW_IP_ADDRESS');
        riskScore += 15;

        if (hasTrustedDevices) {
          // User has trusted devices but is using a new IP
          flags.push('UNRECOGNIZED_LOCATION');
          riskScore += 20;
        }
      }
    }

    // Check 8: Unverified account making transactions
    const user = await queryOne<{ kyc_status: string; email_verified: boolean }>(`
      SELECT kyc_status, email_verified FROM users WHERE id = $1
    `, [params.userId]);

    if (user && !user.email_verified) {
      flags.push('EMAIL_NOT_VERIFIED');
      riskScore += 15;
    }

    if (user && (user.kyc_status || '').toLowerCase() !== 'approved' && params.amount && params.amount > 50000) {
      flags.push('KYC_NOT_APPROVED_HIGH_VALUE');
      riskScore += 30;
    }

    // Log flags if detected
    if (flags.length > 0) {
      logger.warn(`[Fraud] Flags detected for user ${params.userId}:`, { flags, riskScore, action: params.action });

      // Create fraud flag record if high risk
      if (riskScore >= 50) {
        await query(`
          INSERT INTO fraud_flags (user_id, flag_type, risk_score, metadata, status)
          VALUES ($1, $2, $3, $4, 'active')
        `, [params.userId, flags.join(','), riskScore, JSON.stringify({ action: params.action, amount: params.amount })]);

        // Notify user
        await createNotification({
          userId: params.userId,
          type: 'security_alert',
          title: 'Unusual Activity Detected',
          message: 'We noticed unusual activity on your account. Please verify your recent transactions.',
          metadata: { flags, riskScore },
        });
      }
    }

    return {
      passed: riskScore < 70,
      flags,
      score: riskScore,
    };
  } catch (err) {
    logger.error('[Fraud] Error running fraud checks:', err);
    return { passed: true, flags: [], score: 0 };
  }
}

async function checkTransactionLimits(userId: string, amountCents: number): Promise<{ withinLimits: boolean; exceededLimits: string[] }> {
  const exceededLimits: string[] = [];

  // Get user's transaction totals
  const [dailyTotal, weeklyTotal, monthlyTotal] = await Promise.all([
    queryOne<{ total: string }>(`
      SELECT COALESCE(SUM(amount_cents), 0) as total
      FROM transactions
      WHERE user_id = $1 AND type IN ('transfer_out', 'withdrawal')
        AND status = 'SUCCESS' AND created_at > NOW() - INTERVAL '24 hours'
    `, [userId]),
    queryOne<{ total: string }>(`
      SELECT COALESCE(SUM(amount_cents), 0) as total
      FROM transactions
      WHERE user_id = $1 AND type IN ('transfer_out', 'withdrawal')
        AND status = 'SUCCESS' AND created_at > NOW() - INTERVAL '7 days'
    `, [userId]),
    queryOne<{ total: string }>(`
      SELECT COALESCE(SUM(amount_cents), 0) as total
      FROM transactions
      WHERE user_id = $1 AND type IN ('transfer_out', 'withdrawal')
        AND status = 'SUCCESS' AND created_at > NOW() - INTERVAL '30 days'
    `, [userId]),
  ]);

  const daily = parseInt(dailyTotal?.total || '0') + amountCents;
  const weekly = parseInt(weeklyTotal?.total || '0') + amountCents;
  const monthly = parseInt(monthlyTotal?.total || '0') + amountCents;

  if (daily > DEFAULT_LIMITS.dailyLimit) {
    exceededLimits.push('DAILY_LIMIT_EXCEEDED');
  }
  if (weekly > DEFAULT_LIMITS.weeklyLimit) {
    exceededLimits.push('WEEKLY_LIMIT_EXCEEDED');
  }
  if (monthly > DEFAULT_LIMITS.monthlyLimit) {
    exceededLimits.push('MONTHLY_LIMIT_EXCEEDED');
  }

  return {
    withinLimits: exceededLimits.length === 0,
    exceededLimits,
  };
}

export async function getUserTransactionLimits(userId: string): Promise<{
  limits: TransactionLimits;
  usage: { daily: number; weekly: number; monthly: number };
}> {
  const [dailyTotal, weeklyTotal, monthlyTotal] = await Promise.all([
    queryOne<{ total: string }>(`
      SELECT COALESCE(SUM(amount_cents), 0) as total
      FROM transactions
      WHERE user_id = $1 AND type IN ('transfer_out', 'withdrawal')
        AND status = 'SUCCESS' AND created_at > NOW() - INTERVAL '24 hours'
    `, [userId]),
    queryOne<{ total: string }>(`
      SELECT COALESCE(SUM(amount_cents), 0) as total
      FROM transactions
      WHERE user_id = $1 AND type IN ('transfer_out', 'withdrawal')
        AND status = 'SUCCESS' AND created_at > NOW() - INTERVAL '7 days'
    `, [userId]),
    queryOne<{ total: string }>(`
      SELECT COALESCE(SUM(amount_cents), 0) as total
      FROM transactions
      WHERE user_id = $1 AND type IN ('transfer_out', 'withdrawal')
        AND status = 'SUCCESS' AND created_at > NOW() - INTERVAL '30 days'
    `, [userId]),
  ]);

  return {
    limits: DEFAULT_LIMITS,
    usage: {
      daily: parseInt(dailyTotal?.total || '0'),
      weekly: parseInt(weeklyTotal?.total || '0'),
      monthly: parseInt(monthlyTotal?.total || '0'),
    },
  };
}

export async function clearFraudFlag(flagId: string, adminId: string, resolution: string): Promise<boolean> {
  try {
    await query(`
      UPDATE fraud_flags 
      SET status = 'resolved', resolved_by = $1, resolution = $2, resolved_at = NOW()
      WHERE id = $3
    `, [adminId, resolution, flagId]);
    return true;
  } catch (err) {
    logger.error('[Fraud] Error clearing fraud flag:', err);
    return false;
  }
}

interface GetFraudFlagsParams {
  userId?: string;
  status?: string;
  severity?: string;
  limit?: number;
}

export async function getFraudFlags(params: GetFraudFlagsParams): Promise<any[]> {
  try {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (params.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      values.push(params.userId);
    }

    if (params.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(params.status);
    }

    if (params.severity) {
      conditions.push(`severity = $${paramIndex++}`);
      values.push(params.severity);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = params.limit || 100;

    const flags = await query(`
      SELECT ff.*, u.email as user_email, u.full_name as user_name
      FROM fraud_flags ff
      LEFT JOIN users u ON ff.user_id = u.id
      ${whereClause}
      ORDER BY ff.created_at DESC
      LIMIT ${limit}
    `, values);

    return flags;
  } catch (err) {
    logger.error('[Fraud] Error getting fraud flags:', err);
    return [];
  }
}
