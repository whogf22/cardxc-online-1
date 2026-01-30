import { Router, Response } from 'express';
import { query, queryOne } from '../db/pool';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

const router = Router();
router.use(authenticate);

// Get spending by category for current month
router.get('/spending-by-category', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const monthsBack = parseInt(req.query.months as string) || 1;
  const startDate = startOfMonth(subMonths(new Date(), monthsBack - 1));
  
  const spending = await query(`
    SELECT 
      COALESCE(ct.category, 'other') as category,
      SUM(ct.amount_cents) as total_cents,
      COUNT(*) as transaction_count
    FROM card_transactions ct
    JOIN virtual_cards vc ON ct.card_id = vc.id
    WHERE vc.user_id = $1 
      AND ct.status = 'completed'
      AND ct.created_at >= $2
    GROUP BY ct.category
    ORDER BY total_cents DESC
  `, [req.user!.id, startDate]);

  const formatted = spending.map(s => ({
    category: s.category,
    total: Number(s.total_cents) / 100,
    totalCents: Number(s.total_cents),
    transactionCount: Number(s.transaction_count),
  }));

  const totalSpent = formatted.reduce((sum, s) => sum + s.total, 0);

  res.json({
    success: true,
    data: {
      spending: formatted,
      totalSpent,
      period: {
        start: startDate,
        months: monthsBack,
      },
    },
  });
}));

// Get monthly spending trend
router.get('/monthly-trend', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const months = parseInt(req.query.months as string) || 6;
  
  const trend = await query(`
    SELECT 
      DATE_TRUNC('month', t.created_at) as month,
      SUM(CASE WHEN t.type IN ('transfer_out', 'withdrawal') THEN t.amount_cents ELSE 0 END) as spent_cents,
      SUM(CASE WHEN t.type IN ('transfer_in', 'deposit') THEN t.amount_cents ELSE 0 END) as received_cents
    FROM transactions t
    WHERE t.user_id = $1 
      AND t.status = 'SUCCESS'
      AND t.created_at >= $2
    GROUP BY DATE_TRUNC('month', t.created_at)
    ORDER BY month DESC
    LIMIT $3
  `, [req.user!.id, subMonths(new Date(), months), months]);

  const formatted = trend.map(t => ({
    month: format(new Date(t.month), 'MMM yyyy'),
    spent: Number(t.spent_cents) / 100,
    received: Number(t.received_cents) / 100,
    net: (Number(t.received_cents) - Number(t.spent_cents)) / 100,
  }));

  res.json({ success: true, data: { trend: formatted.reverse() } });
}));

// Get top merchants
router.get('/top-merchants', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
  
  const merchants = await query(`
    SELECT 
      ct.merchant,
      SUM(ct.amount_cents) as total_cents,
      COUNT(*) as transaction_count
    FROM card_transactions ct
    JOIN virtual_cards vc ON ct.card_id = vc.id
    WHERE vc.user_id = $1 
      AND ct.status = 'completed'
      AND ct.merchant IS NOT NULL
    GROUP BY ct.merchant
    ORDER BY total_cents DESC
    LIMIT $2
  `, [req.user!.id, limit]);

  const formatted = merchants.map(m => ({
    merchant: m.merchant,
    total: Number(m.total_cents) / 100,
    transactionCount: Number(m.transaction_count),
  }));

  res.json({ success: true, data: { merchants: formatted } });
}));

// Get account summary
router.get('/summary', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const [walletSummary, cardCount, transactionCount, recentActivity] = await Promise.all([
    queryOne<any>(`
      SELECT 
        SUM(balance_cents) as total_balance_cents,
        SUM(reserved_cents) as total_reserved_cents
      FROM wallets WHERE user_id = $1
    `, [req.user!.id]),
    
    queryOne<any>(`
      SELECT COUNT(*) as count FROM virtual_cards 
      WHERE user_id = $1 AND status = 'active'
    `, [req.user!.id]),
    
    queryOne<any>(`
      SELECT COUNT(*) as count FROM transactions 
      WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
    `, [req.user!.id]),
    
    query(`
      SELECT type, SUM(amount_cents) as total_cents
      FROM transactions
      WHERE user_id = $1 AND status = 'SUCCESS' AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY type
    `, [req.user!.id]),
  ]);

  const activityByType: Record<string, number> = {};
  recentActivity.forEach(a => {
    activityByType[a.type] = Number(a.total_cents) / 100;
  });

  res.json({
    success: true,
    data: {
      totalBalance: Number(walletSummary?.total_balance_cents || 0) / 100,
      availableBalance: (Number(walletSummary?.total_balance_cents || 0) - Number(walletSummary?.total_reserved_cents || 0)) / 100,
      activeCards: parseInt(cardCount?.count || '0'),
      transactionsLast30Days: parseInt(transactionCount?.count || '0'),
      activityByType,
    },
  });
}));

// Export transactions as CSV
router.get('/export', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : subMonths(new Date(), 3);
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
  
  const transactions = await query(`
    SELECT 
      t.id,
      t.type,
      t.status,
      t.amount_cents,
      t.currency,
      t.description,
      t.reference,
      t.created_at
    FROM transactions t
    WHERE t.user_id = $1 
      AND t.created_at BETWEEN $2 AND $3
    ORDER BY t.created_at DESC
  `, [req.user!.id, startDate, endDate]);

  // Generate CSV
  const headers = ['Date', 'Type', 'Status', 'Amount', 'Currency', 'Description', 'Reference'];
  const rows = transactions.map(t => [
    format(new Date(t.created_at), 'yyyy-MM-dd HH:mm:ss'),
    t.type,
    t.status,
    (Number(t.amount_cents) / 100).toFixed(2),
    t.currency,
    `"${(t.description || '').replace(/"/g, '""')}"`,
    t.reference || '',
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=cardxc-transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  res.send(csv);
}));

export { router as insightsRouter };
