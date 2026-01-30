import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { userApi } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import DashboardHeader from './components/DashboardHeader';
import TotalAssetCard from './components/TotalAssetCard';
import ActionButtons from './components/ActionButtons';
import QuickActionsGrid from './components/QuickActionsGrid';
import PortfolioSection from './components/PortfolioSection';
import TransactionList from './components/TransactionList';
import DepositModal from './components/DepositModal';
import WithdrawModal from './components/WithdrawModal';
import { DashboardSkeleton } from '../../components/SkeletonLoader';
import { KYCStatusBanner } from '../../components/KYCStatusBanner';

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [usdBalance, setUsdBalance] = useState(0);
  const [usdtBalance, setUsdtBalance] = useState(0);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showKYCModal, setShowKYCModal] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const calculateBalance = () => {
    const completedEntries = transactions.filter(t => t.status === 'completed');
    const deposits = completedEntries
      .filter(t => t.entry_type === 'credit' || t.type === 'deposit' || t.transaction_type === 'deposit')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const withdrawals = completedEntries
      .filter(t => t.entry_type === 'debit' || t.type === 'withdrawal' || t.transaction_type === 'withdrawal')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    return deposits - withdrawals;
  };

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError('');

      const [transactionsResult, walletsResult] = await Promise.all([
        userApi.getTransactions({ limit: 100 }),
        userApi.getWallets(),
      ]);

      if (transactionsResult.success && transactionsResult.data?.transactions) {
        setTransactions(transactionsResult.data.transactions);
      } else {
        console.warn('Transactions fetch error:', transactionsResult.error);
        setTransactions([]);
      }

      if (walletsResult.success && walletsResult.data?.wallets) {
        const wallets = walletsResult.data.wallets;
        const usdWallet = wallets.find((w: any) => w.currency === 'USD');
        const usdtWallet = wallets.find((w: any) => w.currency === 'USDT');
        setUsdBalance(usdWallet?.balance || usdWallet?.balanceCents / 100 || 0);
        setUsdtBalance(usdtWallet?.balance || usdtWallet?.balanceCents / 100 || 0);
      }

      setIsLoading(false);

    } catch (error: any) {
      console.error('[Dashboard] Load error:', error);
      setError(error.message || 'Failed to load dashboard');
      setIsLoading(false);
    }
  };

  const fetchWalletBalances = async () => {
    const walletsResult = await userApi.getWallets();
    if (walletsResult.success && walletsResult.data?.wallets) {
      const wallets = walletsResult.data.wallets;
      const usdWallet = wallets.find((w: any) => w.currency === 'USD');
      const usdtWallet = wallets.find((w: any) => w.currency === 'USDT');
      setUsdBalance(usdWallet?.balance || usdWallet?.balanceCents / 100 || 0);
      setUsdtBalance(usdtWallet?.balance || usdtWallet?.balanceCents / 100 || 0);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'processing') {
      let pollCount = 0;
      const maxPolls = 10;
      
      pollingRef.current = setInterval(() => {
        pollCount++;
        fetchWalletBalances();
        
        if (pollCount >= maxPolls) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      }, 3000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-bg p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="bg-dark-card rounded-[2.5rem] border border-white/5 p-8 max-w-md w-full text-center shadow-3d-depth">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="ri-error-warning-fill text-4xl text-red-500"></i>
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-3">System Error</h2>
          <p className="text-neutral-500 mb-8">{error}</p>
          <button
            onClick={() => loadDashboardData()}
            className="btn-3d w-full"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const currentBalance = calculateBalance();

  return (
    <div className="min-h-screen bg-[#030303] bg-3d-mesh pb-24">
      <DashboardHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <KYCStatusBanner onUploadClick={() => setShowKYCModal(true)} />

        <div className="space-y-8">
          <TotalAssetCard
            usdBalance={usdBalance}
            usdtBalance={usdtBalance}
            showBalance={showBalance}
            onToggleBalance={() => setShowBalance(!showBalance)}
          />

          <ActionButtons
            onDepositClick={() => setShowDepositModal(true)}
            onWithdrawClick={() => setShowWithdrawModal(true)}
          />

          <QuickActionsGrid />

          <PortfolioSection
            usdBalance={usdBalance}
            usdtBalance={usdtBalance}
            showBalance={showBalance}
          />

          <TransactionList transactions={transactions} />
        </div>
      </main>

      {showDepositModal && (
        <DepositModal
          isOpen={showDepositModal}
          onClose={() => setShowDepositModal(false)}
          onSuccess={() => { setShowDepositModal(false); loadDashboardData(); }}
          userId={user?.id}
        />
      )}

      {showWithdrawModal && (
        <WithdrawModal
          isOpen={showWithdrawModal}
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={() => { setShowWithdrawModal(false); loadDashboardData(); }}
          userId={user?.id}
          currentBalance={currentBalance}
        />
      )}
    </div>
  );
}
