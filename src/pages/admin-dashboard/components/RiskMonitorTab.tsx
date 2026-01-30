import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../../lib/apiClient';
import { useToastContext } from '../../../contexts/ToastContext';

interface FraudFlag {
  id: string;
  user_id: string;
  transaction_id?: string;
  flag_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: any;
  status: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

export default function RiskMonitorTab() {
  const toast = useToastContext();
  const [flags, setFlags] = useState<FraudFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'reviewed'>('all');
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const loadFraudFlags = useCallback(async () => {
    try {
      setLoading(true);
      
      const params: Record<string, string> = {};
      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }
      if (filterSeverity !== 'all') {
        params.severity = filterSeverity;
      }

      const queryString = new URLSearchParams(params).toString();
      const response = await apiClient.get(`/admin/fraud-flags${queryString ? `?${queryString}` : ''}`);
      
      if (response.success) {
        setFlags(response.data?.flags || []);
      }
    } catch (error: any) {
      console.error('[RiskMonitorTab] Error loading fraud flags:', error);
      toast.error(error.message || 'Failed to load risk indicators');
    } finally {
      setLoading(false);
    }
  }, [filterSeverity, filterStatus, toast]);

  useEffect(() => {
    loadFraudFlags();
  }, [loadFraudFlags]);

  const handleReviewFlag = async (flagId: string, newStatus: string) => {
    try {
      setReviewingId(flagId);
      
      await apiClient.post(`/admin/fraud-flags/${flagId}/review`, {
        status: newStatus,
        notes: `Reviewed and marked as ${newStatus}`,
      });

      toast.success('Fraud flag reviewed successfully');
      await loadFraudFlags();
    } catch (error: any) {
      console.error('[RiskMonitorTab] Error reviewing flag:', error);
      toast.error(error.message || 'Failed to review flag');
    } finally {
      setReviewingId(null);
    }
  };

  const filteredFlags = flags.filter(f => {
    if (filterSeverity !== 'all' && f.severity !== filterSeverity) return false;
    if (filterStatus === 'active' && f.status !== 'active') return false;
    if (filterStatus === 'reviewed' && f.status === 'active') return false;
    return true;
  });

  const getSeverityConfig = (severity: string) => {
    const configs: Record<string, { bg: string; border: string; text: string; icon: string }> = {
      LOW: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400', icon: 'ri-information-line' },
      MEDIUM: { bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-400', icon: 'ri-alert-line' },
      HIGH: { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400', icon: 'ri-error-warning-line' },
      CRITICAL: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400', icon: 'ri-alarm-warning-line' },
    };
    return configs[severity] || configs.LOW;
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      LARGE_TRANSACTION: 'ri-money-dollar-circle-line',
      VELOCITY_CHECK: 'ri-speed-line',
      NEW_DEVICE: 'ri-device-line',
      SUSPICIOUS_PATTERN: 'ri-error-warning-line',
      FAILED_LOGIN: 'ri-shield-cross-line',
    };
    return icons[type] || 'ri-alert-line';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 animate-pulse">
          <div className="h-10 bg-slate-700 rounded-xl mb-6"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-slate-700/50 rounded-xl"></div>
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
          <h2 className="text-2xl font-bold text-white">Risk Monitor</h2>
          <p className="text-slate-400 mt-1">Track suspicious activity and security alerts</p>
        </div>
        <button 
          onClick={loadFraudFlags}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all duration-200 font-medium border border-slate-700 hover:border-slate-600"
        >
          <i className={`ri-refresh-line ${loading ? 'animate-spin' : ''}`}></i>
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { severity: 'LOW', label: 'Low Risk', color: 'blue' },
          { severity: 'MEDIUM', label: 'Medium Risk', color: 'amber' },
          { severity: 'HIGH', label: 'High Risk', color: 'orange' },
          { severity: 'CRITICAL', label: 'Critical Risk', color: 'red' },
        ].map((item) => {
          const config = getSeverityConfig(item.severity);
          const count = flags.filter(f => f.severity === item.severity).length;
          return (
            <div 
              key={item.severity} 
              className={`bg-slate-800/50 rounded-2xl p-5 border ${config.border} group hover:scale-[1.02] transition-transform`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 ${config.bg} rounded-xl flex items-center justify-center`}>
                  <i className={`${config.icon} ${config.text} text-xl`}></i>
                </div>
                <span className={`px-2.5 py-1 ${config.bg} ${config.text} text-xs font-bold rounded-full border ${config.border}`}>
                  {item.severity}
                </span>
              </div>
              <p className="text-3xl font-bold text-white mb-1">{count}</p>
              <p className="text-sm text-slate-400">{item.label}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400 text-sm">Severity:</span>
            {(['all', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((severity) => (
              <button
                key={severity}
                onClick={() => setFilterSeverity(severity)}
                className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
                  filterSeverity === severity
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                    : 'bg-slate-900/50 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600'
                }`}
              >
                {severity === 'all' ? 'All' : severity}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400 text-sm">Status:</span>
            {(['all', 'active', 'reviewed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
                  filterStatus === status
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                    : 'bg-slate-900/50 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredFlags.length === 0 ? (
          <div className="bg-slate-800/50 rounded-2xl p-16 border border-slate-700/50 text-center">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-shield-check-line text-4xl text-emerald-400"></i>
            </div>
            <p className="text-xl font-bold text-white mb-2">No Risk Indicators</p>
            <p className="text-slate-400">All systems operating normally</p>
          </div>
        ) : (
          filteredFlags.map((flag) => {
            const severityConfig = getSeverityConfig(flag.severity);
            return (
              <div
                key={flag.id}
                className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${severityConfig.bg}`}>
                    <i className={`${getTypeIcon(flag.flag_type)} text-2xl ${severityConfig.text}`}></i>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <h3 className="text-lg font-bold text-white">
                        {flag.flag_type.replace(/_/g, ' ')}
                      </h3>
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${severityConfig.bg} ${severityConfig.text} ${severityConfig.border}`}>
                        {flag.severity}
                      </span>
                      {flag.status !== 'active' && (
                        <span className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          REVIEWED
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">User</p>
                        <p className="text-sm font-medium text-white">{flag.user_name || 'Unknown'}</p>
                        <p className="text-xs text-slate-400">{flag.user_email}</p>
                      </div>
                      {flag.details?.amount && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Amount</p>
                          <p className="text-sm font-bold text-white">
                            ${(flag.details.amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Detected</p>
                        <p className="text-sm font-medium text-white">
                          {new Date(flag.created_at).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-slate-400">
                          {new Date(flag.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>

                    {flag.details?.description && (
                      <p className="text-sm text-slate-300 mb-4 p-3 bg-slate-900/50 rounded-lg">{flag.details.description}</p>
                    )}

                    {flag.status === 'active' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleReviewFlag(flag.id, 'reviewed')}
                          disabled={reviewingId === flag.id}
                          className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-xl text-sm font-medium transition-all cursor-pointer disabled:opacity-50 border border-emerald-500/30"
                        >
                          {reviewingId === flag.id ? (
                            <i className="ri-loader-4-line animate-spin mr-1"></i>
                          ) : (
                            <i className="ri-check-line mr-1"></i>
                          )}
                          Mark Reviewed
                        </button>
                        <button 
                          onClick={() => handleReviewFlag(flag.id, 'dismissed')}
                          disabled={reviewingId === flag.id}
                          className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-all cursor-pointer disabled:opacity-50 border border-slate-600"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
