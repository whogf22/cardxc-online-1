import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi, authApi } from '../../lib/api';
import WalletHeader from './components/WalletHeader';
import BalanceCards from './components/BalanceCards';
import QuickActions from './components/QuickActions';
import RecentTransactions from './components/RecentTransactions';
import DepositModal from './components/DepositModal';
import WithdrawModal from './components/WithdrawModal';
import {
  AreaChart,
  Area,
  XAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface WalletBalance {
  currency: string;
  available_balance: number;
  reserved_balance: number;
  total_balance: number;
}

interface Transaction {
  id: string;
  entry_type: 'credit' | 'debit';
  amount: number;
  currency: string;
  description: string;
  reference: string;
  created_at: string;
  status: string;
}

export default function WalletPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('NGN');

  const balanceChartData = useMemo(() => {
    if (transactions.length === 0) return [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayTotals: Record<string, number> = {};
    days.forEach(d => { dayTotals[d] = 0; });
    transactions.forEach(tx => {
      const day = days[new Date(tx.created_at).getDay()];
      const amt = tx.entry_type === 'credit' ? tx.amount : -tx.amount;
      dayTotals[day] = (dayTotals[day] || 0) + Math.abs(amt);
    });
    return days.map(day => ({ day, amount: Math.round(dayTotals[day] * 100) / 100 }));
  }, [transactions]);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    try {
      const sessionResult = await authApi.getSession();
      if (!sessionResult.success || !sessionResult.data?.user) {
        navigate('/signin');
        return;
      }
      setUser(sessionResult.data.user);
      await Promise.all([loadBalances(), loadTransactions()]);
    } catch (error) {
      console.error('[WalletPage] Auth check failed:', error);
      navigate('/signin');
    } finally {
      setLoading(false);
    }
  };

  const loadBalances = async () => {
    try {
      // Fetch combined wallet data (USD + USDT)
      const response = await fetch('/api/user/wallet', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();

      if (data.success && data.data) {
        const walletData = data.data;

        // Format as expected by BalanceCards
        setBalances([{
          currency: walletData.currency || 'USD',
          available_balance: (walletData.balance || 0) / 100,
          reserved_balance: (walletData.reserved_cents || 0) / 100,
          total_balance: ((walletData.balance || 0) + (walletData.reserved_cents || 0)) / 100,
        }]);
      } else {
        // Fallback to existing API method if dedicated endpoint fails
        const result = await userApi.getWallets();
        if (result.success) {
          setBalances(result.data.wallets.map((w: any) => ({
            currency: w.currency,
            available_balance: w.available_balance || 0,
            reserved_balance: w.reserved_balance || 0,
            total_balance: (w.available_balance || 0) + (w.reserved_balance || 0)
          })));
        }
      }
    } catch (e) {
      console.error('Failed to load balances', e);
    }
  };

  const loadTransactions = async () => {
    try {
      const result = await userApi.getTransactions({ limit: 10 });
      if (result.success) setTransactions(result.data.transactions);
    } catch (e) {
      console.error('[WalletPage] Failed to load transactions:', e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 font-medium">Loading Wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <WalletHeader user={user} />

      <main className="max-w-7xl mx-auto px-4 py-12 space-y-12">
        {/* Hero Section with Glassmorphism */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600/20 to-teal-600/20 rounded-3xl border border-white/10 p-8 backdrop-blur-xl">
              <div className="relative z-10 flex justify-between items-start">
                <div>
                  <h1 className="text-4xl font-extrabold tracking-tight mb-2">My Balance</h1>
                  <p className="text-slate-400 font-medium">Global Multi-Currency Account</p>
                </div>
                <div className="bg-white/10 p-4 rounded-2xl border border-white/10">
                  <i className="ri-safe-2-line text-3xl text-emerald-400"></i>
                </div>
              </div>

              <div className="mt-12">
                <BalanceCards
                  balances={balances}
                  onDeposit={(curr) => { setSelectedCurrency(curr); setShowDepositModal(true); }}
                  onWithdraw={(curr) => { setSelectedCurrency(curr); setShowWithdrawModal(true); }}
                />
              </div>
            </div>

            {/* Dynamic Chart Integration */}
            <div className="bg-slate-900/50 rounded-3xl border border-slate-800 p-6">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold">Balance Analytics</h3>
                <span className="text-xs font-bold text-slate-500 bg-slate-500/10 px-3 py-1 rounded-full uppercase">Weekly</span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={balanceChartData}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey="day" stroke="#475569" fontSize={12} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px' }}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#10b981" fillOpacity={1} fill="url(#colorAmount)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <QuickActions
              onDeposit={() => { setSelectedCurrency('USD'); setShowDepositModal(true); }}
              onWithdraw={() => { setSelectedCurrency('USD'); setShowWithdrawModal(true); }}
            />

            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-2xl shadow-blue-500/20">
              <h3 className="text-xl font-bold mb-4">Security Insights</h3>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                    <i className="ri-shield-check-line"></i>
                  </div>
                  <p className="text-sm opacity-90">Your account is secured with advanced encryption and monitoring.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                    <i className="ri-earth-line"></i>
                  </div>
                  <p className="text-sm opacity-90">All transactions are monitored for suspicious activity.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8">
          <RecentTransactions transactions={transactions} />
        </div>
      </main>

      {/* Modals Mapping */}
      {showDepositModal && <DepositModal currency={selectedCurrency} onClose={() => setShowDepositModal(false)} onSuccess={() => { loadBalances(); loadTransactions(); }} />}
      {showWithdrawModal && <WithdrawModal currency={selectedCurrency} availableBalance={balances.find(b => b.currency === selectedCurrency)?.available_balance || 0} onClose={() => setShowWithdrawModal(false)} onSuccess={() => { loadBalances(); loadTransactions(); }} />}
    </div>
  );
}
