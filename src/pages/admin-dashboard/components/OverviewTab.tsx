import { useState, useEffect } from 'react';
import { apiClient } from '../../../lib/apiClient';

interface OverviewStats {
  totalUsers: number;
  totalBalance: number;
  pendingWithdrawals: number;
  todayTransactions: number;
  activeFraudFlags: number;
  verifiedUsers: number;
}

export default function OverviewTab() {
  const [stats, setStats] = useState<OverviewStats>({
    totalUsers: 0,
    totalBalance: 0,
    pendingWithdrawals: 0,
    todayTransactions: 0,
    activeFraudFlags: 0,
    verifiedUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOverviewStats();
  }, []);

  const loadOverviewStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get('/admin/overview');
      
      if (response.success) {
        const data = response.data;
        setStats({
          totalUsers: data.users?.total || 0,
          totalBalance: data.transactions?.totalDeposits - data.transactions?.totalWithdrawals || 0,
          pendingWithdrawals: data.pendingWithdrawals || 0,
          todayTransactions: data.transactions?.total || 0,
          activeFraudFlags: data.activeFraudFlags || 0,
          verifiedUsers: data.users?.verified || 0,
        });
      }
    } catch (err: any) {
      console.error('[OverviewTab] Error loading stats:', err);
      setError(err.message || 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: 'Total Users',
      value: stats.totalUsers.toLocaleString(),
      icon: 'ri-user-line',
      trend: '+12%',
      trendUp: true,
      gradient: 'from-blue-500 to-cyan-500',
      bgGradient: 'from-blue-500/10 to-cyan-500/10',
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
    },
    {
      label: 'Net Deposits',
      value: `$${stats.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: 'ri-funds-line',
      trend: '+8.3%',
      trendUp: true,
      gradient: 'from-emerald-500 to-teal-500',
      bgGradient: 'from-emerald-500/10 to-teal-500/10',
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
    },
    {
      label: 'Pending Withdrawals',
      value: stats.pendingWithdrawals.toLocaleString(),
      icon: 'ri-time-line',
      trend: stats.pendingWithdrawals > 0 ? 'Action Required' : 'All Clear',
      trendUp: stats.pendingWithdrawals === 0,
      gradient: 'from-amber-500 to-orange-500',
      bgGradient: 'from-amber-500/10 to-orange-500/10',
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-400',
    },
    {
      label: 'Total Transactions',
      value: stats.todayTransactions.toLocaleString(),
      icon: 'ri-exchange-line',
      trend: '+15%',
      trendUp: true,
      gradient: 'from-purple-500 to-pink-500',
      bgGradient: 'from-purple-500/10 to-pink-500/10',
      iconBg: 'bg-purple-500/20',
      iconColor: 'text-purple-400',
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 animate-pulse">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-slate-700 rounded-xl"></div>
                <div className="w-16 h-5 bg-slate-700 rounded-full"></div>
              </div>
              <div className="h-9 bg-slate-700 rounded-lg mb-2 w-24"></div>
              <div className="h-4 bg-slate-700 rounded w-20"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="ri-error-warning-line text-red-400 text-3xl"></i>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Failed to Load Data</h3>
        <p className="text-red-400 mb-4">{error}</p>
        <button 
          onClick={loadOverviewStats}
          className="px-6 py-2.5 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-all duration-200 font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard Overview</h2>
          <p className="text-slate-400 mt-1">Monitor key metrics and system health</p>
        </div>
        <button 
          onClick={loadOverviewStats}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all duration-200 font-medium border border-slate-700 hover:border-slate-600"
        >
          <i className="ri-refresh-line"></i>
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
        {statCards.map((stat, index) => (
          <div
            key={stat.label}
            className="group bg-slate-800/50 hover:bg-slate-800/80 rounded-2xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/50"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 ${stat.iconBg} rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
                <i className={`${stat.icon} text-2xl ${stat.iconColor}`}></i>
              </div>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                stat.trendUp 
                  ? 'bg-emerald-500/10 text-emerald-400' 
                  : 'bg-amber-500/10 text-amber-400'
              }`}>
                {stat.trendUp && <i className="ri-arrow-up-line text-xs"></i>}
                {stat.trend}
              </span>
            </div>
            <p className="text-3xl font-bold text-white mb-1 tracking-tight">{stat.value}</p>
            <p className="text-sm text-slate-400 font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white">System Status</h3>
            <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-full">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-emerald-400 font-medium">All Systems Operational</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: 'ri-database-2-line', label: 'Database', status: 'Healthy', color: 'emerald' },
              { icon: 'ri-cloud-line', label: 'API Gateway', status: 'Healthy', color: 'emerald' },
              { icon: 'ri-shield-check-line', label: 'Security', status: 'Healthy', color: 'emerald' },
            ].map((service) => (
              <div key={service.label} className="flex items-center gap-3 p-4 bg-slate-900/50 rounded-xl border border-slate-700/30">
                <div className={`w-10 h-10 bg-${service.color}-500/20 rounded-lg flex items-center justify-center`}>
                  <i className={`${service.icon} text-${service.color}-400 text-xl`}></i>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{service.label}</p>
                  <p className={`text-xs text-${service.color}-400`}>{service.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-bold text-white mb-6">Quick Stats</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700/30 group hover:border-slate-600/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <i className="ri-user-star-line text-blue-400 text-xl"></i>
                </div>
                <span className="text-slate-300 font-medium">Verified Users</span>
              </div>
              <span className="text-xl font-bold text-white">{stats.verifiedUsers}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700/30 group hover:border-slate-600/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${stats.activeFraudFlags > 0 ? 'bg-red-500/20' : 'bg-emerald-500/20'} rounded-lg flex items-center justify-center`}>
                  <i className={`ri-shield-keyhole-line ${stats.activeFraudFlags > 0 ? 'text-red-400' : 'text-emerald-400'} text-xl`}></i>
                </div>
                <span className="text-slate-300 font-medium">Active Fraud Flags</span>
              </div>
              <span className={`text-xl font-bold ${stats.activeFraudFlags > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {stats.activeFraudFlags}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700/30 group hover:border-slate-600/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <i className="ri-pie-chart-line text-purple-400 text-xl"></i>
                </div>
                <span className="text-slate-300 font-medium">Verification Rate</span>
              </div>
              <span className="text-xl font-bold text-white">
                {stats.totalUsers > 0 ? Math.round((stats.verifiedUsers / stats.totalUsers) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
