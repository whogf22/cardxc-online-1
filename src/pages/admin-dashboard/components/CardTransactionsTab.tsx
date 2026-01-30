import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../../lib/apiClient';

interface CardTransaction {
  id: string;
  card_id: string;
  card_name?: string;
  card_last_four?: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  amount_cents: number;
  currency: string;
  merchant: string;
  category: string;
  status: string;
  created_at: string;
}

export default function CardTransactionsTab() {
  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'SUCCESS' | 'PENDING' | 'FAILED'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get('/admin/card-transactions?limit=500');
      
      if (response.success) {
        setTransactions(response.data?.transactions || []);
      }
    } catch (err: any) {
      console.error('[CardTransactionsTab] Error loading transactions:', err);
      if (err.message?.includes('404') || err.message?.includes('Not Found')) {
        setTransactions([]);
      } else {
        setError(err.message || 'Failed to load card transactions');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const filteredTransactions = transactions.filter((tx) => {
    const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;
    const matchesSearch = 
      tx.merchant?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.card_last_four?.includes(searchTerm);
    return matchesStatus && matchesSearch;
  });

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalVolume = filteredTransactions.reduce((sum, tx) => sum + tx.amount_cents, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      case 'PENDING':
        return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      case 'FAILED':
        return 'bg-red-500/20 text-red-400 border border-red-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border border-slate-500/30';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'shopping':
        return 'ri-shopping-bag-line';
      case 'food':
        return 'ri-restaurant-line';
      case 'transport':
        return 'ri-car-line';
      case 'entertainment':
        return 'ri-gamepad-line';
      case 'utilities':
        return 'ri-lightbulb-line';
      case 'travel':
        return 'ri-plane-line';
      default:
        return 'ri-money-dollar-circle-line';
    }
  };

  const formatCurrency = (cents: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(cents / 100);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 animate-pulse">
          <div className="h-10 bg-slate-700 rounded-xl mb-6"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-slate-700/50 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Card Transactions</h2>
          <p className="text-slate-400 mt-1">View all prepaid card transactions</p>
        </div>
        <button 
          onClick={loadTransactions}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all duration-200 font-medium border border-slate-700 hover:border-slate-600 cursor-pointer"
        >
          <i className={`ri-refresh-line ${loading ? 'animate-spin' : ''}`}></i>
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <i className="ri-error-warning-line text-red-400 text-xl"></i>
          </div>
          <p className="text-red-400">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl flex items-center justify-center">
              <i className="ri-bank-card-line text-emerald-400 text-2xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{transactions.length}</p>
              <p className="text-sm text-slate-400">Total Transactions</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center">
              <i className="ri-funds-line text-blue-400 text-2xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{formatCurrency(totalVolume)}</p>
              <p className="text-sm text-slate-400">Total Volume</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500/20 to-green-500/20 rounded-xl flex items-center justify-center">
              <i className="ri-checkbox-circle-line text-emerald-400 text-2xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {transactions.filter(t => t.status === 'SUCCESS').length}
              </p>
              <p className="text-sm text-slate-400">Successful</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500/20 to-pink-500/20 rounded-xl flex items-center justify-center">
              <i className="ri-close-circle-line text-red-400 text-2xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {transactions.filter(t => t.status === 'FAILED').length}
              </p>
              <p className="text-sm text-slate-400">Failed</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              placeholder="Search by merchant, email, or card number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {(['all', 'SUCCESS', 'PENDING', 'FAILED'] as const).map((status) => (
              <button
                key={status}
                onClick={() => { setStatusFilter(status); setCurrentPage(1); }}
                className={`px-4 py-3 rounded-xl font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
                  statusFilter === status
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                    : 'bg-slate-900/50 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600'
                }`}
              >
                {status === 'all' ? 'All' : status}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-700/50">
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">User</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Card</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Merchant</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Category</th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="ri-bank-card-line text-3xl text-slate-500"></i>
                    </div>
                    <p className="text-slate-400 font-medium">No card transactions found</p>
                    <p className="text-slate-500 text-sm mt-1">Transactions will appear here when users make purchases</p>
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx, index) => (
                  <tr 
                    key={tx.id} 
                    className={`border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors ${
                      index % 2 === 0 ? 'bg-slate-800/20' : 'bg-transparent'
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                          <span className="text-white font-bold text-sm">
                            {tx.user_name?.charAt(0).toUpperCase() || tx.user_email?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">{tx.user_name || 'Unknown'}</p>
                          <p className="text-sm text-slate-400 truncate">{tx.user_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <i className="ri-bank-card-line text-slate-400"></i>
                        <span className="text-white font-medium">****{tx.card_last_four}</span>
                      </div>
                      <p className="text-sm text-slate-400 mt-0.5">{tx.card_name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-white font-medium">{tx.merchant}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-slate-700/50 rounded-lg flex items-center justify-center">
                          <i className={`${getCategoryIcon(tx.category)} text-slate-300`}></i>
                        </div>
                        <span className="text-slate-300 capitalize">{tx.category || 'other'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-white font-bold">{formatCurrency(tx.amount_cents, tx.currency)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold ${getStatusBadge(tx.status)}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-white text-sm">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-slate-400 text-xs">
                        {new Date(tx.created_at).toLocaleTimeString()}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700/50">
            <p className="text-sm text-slate-400">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length} transactions
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <i className="ri-arrow-left-s-line"></i>
              </button>
              <span className="px-4 py-2 bg-slate-700/50 text-white rounded-lg font-medium">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <i className="ri-arrow-right-s-line"></i>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
