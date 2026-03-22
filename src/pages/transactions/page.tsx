import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { userApi } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { TransactionStatusBadge } from '../../components/TransactionStatusBadge';
import { formatDateTime } from '../../lib/localeUtils';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  reference?: string;
  description?: string;
  merchantDisplayName?: string;
  merchant_display_name?: string;
}

export default function TransactionsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'transfer'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightId, setHighlightId] = useState<string | null>(
    location.state?.highlightId || null
  );

  useEffect(() => {
    loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, filter]);

  useEffect(() => {
    if (highlightId) {
      setTimeout(() => {
        const element = document.getElementById(`transaction-${highlightId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);

      setTimeout(() => {
        setHighlightId(null);
      }, 3000);
    }
  }, [highlightId]);

  const loadTransactions = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const params: { limit?: number; type?: string } = { limit: 100 };
      if (filter !== 'all') {
        params.type = filter;
      }

      const result = await userApi.getTransactions(params);

      if (result.success && result.data?.transactions) {
        setTransactions(result.data.transactions);
      } else {
        console.error('[TransactionsPage] Error loading transactions:', result.error);
        setTransactions([]);
      }
    } catch (error) {
      console.error('[TransactionsPage] Error loading transactions:', error);
      setTransactions([]);
    }
    setLoading(false);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'ri-arrow-down-line text-emerald-400';
      case 'withdrawal':
        return 'ri-arrow-up-line text-amber-400';
      case 'transfer':
        return 'ri-exchange-line text-lime-400';
      default:
        return 'ri-exchange-dollar-line text-neutral-400';
    }
  };

  const getTransactionBg = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'bg-emerald-500/20';
      case 'withdrawal':
        return 'bg-amber-500/20';
      case 'transfer':
        return 'bg-lime-500/20';
      default:
        return 'bg-dark-elevated';
    }
  };

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
                <p className="text-xs text-neutral-400 hidden sm:block">View all your transactions</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="bg-dark-card rounded-2xl border border-dark-border p-4 mb-6 space-y-4">
          <div className="relative">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500"></i>
            <input
              type="text"
              placeholder="Search by description, reference, or amount..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-dark w-full rounded-xl pl-11 pr-4 py-3"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {(['all', 'deposit', 'withdrawal', 'transfer'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 ${filter === t
                    ? 'bg-lime-500 text-black shadow-glow-sm'
                    : 'bg-dark-elevated text-neutral-400 hover:bg-dark-hover hover:text-white border border-dark-border'
                  }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}s
              </button>
            ))}
          </div>
        </div>

        {/* Transactions List */}
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
          ) : (
            (() => {
              const filtered = transactions.filter((t) => {
                const searchLower = searchTerm.toLowerCase();
                return (
                  t.description?.toLowerCase().includes(searchLower) ||
                  t.reference?.toLowerCase().includes(searchLower) ||
                  t.merchantDisplayName?.toLowerCase().includes(searchLower) ||
                  t.merchant_display_name?.toLowerCase().includes(searchLower) ||
                  t.amount.toString().includes(searchLower) ||
                  t.type.toLowerCase().includes(searchLower)
                );
              });

              if (filtered.length === 0) {
                return (
                  <div className="text-center py-16">
                    <i className="ri-file-list-3-line text-neutral-500 text-5xl mb-4"></i>
                    <p className="text-neutral-400 text-sm">No transactions found matching your search</p>
                  </div>
                );
              }

              return (
                <div className="divide-y divide-dark-border">
                  {filtered.map((transaction) => (
                    <div
                      key={transaction.id}
                      id={`transaction-${transaction.id}`}
                      className={`p-4 hover:bg-dark-elevated/50 transition-all ${highlightId === transaction.id
                          ? 'bg-lime-500/10 border-l-4 border-lime-500'
                          : ''
                        }`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Icon */}
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${getTransactionBg(
                            transaction.type
                          )}`}
                        >
                          <i className={`${getTransactionIcon(transaction.type)} text-xl`}></i>
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-white capitalize">
                                {transaction.type}
                              </p>
                              <p className="text-xs text-neutral-400 mt-1">
                                {transaction.merchantDisplayName || transaction.merchant_display_name || transaction.description || transaction.reference || 'No description'}
                              </p>
                              <p className="text-xs text-neutral-500 mt-1">
                                {formatDateTime(transaction.created_at)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p
                                className={`text-base font-bold ${transaction.type === 'deposit'
                                    ? 'text-emerald-400'
                                    : transaction.type === 'withdrawal'
                                      ? 'text-amber-400'
                                      : 'text-white'
                                  }`}
                              >
                                {transaction.type === 'deposit' ? '+' : '-'}
                                {transaction.amount} {transaction.currency}
                              </p>
                              <div className="mt-2">
                                <TransactionStatusBadge status={transaction.status as any} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
}
