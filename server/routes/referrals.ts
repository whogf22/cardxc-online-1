import { Router, Response } from 'express';
import { query, queryOne, transaction } from '../db/pool';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { createNotification } from '../services/notificationService';
import { createAuditLog } from '../services/auditService';
import { logger } from '../middleware/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);

const REFERRAL_BONUS_CENTS = 1000; // $10 bonus for both parties

// Generate referral code for user
function generateReferralCode(): string {
  return 'CXC' + uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
}

// Get user's referral info
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  let user = await queryOne<any>(`
    SELECT referral_code FROM users WHERE id = $1
  `, [req.user!.id]);

  // Generate referral code if doesn't exist
  if (!user?.referral_code) {
    const code = generateReferralCode();
    await query(`UPDATE users SET referral_code = $1 WHERE id = $2`, [code, req.user!.id]);
    user = { referral_code: code };
  }

  // Get referral stats
  const stats = await queryOne<any>(`
    SELECT 
      COUNT(*) FILTER (WHERE status = 'completed') as successful_referrals,
      COUNT(*) FILTER (WHERE status = 'pending') as pending_referrals,
      COALESCE(SUM(bonus_cents) FILTER (WHERE status = 'completed'), 0) as total_earned_cents
    FROM referrals
    WHERE referrer_id = $1
  `, [req.user!.id]);

  res.json({
    success: true,
    data: {
      referralCode: user.referral_code,
      referralLink: `${process.env.VITE_APP_DOMAIN || 'https://cardxc.com'}/signup?ref=${user.referral_code}`,
      stats: {
        successfulReferrals: parseInt(stats?.successful_referrals || '0'),
        pendingReferrals: parseInt(stats?.pending_referrals || '0'),
        totalEarned: parseInt(stats?.total_earned_cents || '0') / 100,
      },
    },
  });
}));

// Get list of referrals
router.get('/list', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const referrals = await query(`
    SELECT r.id, r.status, r.bonus_cents, r.created_at, r.completed_at,
           u.email, u.full_name
    FROM referrals r
    LEFT JOIN users u ON r.referred_id = u.id
    WHERE r.referrer_id = $1
    ORDER BY r.created_at DESC
    LIMIT 50
  `, [req.user!.id]);

  const formatted = referrals.map(r => ({
    id: r.id,
    referredUser: r.full_name || r.email?.split('@')[0] || 'Pending',
    status: r.status,
    bonus: (r.bonus_cents || 0) / 100,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  }));

  res.json({ success: true, data: { referrals: formatted } });
}));

// Validate referral code (used during signup)
router.get('/validate/:code', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const code = req.params.code as string;
  
  const referrer = await queryOne<any>(`
    SELECT id, full_name FROM users WHERE referral_code = $1
  `, [code.toUpperCase()]);

  if (!referrer) {
    throw new AppError('Invalid referral code', 400, 'INVALID_REFERRAL_CODE');
  }

  res.json({
    success: true,
    data: {
      valid: true,
      referrerName: referrer.full_name?.split(' ')[0] || 'A CardXC user',
      bonus: REFERRAL_BONUS_CENTS / 100,
    },
  });
}));

// Complete referral (called internally when referred user makes first deposit)
export async function completeReferral(referredUserId: string): Promise<boolean> {
  try {
    const referral = await queryOne<any>(`
      SELECT r.id, r.referrer_id, r.bonus_cents
      FROM referrals r
      WHERE r.referred_id = $1 AND r.status = 'pending'
    `, [referredUserId]);

    if (!referral) {
      return false; // No pending referral
    }

    await transaction(async (client) => {
      // Update referral status
      await client.query(`
        UPDATE referrals SET status = 'completed', completed_at = NOW()
        WHERE id = $1
      `, [referral.id]);

      // Credit referrer wallet
      await client.query(`
        INSERT INTO wallets (user_id, currency, balance_cents)
        VALUES ($1, 'USD', $2)
        ON CONFLICT (user_id, currency)
        DO UPDATE SET balance_cents = wallets.balance_cents + $2
      `, [referral.referrer_id, referral.bonus_cents]);

      // Credit referred user wallet
      await client.query(`
        INSERT INTO wallets (user_id, currency, balance_cents)
        VALUES ($1, 'USD', $2)
        ON CONFLICT (user_id, currency)
        DO UPDATE SET balance_cents = wallets.balance_cents + $2
      `, [referredUserId, referral.bonus_cents]);

      // Create transactions
      await client.query(`
        INSERT INTO transactions (user_id, type, status, amount_cents, currency, description)
        VALUES ($1, 'deposit', 'SUCCESS', $2, 'USD', 'Referral bonus')
      `, [referral.referrer_id, referral.bonus_cents]);

      await client.query(`
        INSERT INTO transactions (user_id, type, status, amount_cents, currency, description)
        VALUES ($1, 'deposit', 'SUCCESS', $2, 'USD', 'Welcome referral bonus')
      `, [referredUserId, referral.bonus_cents]);
    });

    // Notify referrer
    await createNotification({
      userId: referral.referrer_id,
      type: 'promotion',
      title: 'Referral Bonus Received!',
      message: `You earned $${(referral.bonus_cents / 100).toFixed(2)} from a successful referral!`,
      metadata: { bonus: referral.bonus_cents },
    });

    // Notify referred user
    await createNotification({
      userId: referredUserId,
      type: 'promotion',
      title: 'Welcome Bonus!',
      message: `You received $${(referral.bonus_cents / 100).toFixed(2)} welcome bonus!`,
      metadata: { bonus: referral.bonus_cents },
    });

    return true;
  } catch (err) {
    logger.error('[Referral] Error completing referral', { error: err instanceof Error ? err.message : 'Unknown error' });
    return false;
  }
}

// Admin: Check referral for new signup
export async function createReferralPending(referredUserId: string, referralCode: string): Promise<boolean> {
  try {
    const referrer = await queryOne<any>(`
      SELECT id FROM users WHERE referral_code = $1
    `, [referralCode.toUpperCase()]);

    if (!referrer || referrer.id === referredUserId) {
      return false;
    }

    await query(`
      INSERT INTO referrals (referrer_id, referred_id, referral_code, bonus_cents)
      VALUES ($1, $2, $3, $4)
    `, [referrer.id, referredUserId, referralCode.toUpperCase(), REFERRAL_BONUS_CENTS]);

    await query(`
      UPDATE users SET referred_by = $1 WHERE id = $2
    `, [referrer.id, referredUserId]);

    return true;
  } catch (err) {
    logger.error('[Referral] Error creating pending referral', { error: err instanceof Error ? err.message : 'Unknown error' });
    return false;
  }
}

export { router as referralsRouter };
