import { useState, useEffect } from 'react';
import { adminApi } from '../../../lib/api';

interface LedgerEntry {
  id: string;
  user_id: string;
  entry_type: 'credit' | 'debit';
  amount: number;
  currency: string;
  provider?: string;
  reference: string;
  description?: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  user_email?: string;
  user_name?: string;
}

export default function LedgerExplorerTab() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 50;

  useEffect(() => {
    loadLedgerEntries();
  }, []);

  useEffect(() => {
    filterEntries();
  }, [entries, searchTerm, typeFilter, statusFilter]);

  const loadLedgerEntries = async () => {
    try {
      setLoading(true);
      setError('');

      const [ledgerResult, usersResult] = await Promise.all([
        adminApi.getLedger(500),
        adminApi.getUsers()
      ]);

      if (!ledgerResult.success) {
        throw new Error(ledgerResult.error?.message || 'Failed to load ledger entries');
      }

      const ledgerData = ledgerResult.data?.entries || [];
      const profiles = usersResult.data?.users || [];

      const enrichedEntries = ledgerData.map((entry: any) => {
        const profile = profiles.find((p: any) => p.id === entry.user_id);
        return {
          ...entry,
          user_email: profile?.email,
          user_name: profile?.full_name,
        };
      });

      setEntries(enrichedEntries);
    } catch (err: any) {
      console.error('Error loading ledger entries:', err);
      setError(err.message || 'Failed to load ledger entries');
    } finally {
      setLoading(false);
    }
  };

  const filterEntries = () => {
    let filtered = [...entries];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (entry) =>
          entry.description?.toLowerCase().includes(term) ||
          entry.reference?.toLowerCase().includes(term) ||
          entry.user_email?.toLowerCase().includes(term) ||
          entry.user_name?.toLowerCase().includes(term)
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((entry) => entry.entry_type === typeFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((entry) => entry.status === statusFilter);
    }

    setFilteredEntries(filtered);
    setCurrentPage(1);
  };

  const getPaginatedEntries = () => {
    const startIndex = (currentPage - 1) * entriesPerPage;
    const endIndex = startIndex + entriesPerPage;
    return filteredEntries.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(filteredEntries.length / entriesPerPage);

  const getTypeIcon = (type: string) => {
    return type === 'credit' ? 'ri-arrow-down-line' : 'ri-arrow-up-line';
  };

  const getTypeColor = (type: string) => {
    return type === 'credit'
      ? 'bg-green-100 text-green-700 border-green-200'
      : 'bg-red-100 text-red-700 border-red-200';
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: 'bg-green-100 text-green-700 border-green-200',
      pending: 'bg-amber-100 text-amber-700 border-amber-200',
      failed: 'bg-red-100 text-red-700 border-red-200',
    };
    return styles[status as keyof typeof styles] || styles.completed;
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
            <h3 className="text-red-900 font-semibold">Error Loading Ledger</h3>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={loadLedgerEntries}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <i className="ri-information-line text-blue-600 text-xl mt-0.5"></i>
          <div className="flex-1">
            <h3 className="text-blue-900 font-semibold text-sm">Immutable Transaction Ledger</h3>
            <p className="text-blue-700 text-sm mt-1">
              This ledger shows transaction <strong>amounts only</strong> (not balance snapshots).
              All entries are append-only and cannot be modified or deleted.
              Source: API (READ-ONLY).
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-600 mb-1">Total Entries</p>
          <p className="text-2xl font-bold text-slate-900">{entries.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-600 mb-1">Credits</p>
          <p className="text-2xl font-bold text-green-600">
            {entries.filter((e) => e.entry_type === 'credit').length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-600 mb-1">Debits</p>
          <p className="text-2xl font-bold text-red-600">
            {entries.filter((e) => e.entry_type === 'debit').length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-600 mb-1">Pending</p>
          <p className="text-2xl font-bold text-amber-600">
            {entries.filter((e) => e.status === 'pending').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Search Transactions
            </label>
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Description, reference, user..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Transaction Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm"
            >
              <option value="all">All Types</option>
              <option value="credit">Credits (Deposits)</option>
              <option value="debit">Debits (Withdrawals)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Transaction Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Reference
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {getPaginatedEntries().length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <i className="ri-file-list-line text-slate-300 text-4xl mb-2"></i>
                    <p className="text-slate-500">No ledger entries found</p>
                  </td>
                </tr>
              ) : (
                getPaginatedEntries().map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-900">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(entry.created_at).toLocaleTimeString()}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-semibold">
                            {entry.user_email?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {entry.user_name || 'N/A'}
                          </p>
                          <p className="text-xs text-slate-500">{entry.user_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 text-xs font-semibold rounded-full border flex items-center gap-1 w-fit ${getTypeColor(
                          entry.entry_type
                        )}`}
                      >
                        <i className={getTypeIcon(entry.entry_type)}></i>
                        {entry.entry_type === 'credit' ? 'Credit' : 'Debit'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-lg font-bold text-slate-900">
                        {entry.entry_type === 'credit' ? '+' : '-'}
                        {entry.currency} {parseFloat(entry.amount.toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-slate-500">{entry.description || 'N/A'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusBadge(
                          entry.status
                        )}`}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-mono text-slate-900">{entry.reference}</p>
                      {entry.provider && (
                        <p className="text-xs text-slate-500">{entry.provider}</p>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Showing {(currentPage - 1) * entriesPerPage + 1} to{' '}
                {Math.min(currentPage * entriesPerPage, filteredEntries.length)} of{' '}
                {filteredEntries.length} entries
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-4 py-2 bg-sky-100 border border-sky-200 rounded-lg text-sm font-medium text-sky-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
