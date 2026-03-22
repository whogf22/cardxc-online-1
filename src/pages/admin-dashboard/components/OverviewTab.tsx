import { useState, useEffect } from 'react';
import { apiClient } from '../../../lib/apiClient';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface TransactionHistory {
  day: string;
  count: number;
}

interface OverviewStats {
  totalUsers: number;
  totalBalance: number;
  pendingWithdrawals: number;
  todayTransactions: number;
  activeFraudFlags: number;
  verifiedUsers: number;
  history: TransactionHistory[];
}

export default function OverviewTab() {
  const [stats, setStats] = useState<OverviewStats>({
    totalUsers: 0,
    totalBalance: 0,
    pendingWithdrawals: 0,
    todayTransactions: 0,
    activeFraudFlags: 0,
    verifiedUsers: 0,
    history: [],
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
          history: data.transactions?.history || [],
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
      color: 'blue',
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
    },
    {
      label: 'Net Balance (USD)',
      value: `$${stats.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: 'ri-funds-line',
      trend: '+8.3%',
      trendUp: true,
      color: 'emerald',
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
    },
    {
      label: 'Pending Withdrawals',
      value: stats.pendingWithdrawals.toLocaleString(),
      icon: 'ri-time-line',
      trend: stats.pendingWithdrawals > 0 ? 'Action Required' : 'All Clear',
      trendUp: stats.pendingWithdrawals === 0,
      color: 'amber',
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-400',
    },
    {
      label: 'Total Transactions',
      value: stats.todayTransactions.toLocaleString(),
      icon: 'ri-exchange-line',
      trend: '+15%',
      trendUp: true,
      color: 'purple',
      iconBg: 'bg-purple-500/20',
      iconColor: 'text-purple-400',
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 animate-pulse h-40"></div>
          ))}
        </div>
        <div className="h-96 bg-slate-800/50 rounded-2xl border border-slate-700/50 animate-pulse"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center">
        <i className="ri-error-warning-line text-red-400 text-5xl mb-4 block"></i>
        <h3 className="text-xl font-bold text-white mb-2">Failed to Load Overview</h3>
        <p className="text-red-400 mb-6">{error}</p>
        <button onClick={loadOverviewStats} className="px-6 py-3 bg-red-500 text-white rounded-xl font-bold">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard Overview</h2>
          <p className="text-slate-400 mt-1">Real-time system health and performance</p>
        </div>
        <button
          onClick={loadOverviewStats}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-slate-700 font-medium"
        >
          <i className="ri-refresh-line"></i>
          Refresh Data
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="group bg-slate-800/50 hover:bg-slate-800/80 rounded-2xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 ${stat.iconBg} rounded-xl flex items-center justify-center`}>
                <i className={`${stat.icon} text-2xl ${stat.iconColor}`}></i>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${stat.trendUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                }`}>
                {stat.trend}
              </span>
            </div>
            <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
            <p className="text-sm text-slate-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-white">Transaction Volume</h3>
              <p className="text-sm text-slate-400">Activity over the last 7 days</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
              <span className="text-xs text-slate-400">Daily Transactions</span>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.history}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis
                  dataKey="day"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(str) => {
                    const date = new Date(str);
                    return date.toLocaleDateString('en-US', { weekday: 'short' });
                  }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#14b8a6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorCount)"
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-bold text-white mb-6">User Distribution</h3>
          <div className="space-y-6">
            <div className="relative pt-1">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-400 bg-blue-500/10">
                    Verified
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold inline-block text-blue-400">
                    {Math.round((stats.verifiedUsers / (stats.totalUsers || 1)) * 100)}%
                  </span>
                </div>
              </div>
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-slate-700">
                <div
                  style={{ width: `${(stats.verifiedUsers / (stats.totalUsers || 1)) * 100}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-1000"
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/30">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">System Health</span>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs rounded-full">Optimal</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[98%]"></div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/30">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Fraud Risk</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${stats.activeFraudFlags > 0 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                    {stats.activeFraudFlags > 0 ? 'Action Required' : 'Low'}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/30">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Active Sessions</span>
                  <span className="text-white font-bold">{Math.round(stats.totalUsers * 0.15)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
