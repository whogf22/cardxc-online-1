import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi, authApi } from '../../lib/api';
import { formatDateTime } from '../../lib/localeUtils';
import WalletHeader from './components/WalletHeader';
import BalanceCards from './components/BalanceCards';
import QuickActions from './components/QuickActions';
import RecentTransactions from './components/RecentTransactions';
import DepositModal from './components/DepositModal';
import WithdrawModal from './components/WithdrawModal';
import WithdrawTypeModal from '../dashboard/components/WithdrawTypeModal';
import CryptoWithdrawModal from './components/CryptoWithdrawModal';
import PlatformTransferModal from '../dashboard/components/PlatformTransferModal';
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
  const [showWithdrawTypeModal, setShowWithdrawTypeModal] = useState(false);
  const [showCryptoWithdrawModal, setShowCryptoWithdrawModal] = useState(false);
  const [showPlatformTransferModal, setShowPlatformTransferModal] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('NGN');
  const [usdBalance, setUsdBalance] = useState(0);
  const [usdtBalance, setUsdtBalance] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setLastUpdatedAt(new Date());
    } catch (error) {
      console.error('[WalletPage] Auth check failed:', error);
      navigate('/signin');
    } finally {
      setLoading(false);
    }
  };

  const loadBalances = async () => {
    try {
      const result = await userApi.getWallets();
      if (result.success && result.data) {
        const { wallets = [], usdBalance: usd = 0, usdtBalance: usdt = 0 } = result.data;
        setUsdBalance(usd);
        setUsdtBalance(usdt);
        setBalances((wallets as any[]).map((w: any) => ({
          currency: w.currency,
          available_balance: w.available ?? w.balance ?? 0,
          reserved_balance: w.reserved ?? 0,
          total_balance: (w.available ?? w.balance ?? 0) + (w.reserved ?? 0),
          usdtBalance: w.currency === 'USD' ? usdt : undefined,
        })));
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

  const refreshData = async () => {
    await Promise.all([loadBalances(), loadTransactions()]);
    setLastUpdatedAt(new Date());
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-lime-500/30 border-t-lime-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-400 font-medium">Loading Wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg text-white">
      <WalletHeader user={user} />

      <main id="main-content" className="max-w-7xl mx-auto px-4 py-12 space-y-12" tabIndex={-1}>
        {/* Hero Section with Glassmorphism */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="relative overflow-hidden bg-dark-card rounded-3xl border border-dark-border p-8">
              <div className="relative z-10 flex justify-between items-start">
                <div>
                  <h1 className="text-4xl font-extrabold tracking-tight mb-2">My Balance</h1>
                  <p className="text-neutral-400 font-medium">Global Multi-Currency Account</p>
                  {lastUpdatedAt && (
                    <p className="text-xs text-neutral-500 mt-1">
                      Last updated: {formatDateTime(lastUpdatedAt)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="bg-dark-elevated hover:bg-dark-hover p-3 rounded-xl border border-dark-border transition-colors disabled:opacity-50"
                    title="Refresh balance"
                  >
                    <i className={`ri-refresh-line text-xl text-lime-400 ${refreshing ? 'animate-spin' : ''}`}></i>
                  </button>
                  <div className="bg-dark-elevated p-4 rounded-2xl border border-dark-border">
                    <i className="ri-safe-2-line text-3xl text-lime-400"></i>
                  </div>
                </div>
              </div>

              <div className="mt-12">
                <BalanceCards
                  balances={balances}
                  onDeposit={(curr) => { setSelectedCurrency(curr); setShowDepositModal(true); }}
                  onWithdraw={() => setShowWithdrawTypeModal(true)}
                />
              </div>
            </div>

            {/* Dynamic Chart Integration */}
            <div className="bg-dark-card rounded-3xl border border-dark-border p-6">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-white">Balance Analytics</h3>
                <span className="text-xs font-bold text-neutral-500 bg-dark-elevated px-3 py-1 rounded-full uppercase">Weekly</span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={balanceChartData}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#84CC16" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#84CC16" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1a1a1a" />
                    <XAxis dataKey="day" stroke="#737373" fontSize={12} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '16px' }}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#84CC16" fillOpacity={1} fill="url(#colorAmount)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <QuickActions
              onDeposit={() => { setSelectedCurrency('USD'); setShowDepositModal(true); }}
              onWithdraw={() => setShowWithdrawTypeModal(true)}
            />

            <div className="bg-dark-card rounded-3xl border border-dark-border p-8">
              <h3 className="text-xl font-bold text-white mb-4">Security Insights</h3>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-lime-500/20 rounded-xl flex items-center justify-center shrink-0">
                    <i className="ri-shield-check-line text-lime-400"></i>
                  </div>
                  <p className="text-sm text-neutral-400">Your account is secured with advanced encryption and monitoring.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-lime-500/20 rounded-xl flex items-center justify-center shrink-0">
                    <i className="ri-earth-line text-lime-400"></i>
                  </div>
                  <p className="text-sm text-neutral-400">All transactions are monitored for suspicious activity.</p>
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
      {showDepositModal && <DepositModal currency={selectedCurrency} onClose={() => setShowDepositModal(false)} onSuccess={refreshData} />}

      {showWithdrawTypeModal && (
        <WithdrawTypeModal
          isOpen={showWithdrawTypeModal}
          onClose={() => setShowWithdrawTypeModal(false)}
          onSelectCrypto={() => { setShowWithdrawTypeModal(false); setShowCryptoWithdrawModal(true); }}
          onSelectFiat={() => { setShowWithdrawTypeModal(false); setSelectedCurrency('USD'); setShowWithdrawModal(true); }}
          onSelectPlatform={() => { setShowWithdrawTypeModal(false); setShowPlatformTransferModal(true); }}
          usdtBalance={usdtBalance}
          usdBalance={usdBalance}
        />
      )}

      {showWithdrawModal && (
        <WithdrawModal
          currency="USD"
          availableBalance={usdBalance}
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={() => { setShowWithdrawModal(false); refreshData(); }}
        />
      )}

      {showCryptoWithdrawModal && (
        <CryptoWithdrawModal
          initialAsset="USDT"
          cryptoBalances={{ USDT: usdtBalance }}
          onClose={() => setShowCryptoWithdrawModal(false)}
          onSuccess={() => { setShowCryptoWithdrawModal(false); refreshData(); }}
        />
      )}

      {showPlatformTransferModal && (
        <PlatformTransferModal
          isOpen={showPlatformTransferModal}
          onClose={() => setShowPlatformTransferModal(false)}
          onSuccess={() => { setShowPlatformTransferModal(false); refreshData(); }}
          totalBalance={usdBalance + usdtBalance}
        />
      )}
    </div>
  );
}
