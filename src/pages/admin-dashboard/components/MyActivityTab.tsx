import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../../lib/apiClient';
import { useAuthContext } from '../../../contexts/AuthContext';

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values: any;
  new_values: any;
  ip_address: string;
  created_at: string;
}

export default function MyActivityTab() {
  const { user } = useAuthContext();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const limit = 20;

  const loadActivity = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get(`/admin/my-activity?limit=${limit}&offset=${page * limit}`);
      
      if (response.success) {
        setLogs(response.data?.logs || []);
        setTotal(response.data?.total || 0);
      }
    } catch (err: any) {
      console.error('[MyActivityTab] Error loading activity:', err);
      setError(err.message || 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const getActionIcon = (action: string) => {
    const icons: Record<string, { icon: string; color: string; bg: string }> = {
      'USER_CREATED_BY_ADMIN': { icon: 'ri-user-add-line', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
      'USER_PASSWORD_RESET': { icon: 'ri-key-2-line', color: 'text-amber-400', bg: 'bg-amber-500/20' },
      'USER_STATUS_CHANGED': { icon: 'ri-user-settings-line', color: 'text-blue-400', bg: 'bg-blue-500/20' },
      'KYC_STATUS_CHANGED': { icon: 'ri-file-user-line', color: 'text-purple-400', bg: 'bg-purple-500/20' },
      'ADJUSTMENT_CREATED': { icon: 'ri-add-circle-line', color: 'text-blue-400', bg: 'bg-blue-500/20' },
      'ADJUSTMENT_APPROVED': { icon: 'ri-checkbox-circle-line', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
      'ADJUSTMENT_REJECTED': { icon: 'ri-close-circle-line', color: 'text-red-400', bg: 'bg-red-500/20' },
      'CARD_DEPOSIT': { icon: 'ri-bank-card-line', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
      'FRAUD_FLAG_REVIEWED': { icon: 'ri-shield-check-line', color: 'text-amber-400', bg: 'bg-amber-500/20' },
      'LOGIN_SUCCESS': { icon: 'ri-login-box-line', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
      'LOGIN_FAILED': { icon: 'ri-error-warning-line', color: 'text-red-400', bg: 'bg-red-500/20' },
    };
    return icons[action] || { icon: 'ri-history-line', color: 'text-slate-400', bg: 'bg-slate-500/20' };
  };

  const formatAction = (action: string) => {
    return action.split('_').map(word => 
      word.charAt(0) + word.slice(1).toLowerCase()
    ).join(' ');
  };

  const totalPages = Math.ceil(total / limit);

  if (loading && logs.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 animate-pulse">
          <div className="h-10 bg-slate-700 rounded-xl mb-6 w-48"></div>
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
          <h2 className="text-2xl font-bold text-white">My Activity</h2>
          <p className="text-slate-400 mt-1">View your admin actions and activity log</p>
        </div>
        <button 
          onClick={loadActivity}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all duration-200 font-medium border border-slate-700 hover:border-slate-600 disabled:opacity-50 cursor-pointer"
        >
          <i className={`ri-refresh-line ${loading ? 'animate-spin' : ''}`}></i>
          Refresh
        </button>
      </div>

      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="text-white font-bold text-xl">
              {user?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'A'}
            </span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white">{user?.full_name || 'Admin'}</h3>
            <p className="text-sm text-slate-400">{user?.email}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-white">{total}</p>
            <p className="text-sm text-slate-400">Total Actions</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <i className="ri-error-warning-line text-red-400 text-xl"></i>
          </div>
          <p className="text-red-400">{error}</p>
        </div>
      )}

      <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
        {logs.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-history-line text-3xl text-slate-500"></i>
            </div>
            <p className="text-slate-400 font-medium">No activity recorded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/30">
            {logs.map((log, index) => {
              const { icon, color, bg } = getActionIcon(log.action);
              return (
                <div 
                  key={log.id} 
                  className={`px-6 py-4 hover:bg-slate-700/20 transition-colors ${
                    index % 2 === 0 ? 'bg-slate-800/20' : 'bg-transparent'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                      <i className={`${icon} ${color}`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium">{formatAction(log.action)}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {log.entity_type && (
                          <span className="px-2.5 py-1 bg-slate-700/50 rounded-lg text-xs text-slate-300 border border-slate-600/50">
                            {log.entity_type}
                          </span>
                        )}
                        {log.entity_id && (
                          <span className="px-2.5 py-1 bg-slate-700/50 rounded-lg text-xs text-slate-400 font-mono border border-slate-600/50">
                            {log.entity_id.substring(0, 8)}...
                          </span>
                        )}
                      </div>
                      {log.new_values && Object.keys(log.new_values).length > 0 && (
                        <div className="mt-3 text-xs text-slate-400 bg-slate-900/50 rounded-lg p-3 font-mono overflow-x-auto border border-slate-700/50">
                          {Object.entries(log.new_values).map(([key, value]) => (
                            <div key={key}>
                              <span className="text-slate-500">{key}:</span>{' '}
                              <span className="text-slate-300">{JSON.stringify(value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm text-slate-300">
                        {new Date(log.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </p>
                      {log.ip_address && (
                        <p className="text-xs text-slate-600 mt-1 font-mono">{log.ip_address}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-700/50 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/30">
            <p className="text-sm text-slate-400">
              Showing {page * limit + 1} - {Math.min((page + 1) * limit, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="inline-flex items-center gap-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <i className="ri-arrow-left-s-line"></i>
                Prev
              </button>
              <span className="px-3 py-2 text-slate-400 text-sm">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="inline-flex items-center gap-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
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
