import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { userApi } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { TransactionStatusBadge } from '../../components/TransactionStatusBadge';
import { LoadingSpinner } from '../../components/LoadingSpinner';

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
        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 mb-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 ${
                filter === 'all'
                  ? 'bg-teal-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('deposit')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 ${
                filter === 'deposit'
                  ? 'bg-teal-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Deposits
            </button>
            <button
              onClick={() => setFilter('withdrawal')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 ${
                filter === 'withdrawal'
                  ? 'bg-teal-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Withdrawals
            </button>
            <button
              onClick={() => setFilter('transfer')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 ${
                filter === 'transfer'
                  ? 'bg-teal-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Transfers
            </button>
          </div>
        </div>

        {/* Transactions List */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <LoadingSpinner />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-16">
              <i className="ri-file-list-3-line text-slate-300 text-5xl mb-4"></i>
              <p className="text-slate-500 text-sm">No transactions found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  id={`transaction-${transaction.id}`}
                  className={`p-4 hover:bg-slate-50 transition-all ${
                    highlightId === transaction.id
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
                            className={`text-base font-bold ${
                              transaction.type === 'deposit'
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
                            <TransactionStatusBadge status={transaction.status as 'pending' | 'completed' | 'failed' | 'approved' | 'rejected'} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
