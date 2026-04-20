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
import { KYCDocumentUpload } from '../../components/KYCDocumentUpload';

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
    } catch (_error: any) {
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
      <div className="min-h-screen bg-dark-bg p-4">
        <DashboardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div
          className="rounded-3xl p-8 max-w-sm w-full text-center animate-scale-in"
          style={{
            background: 'linear-gradient(145deg, rgba(20,20,20,0.95), rgba(13,13,13,0.98))',
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(40px)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)',
          }}
        >
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20">
            <i className="ri-error-warning-fill text-3xl text-red-400"></i>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Something went wrong</h2>
          <p className="text-neutral-500 text-sm mb-6">{error}</p>
          <button
            onClick={() => loadDashboardData()}
            className="w-full px-6 py-3.5 bg-lime-500 text-black font-bold rounded-xl cursor-pointer hover:bg-lime-400 transition-all duration-300 hover:shadow-glow-sm active:scale-95"
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
      {/* Ambient 3D background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(132,204,22,0.04) 0%, transparent 70%)', animation: 'orbFloat1 15s ease-in-out infinite' }}
        />
        <div
          className="absolute top-1/3 -right-60 w-[400px] h-[400px] rounded-full blur-[100px]"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.03) 0%, transparent 70%)', animation: 'orbFloat2 20s ease-in-out infinite' }}
        />
        <div
          className="absolute -bottom-20 left-1/4 w-[300px] h-[300px] rounded-full blur-[80px]"
          style={{ background: 'radial-gradient(circle, rgba(132,204,22,0.02) 0%, transparent 70%)', animation: 'orbFloat3 18s ease-in-out infinite' }}
        />
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

      {showKYCModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowKYCModal(false)} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
            <KYCDocumentUpload
              onComplete={() => {
                setShowKYCModal(false);
                loadDashboardData();
              }}
              onClose={() => setShowKYCModal(false)}
            />
          </div>
        </div>
      )}

      <style>{`
        @keyframes orbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.05); }
          66% { transform: translate(-20px, 30px) scale(0.95); }
        }
        @keyframes orbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-40px, 20px) scale(1.1); }
        }
        @keyframes orbFloat3 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(20px, -30px); }
          66% { transform: translate(-30px, 10px); }
        }
      `}</style>
    </div>
  );
}
