import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../../lib/apiClient';

interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values: any;
  new_values: any;
  ip_address: string;
  user_agent: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

export default function LedgerExplorerTab() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const entriesPerPage = 50;

  const loadAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get('/admin/audit-logs?limit=500');
      
      if (response.success) {
        setEntries(response.data?.logs || []);
      }
    } catch (err: any) {
      console.error('[LedgerExplorerTab] Error loading audit logs:', err);
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const actionTypes = ['all', ...new Set(entries.map(e => e.action))];

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.entity_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.user_email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = filterAction === 'all' || entry.action === filterAction;
    return matchesSearch && matchesAction;
  });

  const totalPages = Math.ceil(filteredEntries.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const paginatedEntries = filteredEntries.slice(startIndex, startIndex + entriesPerPage);

  const getActionBadge = (action: string) => {
    if (action.includes('APPROVED') || action.includes('SUCCESS')) 
      return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    if (action.includes('REJECTED') || action.includes('FAILED')) 
      return 'bg-red-500/20 text-red-400 border border-red-500/30';
    if (action.includes('CREATED') || action.includes('REQUESTED')) 
      return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
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
          <h2 className="text-2xl font-bold text-white">Audit Log Explorer</h2>
          <p className="text-slate-400 mt-1">Browse system activity and audit trail</p>
        </div>
        <button 
          onClick={loadAuditLogs}
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
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              placeholder="Search by action, entity, or user email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
            />
          </div>

          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all cursor-pointer appearance-none min-w-[180px]"
          >
            {actionTypes.slice(0, 20).map((action) => (
              <option key={action} value={action}>
                {action === 'all' ? 'All Actions' : action.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-700/50">
          <div className="p-4 bg-slate-900/50 rounded-xl">
            <p className="text-2xl font-bold text-white">{filteredEntries.length}</p>
            <p className="text-sm text-slate-400">Total Entries</p>
          </div>
          <div className="p-4 bg-slate-900/50 rounded-xl">
            <p className="text-2xl font-bold text-emerald-400">
              {filteredEntries.filter(e => e.action.includes('APPROVED')).length}
            </p>
            <p className="text-sm text-slate-400">Approvals</p>
          </div>
          <div className="p-4 bg-slate-900/50 rounded-xl">
            <p className="text-2xl font-bold text-red-400">
              {filteredEntries.filter(e => e.action.includes('REJECTED')).length}
            </p>
            <p className="text-sm text-slate-400">Rejections</p>
          </div>
          <div className="p-4 bg-slate-900/50 rounded-xl">
            <p className="text-2xl font-bold text-amber-400">
              {filteredEntries.filter(e => e.action.includes('CREATED') || e.action.includes('REQUESTED')).length}
            </p>
            <p className="text-sm text-slate-400">Requests</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-700/50">
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">User</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Action</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Entity</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="ri-file-list-3-line text-3xl text-slate-500"></i>
                    </div>
                    <p className="text-slate-400 font-medium">No audit logs found</p>
                    <p className="text-slate-500 text-sm mt-1">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((entry, index) => (
                  <tr 
                    key={entry.id} 
                    className={`border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors ${
                      index % 2 === 0 ? 'bg-slate-800/20' : 'bg-transparent'
                    }`}
                  >
                    <td className="px-6 py-4">
                      <p className="text-white text-sm font-medium">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(entry.created_at).toLocaleTimeString()}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-white text-sm font-medium">{entry.user_name || 'System'}</p>
                      <p className="text-xs text-slate-400">{entry.user_email || 'N/A'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold ${getActionBadge(entry.action)}`}>
                        {entry.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-white text-sm font-medium">{entry.entity_type}</p>
                      <p className="text-xs text-slate-400 font-mono">{entry.entity_id?.slice(0, 8)}...</p>
                    </td>
                    <td className="px-6 py-4">
                      {entry.new_values && (
                        <p className="text-xs text-slate-400 max-w-xs truncate font-mono">
                          {JSON.stringify(entry.new_values)}
                        </p>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-700/50 bg-slate-900/30">
            <p className="text-sm text-slate-400">
              Showing {startIndex + 1} to {Math.min(startIndex + entriesPerPage, filteredEntries.length)} of {filteredEntries.length} entries
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all font-medium cursor-pointer"
              >
                <i className="ri-arrow-left-s-line"></i>
                Previous
              </button>
              <div className="flex items-center gap-1 px-3">
                <span className="text-white font-medium">{currentPage}</span>
                <span className="text-slate-400">/</span>
                <span className="text-slate-400">{totalPages}</span>
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all font-medium cursor-pointer"
              >
                Next
                <i className="ri-arrow-right-s-line"></i>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
