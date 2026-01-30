import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../../lib/apiClient';

interface WalletBalance {
  user_id: string;
  currency: string;
  balance_cents: number;
  user_email?: string;
  user_name?: string;
}

export default function WalletBalancesTab() {
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCurrency, setFilterCurrency] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  const loadBalances = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get('/admin/wallets');
      
      if (response.success) {
        setBalances(response.data?.wallets || []);
      }
    } catch (err: any) {
      console.error('[WalletBalancesTab] Error loading balances:', err);
      setError(err.message || 'Failed to load balances');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  const currencies = ['all', ...new Set(balances.map(b => b.currency))];

  const filteredBalances = balances.filter((balance) => {
    const matchesSearch =
      balance.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      balance.user_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCurrency = filterCurrency === 'all' || balance.currency === filterCurrency;
    return matchesSearch && matchesCurrency;
  });

  const totalBalance = filteredBalances.reduce((sum, b) => sum + b.balance_cents, 0);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
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
          <h2 className="text-2xl font-bold text-white">Account Balances</h2>
          <p className="text-slate-400 mt-1">View all user wallet balances</p>
        </div>
        <button 
          onClick={loadBalances}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all duration-200 font-medium border border-slate-700 hover:border-slate-600"
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

      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              placeholder="Search by user email or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
            />
          </div>

          <select
            value={filterCurrency}
            onChange={(e) => setFilterCurrency(e.target.value)}
            className="bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all cursor-pointer appearance-none min-w-[150px]"
          >
            {currencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency === 'all' ? 'All Currencies' : currency}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-700/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <i className="ri-wallet-3-line text-emerald-400 text-2xl"></i>
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Balance (Filtered)</p>
              <p className="text-3xl font-bold text-white">{formatCurrency(totalBalance)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-700/50">
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">User</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Currency</th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Balance</th>
              </tr>
            </thead>
            <tbody>
              {filteredBalances.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-16 text-center">
                    <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="ri-wallet-3-line text-3xl text-slate-500"></i>
                    </div>
                    <p className="text-slate-400 font-medium">No balances found</p>
                    <p className="text-slate-500 text-sm mt-1">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                filteredBalances.map((balance, index) => (
                  <tr 
                    key={`${balance.user_id}-${balance.currency}-${index}`} 
                    className={`border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors ${
                      index % 2 === 0 ? 'bg-slate-800/20' : 'bg-transparent'
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                          <span className="text-white font-bold text-sm">
                            {balance.user_name?.charAt(0).toUpperCase() || balance.user_email?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">{balance.user_name || 'Unknown'}</p>
                          <p className="text-sm text-slate-400 truncate">{balance.user_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-3 py-1.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-semibold">
                        {balance.currency}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-white font-bold text-lg">{formatCurrency(balance.balance_cents)}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
