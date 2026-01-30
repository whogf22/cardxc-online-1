import { useState, useEffect } from 'react';
import { adminApi } from '../../../lib/api';

interface WalletBalance {
  user_id: string;
  currency: string;
  balance: number;
  updated_at?: string;
  user_email?: string;
  user_name?: string;
}

export default function WalletBalancesTab() {
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [filteredBalances, setFilteredBalances] = useState<WalletBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');

  useEffect(() => {
    loadBalances();
  }, []);

  useEffect(() => {
    filterBalances();
  }, [balances, searchTerm, currencyFilter]);

  const loadBalances = async () => {
    try {
      setLoading(true);
      setError('');

      const result = await adminApi.getUsers();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to load balances');
      }

      const users = result.data?.users || [];
      
      const enrichedBalances: WalletBalance[] = users.map((user: any) => ({
        user_id: user.id,
        currency: 'USD',
        balance: user.balance || 0,
        updated_at: user.updated_at,
        user_email: user.email,
        user_name: user.full_name,
      }));

      setBalances(enrichedBalances);
    } catch (err: any) {
      console.error('Error loading balances:', err);
      setError(err.message || 'Failed to load wallet balances');
    } finally {
      setLoading(false);
    }
  };

  const filterBalances = () => {
    let filtered = [...balances];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (balance) =>
          balance.user_email?.toLowerCase().includes(term) ||
          balance.user_name?.toLowerCase().includes(term) ||
          balance.user_id?.toLowerCase().includes(term)
      );
    }

    if (currencyFilter !== 'all') {
      filtered = filtered.filter((balance) => balance.currency === currencyFilter);
    }

    setFilteredBalances(filtered);
  };

  const getTotalBalance = () => {
    return filteredBalances.reduce((sum, b) => sum + parseFloat(b.balance.toString()), 0);
  };

  const getUniqueCurrencies = () => {
    return Array.from(new Set(balances.map((b) => b.currency))).sort();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6 animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-48 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-slate-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <i className="ri-error-warning-line text-red-600 text-2xl"></i>
          <div>
            <h3 className="text-red-900 font-semibold">Error Loading Balances</h3>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={loadBalances}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Critical Security Banner */}
      <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <i className="ri-lock-line text-red-600 text-2xl mt-0.5"></i>
          <div className="flex-1">
            <h3 className="text-red-900 font-bold text-sm">READ-ONLY VIEW - NO EDITS ALLOWED</h3>
            <p className="text-red-700 text-sm mt-1">
              <strong>CRITICAL:</strong> This data is sourced from the admin API.
              Balance modifications are STRICTLY PROHIBITED from the frontend. All balance updates must occur server-side via ledger entries.
              This view is for monitoring and audit purposes only.
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-600 mb-1">Total Accounts</p>
          <p className="text-2xl font-bold text-slate-900">{balances.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-600 mb-1">Total Balance (Filtered)</p>
          <p className="text-2xl font-bold text-green-600">
            ${getTotalBalance().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-600 mb-1">Currencies</p>
          <p className="text-2xl font-bold text-blue-600">{getUniqueCurrencies().length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Search by User
            </label>
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Email, name, or user ID..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Filter by Currency
            </label>
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm"
            >
              <option value="all">All Currencies</option>
              {getUniqueCurrencies().map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Balances Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Currency
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Last Updated
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Source
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredBalances.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <i className="ri-wallet-line text-slate-300 text-4xl mb-2"></i>
                    <p className="text-slate-500">No balances found</p>
                  </td>
                </tr>
              ) : (
                filteredBalances.map((balance, index) => (
                  <tr key={`${balance.user_id}-${balance.currency}-${index}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-semibold">
                            {balance.user_email?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {balance.user_name || 'N/A'}
                          </p>
                          <p className="text-xs text-slate-500">{balance.user_email || balance.user_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full border border-blue-200">
                        {balance.currency}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-lg font-bold text-slate-900">
                        ${parseFloat(balance.balance.toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-900">
                        {balance.updated_at
                          ? new Date(balance.updated_at).toLocaleDateString()
                          : 'N/A'}
                      </p>
                      {balance.updated_at && (
                        <p className="text-xs text-slate-500">
                          {new Date(balance.updated_at).toLocaleTimeString()}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-mono rounded border border-slate-200">
                        admin_api
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Footer */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <i className="ri-information-line text-blue-600 text-xl mt-0.5"></i>
          <div className="flex-1">
            <h3 className="text-blue-900 font-semibold text-sm">Data Source Information</h3>
            <p className="text-blue-700 text-sm mt-1">
              All balance data is fetched via the admin API.
              This view is automatically updated by backend triggers when ledger entries are created.
              Frontend has READ-ONLY access with secure row-level policies enforced.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
