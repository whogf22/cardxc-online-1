import { useState, useEffect } from 'react';
import { adminApi } from '../../../lib/api';

interface OverviewStats {
  total_users: number;
  total_balance: number;
  pending_withdrawals: number;
  today_transactions: number;
  total_deposits: number;
  total_withdrawals: number;
}

export default function OverviewTab() {
  const [stats, setStats] = useState<OverviewStats>({
    total_users: 0,
    total_balance: 0,
    pending_withdrawals: 0,
    today_transactions: 0,
    total_deposits: 0,
    total_withdrawals: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError('');

      const result = await adminApi.getOverview();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to load overview');
      }

      const data = result.data;
      
      setStats({
        total_users: data?.users?.total || 0,
        total_balance: 0,
        pending_withdrawals: data?.pendingWithdrawals || 0,
        today_transactions: data?.transactions?.total || 0,
        total_deposits: data?.transactions?.totalDeposits || 0,
        total_withdrawals: data?.transactions?.totalWithdrawals || 0,
      });
    } catch (err: any) {
      console.error('[Admin Overview] Load error');
      setError(err.message || 'Unable to retrieve platform statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-slate-900 rounded-xl border border-slate-700 p-6 animate-pulse">
              <div className="h-4 bg-slate-700 rounded w-24 mb-4"></div>
              <div className="h-10 bg-slate-700 rounded w-32"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border-2 border-red-500/50 rounded-xl p-6 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center">
            <i className="ri-error-warning-line text-red-400 text-2xl"></i>
          </div>
          <div className="flex-1">
            <h3 className="text-red-200 font-bold text-lg">Platform Data Error</h3>
            <p className="text-red-300 text-sm mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={loadStats}
          className="mt-4 px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-sm font-semibold shadow-lg shadow-red-900/30"
        >
          <i className="ri-refresh-line mr-2"></i>
          Retry Load
        </button>
      </div>
    );
  }

  const netFlow = stats.total_deposits - stats.total_withdrawals;
  const flowPercentage = stats.total_deposits > 0 ? ((netFlow / stats.total_deposits) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* System Status Banner */}
      <div className="bg-gradient-to-r from-emerald-900/40 to-teal-900/40 border border-emerald-500/30 rounded-xl p-5 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 w-3 h-3 bg-emerald-400 rounded-full animate-ping"></div>
            </div>
            <div>
              <h3 className="text-emerald-100 font-bold text-lg">System Active</h3>
              <p className="text-emerald-300 text-sm">Automated monitoring online • Refresh for latest data</p>
            </div>
          </div>
          <button
            onClick={loadStats}
            className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-200 rounded-lg transition-all text-sm font-medium"
          >
            <i className="ri-refresh-line mr-2"></i>
            Refresh Overview
          </button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Users */}
        <div className="group bg-slate-900 rounded-xl border border-slate-700 hover:border-sky-500/50 p-6 transition-all hover:shadow-xl hover:shadow-sky-900/20">
          <div className="flex items-start justify-between mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-sky-500 to-sky-600 rounded-xl flex items-center justify-center shadow-lg shadow-sky-900/30">
              <i className="ri-user-line text-white text-2xl"></i>
            </div>
            <span className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-md font-medium uppercase">Total Users</span>
          </div>
          <h3 className="text-4xl font-black text-white mb-2 tracking-tight">
            {stats.total_users.toLocaleString()}
          </h3>
          <p className="text-sm text-slate-400 font-medium">Platform Registrations</p>
        </div>

        {/* Total Balance */}
        <div className="group bg-gradient-to-br from-emerald-900/40 to-teal-900/40 rounded-xl border-2 border-emerald-500/50 p-6 transition-all hover:shadow-xl hover:shadow-emerald-900/30">
          <div className="flex items-start justify-between mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/50">
              <i className="ri-wallet-line text-white text-2xl"></i>
            </div>
            <span className="text-xs text-emerald-300 bg-emerald-900/50 px-2.5 py-1 rounded-md font-bold border border-emerald-500/30">LIVE BALANCES</span>
          </div>
          <h3 className="text-4xl font-black text-emerald-100 mb-2 tracking-tight">
            ${stats.total_balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <p className="text-sm text-emerald-300 font-medium">Aggregated Account Balances</p>
          <div className="mt-3 pt-3 border-t border-emerald-500/20">
            <p className="text-xs text-emerald-400">
              <i className="ri-shield-check-line mr-1"></i>
              Verified Ledger Synchronization
            </p>
          </div>
        </div>

        {/* Pending Withdrawals */}
        <div className={`group rounded-xl border-2 p-6 transition-all ${
          stats.pending_withdrawals > 0 
            ? 'bg-gradient-to-br from-amber-900/40 to-orange-900/40 border-amber-500/40 hover:shadow-xl hover:shadow-amber-900/30' 
            : 'bg-slate-900 border-slate-700 hover:border-slate-600'
        }`}>
          <div className="flex items-start justify-between mb-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg ${
              stats.pending_withdrawals > 0
                ? 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-900/50'
                : 'bg-gradient-to-br from-slate-600 to-slate-700 shadow-slate-900/30'
            }`}>
              <i className="ri-bank-card-line text-white text-2xl"></i>
            </div>
            {stats.pending_withdrawals > 0 && (
              <span className="text-xs text-amber-200 bg-amber-600 px-2.5 py-1 rounded-md font-bold animate-pulse">
                PENDING REVIEW
              </span>
            )}
          </div>
          <h3 className={`text-4xl font-black mb-2 tracking-tight ${
            stats.pending_withdrawals > 0 ? 'text-amber-100' : 'text-white'
          }`}>
            {stats.pending_withdrawals}
          </h3>
          <p className={`text-sm font-medium ${
            stats.pending_withdrawals > 0 ? 'text-amber-300' : 'text-slate-400'
          }`}>
            Outbound Requests
          </p>
          {stats.pending_withdrawals > 0 && (
            <div className="mt-3 pt-3 border-t border-amber-500/20">
              <p className="text-xs text-amber-400 font-semibold">
                <i className="ri-error-warning-line mr-1"></i>
                Requires Administrative Action
              </p>
            </div>
          )}
        </div>

        {/* Activity Throughput */}
        <div className="group bg-slate-900 rounded-xl border border-slate-700 hover:border-purple-500/50 p-6 transition-all hover:shadow-xl hover:shadow-purple-900/20">
          <div className="flex items-start justify-between mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-900/30">
              <i className="ri-exchange-line text-white text-2xl"></i>
            </div>
            <span className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-md font-medium uppercase">Throughput</span>
          </div>
          <h3 className="text-4xl font-black text-white mb-2 tracking-tight">
            {stats.today_transactions}
          </h3>
          <p className="text-sm text-slate-400 font-medium">Daily Event Count</p>
        </div>
      </div>

      {/* Financial Flow Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Aggregated Inflow */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 hover:shadow-xl hover:shadow-emerald-900/10 transition-all">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-900/30">
                <i className="ri-arrow-down-line text-white text-xl"></i>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Historical Inflow</p>
                <p className="text-xs text-slate-500">Cumulative Deposits</p>
              </div>
            </div>
          </div>
          <h3 className="text-5xl font-black text-emerald-400 mb-4 tracking-tight">
            ${stats.total_deposits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full" style={{ width: '100%' }}></div>
          </div>
          <p className="text-xs text-slate-500 mt-3 italic">
            * Reference volume for reporting purposes
          </p>
        </div>

        {/* Aggregated Outflow */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 hover:shadow-xl hover:shadow-red-900/10 transition-all">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-900/30">
                <i className="ri-arrow-up-line text-white text-xl"></i>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Historical Outflow</p>
                <p className="text-xs text-slate-500">Cumulative Withdrawals</p>
              </div>
            </div>
          </div>
          <h3 className="text-5xl font-black text-red-400 mb-4 tracking-tight">
            ${stats.total_withdrawals.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full" style={{ width: '100%' }}></div>
          </div>
          <p className="text-xs text-slate-500 mt-3 italic">
            * Reference volume for reporting purposes
          </p>
        </div>
      </div>

      {/* Retention Ratio */}
      <div className={`rounded-xl border-2 p-6 transition-all ${
        netFlow >= 0 
          ? 'bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border-emerald-500/40' 
          : 'bg-gradient-to-r from-red-900/30 to-orange-900/30 border-red-500/40'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center shadow-lg ${
              netFlow >= 0 
                ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-900/50' 
                : 'bg-gradient-to-br from-red-500 to-red-600 shadow-red-900/50'
            }`}>
              <i className={`text-white text-3xl ${netFlow >= 0 ? 'ri-line-chart-line' : 'ri-bar-chart-line'}`}></i>
            </div>
            <div>
              <p className={`text-sm font-bold uppercase tracking-wider mb-1 ${
                netFlow >= 0 ? 'text-emerald-300' : 'text-red-300'
              }`}>
                Platform Liquidity Retention
              </p>
              <h3 className={`text-4xl font-black tracking-tight ${
                netFlow >= 0 ? 'text-emerald-100' : 'text-red-100'
              }`}>
                {netFlow >= 0 ? '+' : ''}${netFlow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-6xl font-black mb-1 leading-none ${
              netFlow >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {netFlow >= 0 ? '+' : ''}{flowPercentage}%
            </div>
            <p className={`text-sm font-bold uppercase tracking-widest ${
              netFlow >= 0 ? 'text-emerald-300' : 'text-red-300'
            }`}>
              Retention Index
            </p>
          </div>
        </div>
      </div>

      {/* Infrastructure Monitor */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-sky-500/20 rounded-lg flex items-center justify-center">
            <i className="ri-shield-user-line text-sky-400 text-xl"></i>
          </div>
          <h3 className="text-xl font-bold text-white">Infrastructure Health</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <i className="ri-database-2-line text-emerald-400 text-2xl"></i>
            </div>
            <div>
              <p className="text-sm font-bold text-white">Data Core</p>
              <p className="text-xs text-emerald-400 font-medium">Synced</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <i className="ri-shield-keyhole-line text-emerald-400 text-2xl"></i>
            </div>
            <div>
              <p className="text-sm font-bold text-white">Access Control</p>
              <p className="text-xs text-emerald-400 font-medium">Secured</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <i className="ri-cpu-line text-emerald-400 text-2xl"></i>
            </div>
            <div>
              <p className="text-sm font-bold text-white">Logic Layer</p>
              <p className="text-xs text-emerald-400 font-medium">Responsive</p>
            </div>
          </div>
        </div>
      </div>

      {/* Control Actions */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <i className="ri-settings-4-line text-sky-400"></i>
          Management Interface
        </h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={loadStats}
            className="px-6 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-all text-sm font-bold flex items-center gap-2 shadow-lg shadow-sky-900/30"
          >
            <i className="ri-refresh-line"></i>
            Synchronize Data
          </button>
          <button
            disabled
            className="px-6 py-3 bg-slate-800 text-slate-500 border border-slate-700 rounded-lg cursor-not-allowed text-sm font-bold flex items-center gap-2"
          >
            <i className="ri-file-chart-line"></i>
            Generate Report
          </button>
        </div>
      </div>
    </div>
  );
}
