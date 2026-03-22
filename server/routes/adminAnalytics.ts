import { Router } from 'express';
import { query, queryOne } from '../db/pool';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.use(requireRole('SUPER_ADMIN'));

// Full analytics dashboard
router.get('/dashboard', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const [userStats, transactionStats, walletStats, cardStats] = await Promise.all([
    // User statistics
    queryOne<any>(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as new_today,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_this_week,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as new_this_month,
        COUNT(*) FILTER (WHERE account_status = 'active') as active_users,
        COUNT(*) FILTER (WHERE kyc_status = 'approved') as verified_users
      FROM users
    `),
    
    // Transaction statistics
    queryOne<any>(`
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(amount_cents), 0) as total_volume_cents,
        COUNT(*) FILTER (WHERE status = 'SUCCESS') as successful,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as today_count,
        COALESCE(SUM(amount_cents) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'), 0) as today_volume
      FROM transactions
    `),
    
    // Wallet statistics
    queryOne<any>(`
      SELECT 
        COALESCE(SUM(balance_cents), 0) as total_balance,
        COALESCE(SUM(reserved_cents), 0) as total_reserved,
        COUNT(DISTINCT user_id) as users_with_balance
      FROM wallets
      WHERE balance_cents > 0
    `),
    
    // Card statistics
    queryOne<any>(`
      SELECT 
        COUNT(*) as total_cards,
        COUNT(*) FILTER (WHERE status = 'active') as active_cards,
        COALESCE(SUM(balance_cents), 0) as total_card_balance
      FROM virtual_cards
    `),
  ]);

  res.json({
    success: true,
    data: {
      users: {
        total: parseInt(userStats?.total_users || '0'),
        newToday: parseInt(userStats?.new_today || '0'),
        newThisWeek: parseInt(userStats?.new_this_week || '0'),
        newThisMonth: parseInt(userStats?.new_this_month || '0'),
        active: parseInt(userStats?.active_users || '0'),
        verified: parseInt(userStats?.verified_users || '0'),
      },
      transactions: {
        total: parseInt(transactionStats?.total_transactions || '0'),
        totalVolume: parseInt(transactionStats?.total_volume_cents || '0') / 100,
        successful: parseInt(transactionStats?.successful || '0'),
        todayCount: parseInt(transactionStats?.today_count || '0'),
        todayVolume: parseInt(transactionStats?.today_volume || '0') / 100,
      },
      wallets: {
        totalBalance: parseInt(walletStats?.total_balance || '0') / 100,
        totalReserved: parseInt(walletStats?.total_reserved || '0') / 100,
        usersWithBalance: parseInt(walletStats?.users_with_balance || '0'),
      },
      cards: {
        total: parseInt(cardStats?.total_cards || '0'),
        active: parseInt(cardStats?.active_cards || '0'),
        totalBalance: parseInt(cardStats?.total_card_balance || '0') / 100,
      },
    },
  });
}));

// Daily signups trend
router.get('/signups', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 90);
  
  const signups = await query(`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM users
    WHERE created_at > NOW() - ($1 * INTERVAL '1 day')
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `, [days]);

  res.json({ success: true, data: { signups } });
}));

// Transaction volume trend
router.get('/volume', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 90);
  
  const volume = await query(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as transaction_count,
      COALESCE(SUM(amount_cents), 0) as volume_cents,
      COUNT(*) FILTER (WHERE type = 'deposit') as deposits,
      COUNT(*) FILTER (WHERE type = 'withdrawal') as withdrawals,
      COUNT(*) FILTER (WHERE type IN ('transfer_in', 'transfer_out')) as transfers
    FROM transactions
    WHERE created_at > NOW() - ($1 * INTERVAL '1 day')
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `, [days]);

  const formatted = volume.map(v => ({
    date: v.date,
    count: parseInt(v.transaction_count),
    volume: parseInt(v.volume_cents) / 100,
    deposits: parseInt(v.deposits),
    withdrawals: parseInt(v.withdrawals),
    transfers: parseInt(v.transfers),
  }));

  res.json({ success: true, data: { volume: formatted } });
}));

// Revenue report (fees collected)
router.get('/revenue', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const revenue = await query(`
    SELECT 
      DATE_TRUNC('month', created_at) as month,
      COUNT(*) as transaction_count,
      COALESCE(SUM(CASE WHEN type = 'fee' THEN amount_cents ELSE 0 END), 0) as fees_collected
    FROM transactions
    WHERE created_at > NOW() - INTERVAL '12 months'
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY month DESC
  `);

  res.json({ success: true, data: { revenue } });
}));

// Top users by transaction volume
router.get('/top-users', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  
  const topUsers = await query(`
    SELECT 
      u.id, u.email, u.full_name, u.created_at,
      COUNT(t.id) as transaction_count,
      COALESCE(SUM(t.amount_cents), 0) as total_volume,
      w.balance_cents as current_balance
    FROM users u
    LEFT JOIN transactions t ON t.user_id = u.id AND t.status = 'SUCCESS'
    LEFT JOIN wallets w ON w.user_id = u.id AND w.currency = 'USD'
    GROUP BY u.id, u.email, u.full_name, u.created_at, w.balance_cents
    ORDER BY total_volume DESC NULLS LAST
    LIMIT $1
  `, [limit]);

  const formatted = topUsers.map(u => ({
    id: u.id,
    email: u.email,
    name: u.full_name,
    joinedAt: u.created_at,
    transactionCount: parseInt(u.transaction_count),
    totalVolume: parseInt(u.total_volume || '0') / 100,
    currentBalance: parseInt(u.current_balance || '0') / 100,
  }));

  res.json({ success: true, data: { topUsers: formatted } });
}));

// Geographic distribution
router.get('/geographic', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const distribution = await query(`
    SELECT country, COUNT(*) as user_count
    FROM users
    WHERE country IS NOT NULL
    GROUP BY country
    ORDER BY user_count DESC
    LIMIT 20
  `);

  res.json({ success: true, data: { distribution } });
}));

// Pending actions summary
router.get('/pending', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const [pendingWithdrawals, pendingKYC, activeFraudFlags] = await Promise.all([
    queryOne<any>(`
      SELECT COUNT(*) as count, COALESCE(SUM(amount_cents), 0) as total_cents
      FROM withdrawal_requests WHERE status = 'pending'
    `),
    queryOne<any>(`
      SELECT COUNT(*) as count FROM users WHERE kyc_status = 'pending'
    `),
    queryOne<any>(`
      SELECT COUNT(*) as count FROM fraud_flags WHERE status = 'active'
    `),
  ]);

  res.json({
    success: true,
    data: {
      pendingWithdrawals: {
        count: parseInt(pendingWithdrawals?.count || '0'),
        totalAmount: parseInt(pendingWithdrawals?.total_cents || '0') / 100,
      },
      pendingKYC: parseInt(pendingKYC?.count || '0'),
      activeFraudFlags: parseInt(activeFraudFlags?.count || '0'),
    },
  });
}));

export { router as adminAnalyticsRouter };
