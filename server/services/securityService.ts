import { query, queryOne } from '../db/pool';
import { logger } from '../middleware/logger';
import crypto from 'crypto';

/**
 * Fraud Detection Service
 * Monitors suspicious activities and flags high-risk transactions
 */

interface FraudScore {
  score: number; // 0-100
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasons: string[];
}

interface TransactionContext {
  userId: string;
  amount: number;
  currency: string;
  merchantName: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

/**
 * Calculate fraud score for a transaction
 */
export async function calculateFraudScore(context: TransactionContext): Promise<FraudScore> {
  const reasons: string[] = [];
  let score = 0;

  try {
    // 1. Check transaction amount anomaly
    const userTransactions = await query(`
      SELECT amount_cents FROM transactions 
      WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'
      ORDER BY amount_cents DESC
      LIMIT 10
    `, [context.userId]);

    if (userTransactions.rows.length > 0) {
      const amounts = userTransactions.rows.map((t: any) => t.amount_cents / 100);
      const avgAmount = amounts.reduce((a: number, b: number) => a + b, 0) / amounts.length;
      const maxAmount = Math.max(...amounts);

      if (context.amount > maxAmount * 2) {
        score += 25;
        reasons.push('Transaction amount significantly higher than usual');
      } else if (context.amount > avgAmount * 3) {
        score += 15;
        reasons.push('Transaction amount higher than average');
      }
    }

    // 2. Check velocity (multiple transactions in short time)
    const recentTransactions = await queryOne(`
      SELECT COUNT(*) as count FROM transactions 
      WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'
    `, [context.userId]);

    if (recentTransactions?.count > 5) {
      score += 20;
      reasons.push('High transaction velocity detected');
    }

    // 3. Check for new merchant
    const merchantHistory = await queryOne(`
      SELECT COUNT(*) as count FROM transactions 
      WHERE user_id = $1 AND merchant_name = $2
    `, [context.userId, context.merchantName]);

    if (merchantHistory?.count === 0) {
      score += 10;
      reasons.push('First transaction with this merchant');
    }

    // 4. Check for unusual time of transaction
    const hour = new Date().getHours();
    if (hour >= 23 || hour <= 5) {
      score += 5;
      reasons.push('Transaction during unusual hours');
    }

    // 5. Check for IP address change
    const lastIp = await queryOne(`
      SELECT ip_address FROM transactions 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 1
    `, [context.userId]);

    if (lastIp && lastIp.ip_address !== context.ipAddress) {
      score += 15;
      reasons.push('Transaction from new IP address');
    }

    // 6. Check account age
    const userAccount = await queryOne(`
      SELECT created_at FROM users WHERE id = $1
    `, [context.userId]);

    if (userAccount) {
      const accountAgeDays = Math.floor(
        (Date.now() - new Date(userAccount.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (accountAgeDays < 7) {
        score += 20;
        reasons.push('Account less than 7 days old');
      } else if (accountAgeDays < 30) {
        score += 10;
        reasons.push('Account less than 30 days old');
      }
    }

    // 7. Check for card testing pattern (small amounts)
    if (context.amount < 5) {
      score += 10;
      reasons.push('Very small transaction amount (possible card testing)');
    }

  } catch (error) {
    logger.error('fraud_score_calculation_error', { userId: context.userId, error });
  }

  // Determine risk level
  let risk: FraudScore['risk'] = 'LOW';
  if (score >= 80) {
    risk = 'CRITICAL';
  } else if (score >= 60) {
    risk = 'HIGH';
  } else if (score >= 40) {
    risk = 'MEDIUM';
  }

  return { score: Math.min(score, 100), risk, reasons };
}

/**
 * Log fraud event for monitoring
 */
export async function logFraudEvent(
  userId: string,
  fraudScore: FraudScore,
  transactionId: string
) {
  try {
    if (fraudScore.risk !== 'LOW') {
      await query(`
        INSERT INTO fraud_logs (user_id, transaction_id, fraud_score, risk_level, reasons)
        VALUES ($1, $2, $3, $4, $5)
      `, [userId, transactionId, fraudScore.score, fraudScore.risk, JSON.stringify(fraudScore.reasons)]);

      logger.warn('fraud_event_logged', { userId, transactionId, risk: fraudScore.risk, score: fraudScore.score });
    }
  } catch (error) {
    logger.error('fraud_event_log_error', { userId, error });
  }
}

/**
 * Validate and sanitize user input
 */
export function sanitizeInput(input: string, maxLength: number = 255): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>\"']/g, '') // Remove potential XSS characters
    .replace(/[;--]/g, ''); // Remove potential SQL injection characters
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate amount (in cents)
 */
export function validateAmount(amountCents: number, minCents: number = 100, maxCents: number = 250000): boolean {
  return Number.isInteger(amountCents) && amountCents >= minCents && amountCents <= maxCents;
}

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash sensitive data
 */
export function hashSensitiveData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Check if account is locked due to suspicious activity
 */
export async function isAccountLocked(userId: string): Promise<boolean> {
  try {
    const lockRecord = await queryOne(`
      SELECT locked_until FROM account_locks 
      WHERE user_id = $1 AND locked_until > NOW()
      LIMIT 1
    `, [userId]);

    return !!lockRecord;
  } catch (error) {
    logger.error('account_lock_check_error', { userId, error });
    return false;
  }
}

/**
 * Lock account temporarily
 */
export async function lockAccount(userId: string, durationMinutes: number = 30) {
  try {
    await query(`
      INSERT INTO account_locks (user_id, locked_until, reason)
      VALUES ($1, NOW() + INTERVAL '${durationMinutes} minutes', 'Suspicious activity detected')
      ON CONFLICT (user_id) DO UPDATE 
      SET locked_until = NOW() + INTERVAL '${durationMinutes} minutes'
    `, [userId]);

    logger.warn('account_locked', { userId, durationMinutes });
  } catch (error) {
    logger.error('account_lock_error', { userId, error });
  }
}

/**
 * Unlock account
 */
export async function unlockAccount(userId: string) {
  try {
    await query(`DELETE FROM account_locks WHERE user_id = $1`, [userId]);
    logger.info('account_unlocked', { userId });
  } catch (error) {
    logger.error('account_unlock_error', { userId, error });
  }
}

/**
 * Create fraud logs table if not exists
 */
export async function initializeFraudTables() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS fraud_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        transaction_id UUID,
        fraud_score INT,
        risk_level VARCHAR(20),
        reasons JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS account_locks (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        locked_until TIMESTAMP,
        reason VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_fraud_logs_user_id ON fraud_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_fraud_logs_created_at ON fraud_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_account_locks_locked_until ON account_locks(locked_until);
    `);

    logger.info('fraud_tables_initialized');
  } catch (error) {
    logger.error('fraud_tables_init_error', { error });
  }
}
