import { useState, useEffect } from 'react';
import { adminApi } from '../../../lib/api';
import { formatDate, formatTime } from '../../../lib/localeUtils';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balances, searchTerm, currencyFilter]);

  const loadBalances = async () => {
    try {
      setLoading(true);
      setError('');

      const result = await adminApi.getWallets();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to load balances');
      }

      const wallets = result.data?.wallets || [];
      
      const enrichedBalances: WalletBalance[] = wallets.map((w: any) => ({
        user_id: w.user_id,
        currency: w.currency,
        balance: Number(w.balance_cents || 0) / 100,
        updated_at: w.updated_at,
        user_email: w.user_email,
        user_name: w.user_name,
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
        <div className="bg-dark-card rounded-lg border border-dark-border p-6 animate-pulse">
          <div className="h-8 bg-dark-elevated rounded w-48 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-dark-elevated rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <i className="ri-error-warning-line text-red-400 text-2xl"></i>
          <div>
            <h3 className="text-red-400 font-semibold">Error Loading Balances</h3>
            <p className="text-red-300 text-sm mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={loadBalances}
          className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Critical Security Banner */}
      <div className="bg-red-500/10 border-2 border-red-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <i className="ri-lock-line text-red-400 text-2xl mt-0.5"></i>
          <div className="flex-1">
            <h3 className="text-red-400 font-bold text-sm">READ-ONLY VIEW - NO EDITS ALLOWED</h3>
            <p className="text-red-300/90 text-sm mt-1">
              <strong>CRITICAL:</strong> This data is sourced from the admin API.
              Balance modifications are STRICTLY PROHIBITED from the frontend. All balance updates must occur server-side via ledger entries.
              This view is for monitoring and audit purposes only.
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-dark-card rounded-lg border border-dark-border p-4">
          <p className="text-sm text-neutral-400 mb-1">Total Accounts</p>
          <p className="text-2xl font-bold text-white">{balances.length}</p>
        </div>
        <div className="bg-dark-card rounded-lg border border-dark-border p-4">
          <p className="text-sm text-neutral-400 mb-1">Total Balance (Filtered)</p>
          <p className="text-2xl font-bold text-lime-400">
            ${getTotalBalance().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-dark-card rounded-lg border border-dark-border p-4">
          <p className="text-sm text-neutral-400 mb-1">Currencies</p>
          <p className="text-2xl font-bold text-lime-400">{getUniqueCurrencies().length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-dark-card rounded-lg border border-dark-border p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">
              Search by User
            </label>
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"></i>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Email, name, or user ID..."
                className="input-dark w-full pl-10 pr-4 py-2 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">
              Filter by Currency
            </label>
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="input-dark w-full px-4 py-2 rounded-lg text-sm"
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
      <div className="bg-dark-card rounded-lg border border-dark-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-elevated border-b border-dark-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Currency
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Last Updated
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Source
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {filteredBalances.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <i className="ri-wallet-line text-neutral-500 text-4xl mb-2"></i>
                    <p className="text-neutral-400">No balances found</p>
                  </td>
                </tr>
              ) : (
                filteredBalances.map((balance, index) => (
                  <tr key={`${balance.user_id}-${balance.currency}-${index}`} className="hover:bg-dark-elevated transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-lime-500 rounded-full flex items-center justify-center">
                          <span className="text-black text-sm font-semibold">
                            {balance.user_email?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {balance.user_name || 'N/A'}
                          </p>
                          <p className="text-xs text-neutral-500">{balance.user_email || balance.user_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-lime-500/20 text-lime-400 text-xs font-semibold rounded-full border border-lime-500/30">
                        {balance.currency}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-lg font-bold text-lime-400">
                        ${parseFloat(balance.balance.toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-white">
                        {balance.updated_at
                          ? formatDate(balance.updated_at)
                          : 'N/A'}
                      </p>
                      {balance.updated_at && (
                        <p className="text-xs text-neutral-500">
                          {formatTime(balance.updated_at)}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2 py-1 bg-dark-elevated text-neutral-400 text-xs font-mono rounded border border-dark-border">
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
      <div className="bg-neutral-500/10 border border-neutral-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <i className="ri-information-line text-neutral-400 text-xl mt-0.5"></i>
          <div className="flex-1">
            <h3 className="text-neutral-400 font-semibold text-sm">Data Source Information</h3>
            <p className="text-neutral-400/90 text-sm mt-1">
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
