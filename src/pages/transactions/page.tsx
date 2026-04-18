import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { formatDateTime } from '../../lib/localeUtils';

// ── Types ─────────────────────────────────────────────────────

interface Transaction {
  id: string;
  source: 'wallet' | 'card' | 'giftcard';
  type: string;
  status: string;
  amount: number;
  currency: string;
  description: string | null;
  category: string | null;
  merchantName: string | null;
  createdAt: string;
}

interface Filters {
  type: string;
  status: string;
  fromDate: string;
  toDate: string;
}

// ── Constants ─────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'transfer_in', label: 'Transfer In' },
  { value: 'transfer_out', label: 'Transfer Out' },
  { value: 'card_deposit', label: 'Card Deposit' },
  { value: 'card_spend', label: 'Card Spend' },
  { value: 'payment', label: 'Payment' },
  { value: 'giftcard_buy', label: 'Gift Card Purchase' },
  { value: 'giftcard_sell', label: 'Gift Card Sell' },
  { value: 'adjustment', label: 'Adjustment' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REVERSED', label: 'Reversed' },
];

const PAGE_SIZE = 20;

// ── Component ─────────────────────────────────────────────────

export default function TransactionsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [filters, setFilters] = useState<Filters>({
    type: '',
    status: '',
    fromDate: '',
    toDate: '',
  });

  // Track which filters were last used for the fetch (to detect changes)
  const activeFiltersRef = useRef(filters);

  // ── Data fetching ───────────────────────────────────────

  const fetchTransactions = useCallback(async (cursor?: string) => {
    if (!user?.id) return;

    const isLoadMore = !!cursor;
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params: Record<string, string | number> = { limit: PAGE_SIZE };
      if (cursor) params.cursor = cursor;
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;
      if (filters.fromDate) params.fromDate = new Date(filters.fromDate).toISOString();
      if (filters.toDate) {
        // Set toDate to end of day
        const d = new Date(filters.toDate);
        d.setHours(23, 59, 59, 999);
        params.toDate = d.toISOString();
      }

      const result = await userApi.getTransactionHistory(params as any);

      if (result.success && result.data) {
        if (isLoadMore) {
          setTransactions(prev => [...prev, ...result.data!.transactions]);
        } else {
          setTransactions(result.data.transactions);
        }
        setNextCursor(result.data.nextCursor);
        setHasMore(result.data.hasMore);
      } else {
        if (!isLoadMore) setTransactions([]);
        setNextCursor(null);
        setHasMore(false);
      }
    } catch (error) {
      console.error('[TransactionsPage] Error:', error);
      if (!isLoadMore) setTransactions([]);
      setNextCursor(null);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user?.id, filters]);

  // Fetch on mount and when filters change
  useEffect(() => {
    activeFiltersRef.current = filters;
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchTransactions]);

  const loadMore = () => {
    if (nextCursor && hasMore && !loadingMore) {
      fetchTransactions(nextCursor);
    }
  };

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ type: '', status: '', fromDate: '', toDate: '' });
  };

  const hasActiveFilters = filters.type || filters.status || filters.fromDate || filters.toDate;

  // ── Rendering helpers ───────────────────────────────────

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      deposit: 'ri-arrow-down-line text-emerald-400',
      card_deposit: 'ri-bank-card-line text-emerald-400',
      withdrawal: 'ri-arrow-up-line text-amber-400',
      transfer_in: 'ri-arrow-down-circle-line text-lime-400',
      transfer_out: 'ri-arrow-up-circle-line text-orange-400',
      card_spend: 'ri-shopping-bag-line text-purple-400',
      payment: 'ri-exchange-dollar-line text-blue-400',
      giftcard_buy: 'ri-gift-line text-pink-400',
      giftcard_sell: 'ri-gift-2-line text-cyan-400',
      adjustment: 'ri-scales-line text-neutral-400',
    };
    return icons[type] || 'ri-exchange-line text-neutral-400';
  };

  const getTypeBg = (type: string) => {
    const bgs: Record<string, string> = {
      deposit: 'bg-emerald-500/20',
      card_deposit: 'bg-emerald-500/20',
      withdrawal: 'bg-amber-500/20',
      transfer_in: 'bg-lime-500/20',
      transfer_out: 'bg-orange-500/20',
      card_spend: 'bg-purple-500/20',
      payment: 'bg-blue-500/20',
      giftcard_buy: 'bg-pink-500/20',
      giftcard_sell: 'bg-cyan-500/20',
      adjustment: 'bg-neutral-500/20',
    };
    return bgs[type] || 'bg-dark-elevated';
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      deposit: 'Deposit',
      card_deposit: 'Card Deposit',
      withdrawal: 'Withdrawal',
      transfer_in: 'Transfer In',
      transfer_out: 'Transfer Out',
      card_spend: 'Card Spend',
      payment: 'Payment',
      giftcard_buy: 'Gift Card Purchase',
      giftcard_sell: 'Gift Card Sell',
      adjustment: 'Adjustment',
    };
    return labels[type] || type;
  };

  const isIncoming = (type: string) =>
    ['deposit', 'card_deposit', 'transfer_in', 'giftcard_sell'].includes(type);

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; icon: string }> = {
      PENDING: { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: 'ri-time-line' },
      SUCCESS: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: 'ri-checkbox-circle-line' },
      FAILED: { bg: 'bg-red-500/20', text: 'text-red-400', icon: 'ri-close-circle-line' },
      REVERSED: { bg: 'bg-neutral-500/20', text: 'text-neutral-400', icon: 'ri-arrow-go-back-line' },
    };
    const c = config[status] || config.PENDING;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
        <i className={c.icon}></i>
        {status === 'SUCCESS' ? 'Success' : status.charAt(0) + status.slice(1).toLowerCase()}
      </span>
    );
  };

  const getSourceBadge = (source: string) => {
    const config: Record<string, { label: string; bg: string }> = {
      wallet: { label: 'Wallet', bg: 'bg-blue-500/10 text-blue-400' },
      card: { label: 'Card', bg: 'bg-purple-500/10 text-purple-400' },
      giftcard: { label: 'Gift Card', bg: 'bg-pink-500/10 text-pink-400' },
    };
    const c = config[source] || { label: source, bg: 'bg-neutral-500/10 text-neutral-400' };
    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${c.bg}`}>
        {c.label}
      </span>
    );
  };

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <header className="bg-dark-card border-b border-dark-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-dark-elevated transition-colors cursor-pointer flex-shrink-0"
              >
                <i className="ri-arrow-left-line text-neutral-300 text-xl"></i>
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-white truncate">Transaction History</h1>
                <p className="text-xs text-neutral-400 hidden sm:block">All transactions across wallet, cards, and gift cards</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-dark-card rounded-2xl border border-dark-border p-4 mb-6 space-y-4">
          {/* Row 1: Type and Status dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">Type</label>
              <select
                value={filters.type}
                onChange={e => handleFilterChange('type', e.target.value)}
                className="input-dark w-full rounded-xl px-4 py-2.5 text-sm appearance-none cursor-pointer"
              >
                {TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">Status</label>
              <select
                value={filters.status}
                onChange={e => handleFilterChange('status', e.target.value)}
                className="input-dark w-full rounded-xl px-4 py-2.5 text-sm appearance-none cursor-pointer"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Date range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">From date</label>
              <input
                type="date"
                value={filters.fromDate}
                onChange={e => handleFilterChange('fromDate', e.target.value)}
                className="input-dark w-full rounded-xl px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">To date</label>
              <input
                type="date"
                value={filters.toDate}
                onChange={e => handleFilterChange('toDate', e.target.value)}
                className="input-dark w-full rounded-xl px-4 py-2.5 text-sm"
              />
            </div>
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-lime-400 hover:text-lime-300 transition-colors cursor-pointer"
            >
              <i className="ri-close-line mr-1"></i>
              Clear all filters
            </button>
          )}
        </div>

        {/* Transaction list */}
        <div className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden">
          {loading ? (
            <div className="space-y-4 p-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-dark-elevated rounded-xl skeleton-shimmer"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-dark-elevated rounded w-1/4 skeleton-shimmer"></div>
                    <div className="h-3 bg-dark-elevated rounded w-1/2 skeleton-shimmer"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-16">
              <i className="ri-file-list-3-line text-neutral-500 text-5xl mb-4 block"></i>
              <p className="text-neutral-400 text-sm">
                {hasActiveFilters
                  ? 'No transactions match your filters'
                  : 'No transactions yet'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-3 text-sm text-lime-400 hover:text-lime-300 transition-colors cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="divide-y divide-dark-border">
                {transactions.map(tx => (
                  <div
                    key={`${tx.source}-${tx.id}`}
                    className="p-4 hover:bg-dark-elevated/50 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      {/* Icon */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${getTypeBg(tx.type)}`}>
                        <i className={`${getTypeIcon(tx.type)} text-xl`}></i>
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-white">
                                {getTypeLabel(tx.type)}
                              </p>
                              {getSourceBadge(tx.source)}
                            </div>
                            <p className="text-xs text-neutral-400 mt-1 truncate">
                              {tx.merchantName || tx.description || tx.category || 'No description'}
                            </p>
                            <p className="text-xs text-neutral-500 mt-1">
                              {formatDateTime(tx.createdAt)}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-base font-bold ${isIncoming(tx.type) ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {isIncoming(tx.type) ? '+' : '-'}
                              {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {tx.currency}
                            </p>
                            <div className="mt-2">
                              {getStatusBadge(tx.status)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination: Load More */}
              {hasMore && (
                <div className="p-4 border-t border-dark-border">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="w-full py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer bg-dark-elevated text-neutral-300 hover:bg-dark-hover hover:text-white border border-dark-border disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingMore ? (
                      <span className="flex items-center justify-center gap-2">
                        <i className="ri-loader-4-line animate-spin"></i>
                        Loading...
                      </span>
                    ) : (
                      'Load more transactions'
                    )}
                  </button>
                </div>
              )}

              {/* End of list indicator */}
              {!hasMore && transactions.length > 0 && (
                <div className="p-4 border-t border-dark-border text-center">
                  <p className="text-xs text-neutral-500">
                    Showing all {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
