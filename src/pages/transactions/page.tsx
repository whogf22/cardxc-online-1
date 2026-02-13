import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { userApi } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { TransactionStatusBadge } from '../../components/TransactionStatusBadge';

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
        return 'ri-arrow-down-line text-green-600';
      case 'withdrawal':
        return 'ri-arrow-up-line text-orange-600';
      case 'transfer':
        return 'ri-exchange-line text-blue-600';
      default:
        return 'ri-exchange-dollar-line text-slate-600';
    }
  };

  const getTransactionBg = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'bg-green-100';
      case 'withdrawal':
        return 'bg-orange-100';
      case 'transfer':
        return 'bg-blue-100';
      default:
        return 'bg-slate-100';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors cursor-pointer flex-shrink-0"
              >
                <i className="ri-arrow-left-line text-slate-600 text-xl"></i>
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">Transaction History</h1>
                <p className="text-xs text-slate-500 hidden sm:block">View all your transactions</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 space-y-4">
          <div className="relative">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              placeholder="Search by description, reference, or amount..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {(['all', 'deposit', 'withdrawal', 'transfer'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 ${filter === t
                    ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/25'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}s
              </button>
            ))}
          </div>
        </div>

        {/* Transactions List */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="space-y-4 p-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-100 rounded w-1/4"></div>
                    <div className="h-3 bg-slate-100 rounded w-1/2"></div>
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
                    <i className="ri-file-list-3-line text-slate-300 text-5xl mb-4"></i>
                    <p className="text-slate-500 text-sm">No transactions found matching your search</p>
                  </div>
                );
              }

              return (
                <div className="divide-y divide-slate-100">
                  {filtered.map((transaction) => (
                    <div
                      key={transaction.id}
                      id={`transaction-${transaction.id}`}
                      className={`p-4 hover:bg-slate-50 transition-all ${highlightId === transaction.id
                          ? 'bg-teal-50 border-l-4 border-teal-500'
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
                              <p className="text-sm font-semibold text-slate-900 capitalize">
                                {transaction.type}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                {transaction.merchantDisplayName || transaction.merchant_display_name || transaction.description || transaction.reference || 'No description'}
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                {formatDate(transaction.created_at)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p
                                className={`text-base font-bold ${transaction.type === 'deposit'
                                    ? 'text-green-600'
                                    : transaction.type === 'withdrawal'
                                      ? 'text-orange-600'
                                      : 'text-slate-900'
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
