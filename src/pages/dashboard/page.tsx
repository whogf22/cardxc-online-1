import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { userApi } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import DashboardHeader from './components/DashboardHeader';
import TotalAssetCard from './components/TotalAssetCard';
import ActionButtons from './components/ActionButtons';
import QuickActionsGrid from './components/QuickActionsGrid';
import TransactionList from './components/TransactionList';
import DepositModal from './components/DepositModal';
import WithdrawModal from './components/WithdrawModal';
import WithdrawTypeModal from './components/WithdrawTypeModal';
import CryptoWithdrawModal from '../wallet/components/CryptoWithdrawModal';
import PlatformTransferModal from './components/PlatformTransferModal';
import { DashboardSkeleton } from '../../components/SkeletonLoader';
import { KYCStatusBanner } from '../../components/KYCStatusBanner';

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [usdBalance, setUsdBalance] = useState(0);
  const [usdtBalance, setUsdtBalance] = useState(0);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showWithdrawTypeModal, setShowWithdrawTypeModal] = useState(false);
  const [showCryptoWithdrawModal, setShowCryptoWithdrawModal] = useState(false);
  const [showPlatformTransferModal, setShowPlatformTransferModal] = useState(false);
  const [, setShowKYCModal] = useState(false);
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
        setUsdBalance(usdWallet?.balance ?? (usdWallet?.balanceCents != null ? usdWallet.balanceCents / 100 : 0));
        setUsdtBalance(usdtWallet?.balance ?? (usdtWallet?.balanceCents != null ? usdtWallet.balanceCents / 100 : 0));
      }

      setIsLoading(false);

    } catch (error: any) {
      console.error('[Dashboard] Load error:', error);

      setUsdBalance(0);
      setUsdtBalance(0);
      setTransactions([]);
      setError('Unable to load dashboard data. Please try again.');
      setIsLoading(false);
    }
  };

  const fetchWalletBalances = async () => {
    try {
      const walletsResult = await userApi.getWallets();
      if (walletsResult.success && walletsResult.data?.wallets) {
        const wallets = walletsResult.data.wallets;
        const usdWallet = wallets.find((w: any) => w.currency === 'USD');
        const usdtWallet = wallets.find((w: any) => w.currency === 'USDT');
        setUsdBalance(usdWallet?.balance ?? (usdWallet?.balanceCents != null ? usdWallet.balanceCents / 100 : 0));
        setUsdtBalance(usdtWallet?.balance ?? (usdtWallet?.balanceCents != null ? usdtWallet.balanceCents / 100 : 0));
      }
    } catch (err) {
      console.error('[Dashboard] Balance polling error:', err);
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
      <div className="min-h-screen bg-[#0D0D0D] p-4">
        <DashboardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center p-4">
        <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-error-warning-fill text-3xl text-red-400"></i>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Something went wrong</h2>
          <p className="text-neutral-500 text-sm mb-6">{error}</p>
          <button
            onClick={() => loadDashboardData()}
            className="w-full px-6 py-3 bg-lime-400 text-black font-semibold rounded-xl cursor-pointer hover:bg-lime-300 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const currentBalance = calculateBalance();

  return (
    <div className="min-h-screen bg-dark-bg pb-24 w-full min-w-0 overflow-x-hidden relative">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 -left-40 w-80 h-80 bg-lime-500/[0.04] rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 -right-40 w-60 h-60 bg-emerald-500/[0.03] rounded-full blur-[80px]" />
      </div>
      <DashboardHeader />

      <main id="main-content" className="relative px-4 sm:px-5 max-w-7xl mx-auto space-y-6 mt-2 w-full" tabIndex={-1}>
        <KYCStatusBanner onUploadClick={() => setShowKYCModal(true)} />

        <TotalAssetCard
          usdBalance={usdBalance}
          usdtBalance={usdtBalance}
          showBalance={showBalance}
          onToggleBalance={() => setShowBalance(!showBalance)}
        />

        <ActionButtons
          onDepositClick={() => setShowDepositModal(true)}
          onWithdrawClick={() => setShowWithdrawTypeModal(true)}
        />

        <QuickActionsGrid />

        <TransactionList transactions={transactions} />
      </main>

      {showDepositModal && (
        <DepositModal
          isOpen={showDepositModal}
          onClose={() => setShowDepositModal(false)}
          onSuccess={() => { setShowDepositModal(false); loadDashboardData(); }}
          userId={user?.id}
        />
      )}

      {showWithdrawTypeModal && (
        <WithdrawTypeModal
          isOpen={showWithdrawTypeModal}
          onClose={() => setShowWithdrawTypeModal(false)}
          onSelectCrypto={() => { setShowWithdrawTypeModal(false); setShowCryptoWithdrawModal(true); }}
          onSelectFiat={() => { setShowWithdrawTypeModal(false); setShowWithdrawModal(true); }}
          onSelectPlatform={() => { setShowWithdrawTypeModal(false); setShowPlatformTransferModal(true); }}
          usdtBalance={usdtBalance}
          usdBalance={usdBalance}
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

      {showCryptoWithdrawModal && (
        <CryptoWithdrawModal
          initialAsset="USDT"
          cryptoBalances={{ USDT: usdtBalance }}
          onClose={() => setShowCryptoWithdrawModal(false)}
          onSuccess={() => { setShowCryptoWithdrawModal(false); loadDashboardData(); }}
        />
      )}

      {showPlatformTransferModal && (
        <PlatformTransferModal
          isOpen={showPlatformTransferModal}
          onClose={() => setShowPlatformTransferModal(false)}
          onSuccess={() => { setShowPlatformTransferModal(false); loadDashboardData(); }}
          totalBalance={usdBalance + usdtBalance}
        />
      )}
    </div>
  );
}
