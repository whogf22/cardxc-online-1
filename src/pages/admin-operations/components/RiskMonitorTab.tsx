import { useState, useEffect } from 'react';
import { adminApi } from '../../../lib/api';

interface RiskIndicator {
  id: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  risk_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  amount?: number;
  currency?: string;
  description: string;
  detected_at: string;
}

export default function RiskMonitorTab() {
  const [riskIndicators, setRiskIndicators] = useState<RiskIndicator[]>([]);
  const [filteredIndicators, setFilteredIndicators] = useState<RiskIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  useEffect(() => {
    loadRiskIndicators();
  }, []);

  useEffect(() => {
    filterIndicators();
  }, [riskIndicators, severityFilter]);

  const loadRiskIndicators = async () => {
    try {
      setLoading(true);
      setError('');

      const [withdrawalsResult, ledgerResult, usersResult] = await Promise.all([
        adminApi.getWithdrawals(),
        adminApi.getLedger(500),
        adminApi.getUsers()
      ]);

      const indicators: RiskIndicator[] = [];
      const withdrawals = withdrawalsResult.data?.withdrawals || [];
      const ledgerEntries = ledgerResult.data?.entries || [];
      const profiles = usersResult.data?.users || [];

      const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

      // 1. Check for high-value withdrawals (>$10,000)
      withdrawals
        .filter((w: any) => w.status === 'pending' && parseFloat(w.amount) >= 10000)
        .forEach((w: any) => {
          const profile = profileMap.get(w.user_id);
          indicators.push({
            id: `high-value-${w.id}`,
            user_id: w.user_id,
            user_email: profile?.email,
            user_name: profile?.full_name,
            risk_type: 'High-Value Withdrawal',
            severity: parseFloat(w.amount) > 50000 ? 'critical' : 'high',
            amount: w.amount,
            currency: w.currency,
            description: `Withdrawal request of ${w.currency} ${parseFloat(w.amount).toLocaleString()} pending approval`,
            detected_at: w.created_at,
          });
        });

      // 2. Check for repeated failed transactions
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const recentFailedTxns = ledgerEntries.filter(
        (e: any) => e.status === 'failed' && new Date(e.created_at) >= oneHourAgo
      );

      const failuresByUser: Record<string, number> = {};
      recentFailedTxns.forEach((txn: any) => {
        failuresByUser[txn.user_id] = (failuresByUser[txn.user_id] || 0) + 1;
      });

      Object.entries(failuresByUser).forEach(([userId, count]) => {
        if (count >= 3) {
          const profile = profileMap.get(userId);
          indicators.push({
            id: `repeated-failures-${userId}`,
            user_id: userId,
            user_email: profile?.email,
            user_name: profile?.full_name,
            risk_type: 'Repeated Failures',
            severity: count >= 5 ? 'high' : 'medium',
            description: `${count} failed transactions in the last hour`,
            detected_at: new Date().toISOString(),
          });
        }
      });

      // 3. Check for insufficient balance attempts
      const pendingWithdrawals = withdrawals.filter((w: any) => w.status === 'pending');
      pendingWithdrawals.forEach((w: any) => {
        const profile = profileMap.get(w.user_id);
        const userBalance = profile?.balance || 0;
        if (parseFloat(w.amount) > userBalance) {
          indicators.push({
            id: `insufficient-balance-${w.id}`,
            user_id: w.user_id,
            user_email: profile?.email,
            user_name: profile?.full_name,
            risk_type: 'Insufficient Balance',
            severity: 'critical',
            amount: w.amount,
            currency: w.currency,
            description: `Withdrawal request exceeds available balance (${w.currency} ${userBalance.toLocaleString()})`,
            detected_at: w.created_at,
          });
        }
      });

      // 4. Check for rapid transaction velocity
      const recentTxns = ledgerEntries.filter(
        (e: any) => new Date(e.created_at) >= oneHourAgo
      );

      const txnsByUser: Record<string, number> = {};
      recentTxns.forEach((txn: any) => {
        txnsByUser[txn.user_id] = (txnsByUser[txn.user_id] || 0) + 1;
      });

      Object.entries(txnsByUser).forEach(([userId, count]) => {
        if (count >= 10) {
          const profile = profileMap.get(userId);
          indicators.push({
            id: `high-velocity-${userId}`,
            user_id: userId,
            user_email: profile?.email,
            user_name: profile?.full_name,
            risk_type: 'High Transaction Velocity',
            severity: count >= 20 ? 'high' : 'medium',
            description: `${count} transactions in the last hour`,
            detected_at: new Date().toISOString(),
          });
        }
      });

      // Sort by severity and date
      indicators.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;
        return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime();
      });

      setRiskIndicators(indicators);
    } catch (err: any) {
      console.error('Error loading risk indicators:', err);
      setError(err.message || 'Failed to load risk indicators');
    } finally {
      setLoading(false);
    }
  };

  const filterIndicators = () => {
    let filtered = [...riskIndicators];

    if (severityFilter !== 'all') {
      filtered = filtered.filter((indicator) => indicator.severity === severityFilter);
    }

    setFilteredIndicators(filtered);
  };

  const getSeverityBadge = (severity: string) => {
    const styles = {
      critical: 'bg-red-100 text-red-700 border-red-300',
      high: 'bg-orange-100 text-orange-700 border-orange-300',
      medium: 'bg-amber-100 text-amber-700 border-amber-300',
      low: 'bg-green-100 text-green-700 border-green-300',
    };
    return styles[severity as keyof typeof styles] || styles.low;
  };

  const getSeverityIcon = (severity: string) => {
    const icons = {
      critical: 'ri-error-warning-line',
      high: 'ri-alert-line',
      medium: 'ri-information-line',
      low: 'ri-checkbox-circle-line',
    };
    return icons[severity as keyof typeof icons] || icons.low;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6 animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-48 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-slate-100 rounded"></div>
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
            <h3 className="text-red-900 font-semibold">Error Loading Risk Indicators</h3>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={loadRiskIndicators}
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
          <i className="ri-shield-check-line text-blue-600 text-xl mt-0.5"></i>
          <div className="flex-1">
            <h3 className="text-blue-900 font-semibold text-sm">Real-Time Risk Monitoring</h3>
            <p className="text-blue-700 text-sm mt-1">
              Risk indicators are automatically detected from transaction patterns, withdrawal requests, and user behavior.
              All risk mitigation actions must be performed via API Gateway with proper authorization.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-600 mb-1">Total Indicators</p>
          <p className="text-2xl font-bold text-slate-900">{riskIndicators.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-red-200 p-4">
          <p className="text-sm text-slate-600 mb-1">Critical</p>
          <p className="text-2xl font-bold text-red-600">
            {riskIndicators.filter((i) => i.severity === 'critical').length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-orange-200 p-4">
          <p className="text-sm text-slate-600 mb-1">High</p>
          <p className="text-2xl font-bold text-orange-600">
            {riskIndicators.filter((i) => i.severity === 'high').length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-amber-200 p-4">
          <p className="text-sm text-slate-600 mb-1">Medium</p>
          <p className="text-2xl font-bold text-amber-600">
            {riskIndicators.filter((i) => i.severity === 'medium').length}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Filter by Severity
        </label>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="w-full md:w-64 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Risk Indicators List */}
      <div className="space-y-4">
        {filteredIndicators.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <i className="ri-shield-check-line text-green-500 text-5xl mb-4"></i>
            <p className="text-slate-500 text-lg">No risk indicators detected</p>
            <p className="text-slate-400 text-sm mt-2">All systems operating normally</p>
          </div>
        ) : (
          filteredIndicators.map((indicator) => (
            <div
              key={indicator.id}
              className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${getSeverityBadge(
                      indicator.severity
                    )}`}
                  >
                    <i className={`${getSeverityIcon(indicator.severity)} text-2xl`}></i>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {indicator.risk_type}
                    </h3>
                    <p className="text-sm text-slate-600">{indicator.description}</p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 text-xs font-bold rounded-full border ${getSeverityBadge(
                    indicator.severity
                  )}`}
                >
                  {indicator.severity.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">User</p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-semibold">
                        {indicator.user_email?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {indicator.user_name || 'N/A'}
                      </p>
                      <p className="text-xs text-slate-500">{indicator.user_email}</p>
                    </div>
                  </div>
                </div>
                {indicator.amount && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Amount</p>
                    <p className="text-lg font-bold text-slate-900">
                      {indicator.currency} {parseFloat(indicator.amount.toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-500 mb-1">Detected At</p>
                  <p className="text-sm text-slate-900">
                    {new Date(indicator.detected_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors text-sm font-medium flex items-center gap-2">
                  <i className="ri-eye-line"></i>
                  View Details
                </button>
                <button className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium flex items-center gap-2">
                  <i className="ri-flag-line"></i>
                  Flag User
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Refresh Button */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <button
          onClick={loadRiskIndicators}
          className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors text-sm font-medium flex items-center gap-2"
        >
          <i className="ri-refresh-line"></i>
          Refresh Risk Indicators
        </button>
      </div>
    </div>
  );
}
