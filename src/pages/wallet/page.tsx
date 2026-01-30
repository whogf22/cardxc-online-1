import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { userApi, authApi } from '../../lib/api';
import WalletHeader from './components/WalletHeader';
import BalanceCards from './components/BalanceCards';
import QuickActions from './components/QuickActions';
import RecentTransactions from './components/RecentTransactions';
import DepositModal from './components/DepositModal';
import WithdrawModal from './components/WithdrawModal';
import CryptoDepositModal from './components/CryptoDepositModal';
import CryptoWithdrawModal from './components/CryptoWithdrawModal';

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

interface CryptoBalance {
  symbol: string;
  name: string;
  balance: number;
  icon: string;
  color: string;
  usdValue: number;
}

const CRYPTO_ASSETS: CryptoBalance[] = [
  { symbol: 'BTC', name: 'Bitcoin', balance: 0.00000000, icon: 'ri-bit-coin-line', color: 'from-orange-500 to-orange-600', usdValue: 0 },
  { symbol: 'ETH', name: 'Ethereum', balance: 0.00000000, icon: 'ri-coin-line', color: 'from-indigo-500 to-indigo-600', usdValue: 0 },
  { symbol: 'USDT', name: 'Tether USD', balance: 0.00000000, icon: 'ri-money-dollar-circle-line', color: 'from-teal-500 to-teal-600', usdValue: 0 },
  { symbol: 'BNB', name: 'BNB', balance: 0.00000000, icon: 'ri-shape-line', color: 'from-yellow-500 to-yellow-600', usdValue: 0 },
  { symbol: 'TRX', name: 'Tron', balance: 0.00000000, icon: 'ri-flashlight-line', color: 'from-red-500 to-red-600', usdValue: 0 },
];

export default function WalletPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cryptoBalances, setCryptoBalances] = useState<CryptoBalance[]>(CRYPTO_ASSETS);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showCryptoDepositModal, setShowCryptoDepositModal] = useState(false);
  const [showCryptoWithdrawModal, setShowCryptoWithdrawModal] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('NGN');
  const [selectedCryptoAsset, setSelectedCryptoAsset] = useState<string | undefined>();

  useEffect(() => {
    checkAuthAndLoadData();
    
    const balanceSubscription = supabase
      .channel('wallet_balances_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'wallet_balances' },
        () => {
          loadBalances();
        }
      )
      .subscribe();

    const ledgerSubscription = supabase
      .channel('ledger_entries_changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ledger_entries' },
        () => {
          loadTransactions();
        }
      )
      .subscribe();

    return () => {
      balanceSubscription.unsubscribe();
      ledgerSubscription.unsubscribe();
    };
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

      if (!result.success) throw new Error(result.error?.message || 'Failed to load balances');

      const transformedBalances = (result.data?.wallets || []).map((balance: any) => ({
        currency: balance.currency,
        available_balance: balance.available_balance || 0,
        reserved_balance: balance.reserved_balance || 0,
        total_balance: (balance.available_balance || 0) + (balance.reserved_balance || 0)
      }));

      setBalances(transformedBalances);
    } catch (error) {
      console.error('[WalletPage] Failed to load balances:', error);
    }
  };

  const loadTransactions = async () => {
    try {
      const result = await userApi.getTransactions({ limit: 20 });

      if (!result.success) throw new Error(result.error?.message || 'Failed to load transactions');

      setTransactions(result.data?.transactions || []);
    } catch (error) {
      console.error('[WalletPage] Failed to load transactions:', error);
    }
  };

  const handleDepositClick = (currency: string) => {
    setSelectedCurrency(currency);
    setShowDepositModal(true);
  };

  const handleWithdrawClick = (currency: string) => {
    setSelectedCurrency(currency);
    setShowWithdrawModal(true);
  };

  const handleCryptoDepositClick = (symbol?: string) => {
    setSelectedCryptoAsset(symbol);
    setShowCryptoDepositModal(true);
  };

  const handleCryptoWithdrawClick = (symbol?: string) => {
    setSelectedCryptoAsset(symbol);
    setShowCryptoWithdrawModal(true);
  };

  const handleTransactionSuccess = () => {
    loadBalances();
    loadTransactions();
  };

  const getCryptoBalancesMap = () => {
    return cryptoBalances.reduce((acc, asset) => {
      acc[asset.symbol] = asset.balance;
      return acc;
    }, {} as Record<string, number>);
  };

  const totalCryptoValue = cryptoBalances.reduce((sum, asset) => sum + asset.usdValue, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-700 font-semibold text-lg">Loading your payment account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <WalletHeader user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Your Payment Account</h1>
          <p className="text-slate-600">Manage your funds across multiple currencies</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <BalanceCards 
              balances={balances}
              onDeposit={handleDepositClick}
              onWithdraw={handleWithdrawClick}
            />
          </div>
          <div>
            <QuickActions
              onDeposit={() => handleDepositClick('NGN')}
              onWithdraw={() => handleWithdrawClick('NGN')}
            />
          </div>
        </div>

        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Crypto Assets</h2>
                  <p className="text-sm text-slate-500">Manage your cryptocurrency holdings</p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleCryptoDepositClick()}
                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/30"
                  >
                    <i className="ri-add-circle-line"></i>
                    <span>Deposit</span>
                  </button>
                  <button
                    onClick={() => handleCryptoWithdrawClick()}
                    className="flex items-center space-x-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-all cursor-pointer border-2 border-slate-200 hover:border-emerald-500"
                  >
                    <i className="ri-arrow-up-circle-line"></i>
                    <span>Withdraw</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6 p-4 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Total Crypto Value</p>
                    <p className="text-2xl font-bold">${totalCryptoValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                    <i className="ri-coin-fill text-2xl text-emerald-400"></i>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {cryptoBalances.map((asset) => (
                  <div
                    key={asset.symbol}
                    className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br ${asset.color} rounded-xl flex items-center justify-center shadow-lg flex-shrink-0`}>
                        <i className={`${asset.icon} text-white text-lg sm:text-xl`}></i>
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{asset.symbol}</p>
                        <p className="text-sm text-slate-500">{asset.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-bold text-slate-900">{asset.balance.toFixed(8)}</p>
                        <p className="text-sm text-slate-500">${asset.usdValue.toFixed(2)}</p>
                      </div>
                      <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCryptoDepositClick(asset.symbol)}
                          className="w-8 h-8 rounded-lg bg-emerald-100 hover:bg-emerald-200 flex items-center justify-center transition-colors cursor-pointer"
                          title={`Deposit ${asset.symbol}`}
                        >
                          <i className="ri-add-line text-emerald-600"></i>
                        </button>
                        <button
                          onClick={() => handleCryptoWithdrawClick(asset.symbol)}
                          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                          title={`Withdraw ${asset.symbol}`}
                        >
                          <i className="ri-arrow-up-line text-slate-600"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <i className="ri-information-line text-white"></i>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 mb-1">Crypto Deposits</p>
                    <p className="text-xs text-slate-600">
                      Deposit crypto assets directly to your wallet using the deposit addresses. 
                      Make sure to select the correct network to avoid loss of funds.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <RecentTransactions transactions={transactions} />
      </main>

      {showDepositModal && (
        <DepositModal
          currency={selectedCurrency}
          onClose={() => setShowDepositModal(false)}
          onSuccess={handleTransactionSuccess}
        />
      )}

      {showWithdrawModal && (
        <WithdrawModal
          currency={selectedCurrency}
          availableBalance={balances.find(b => b.currency === selectedCurrency)?.available_balance || 0}
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={handleTransactionSuccess}
        />
      )}

      {showCryptoDepositModal && (
        <CryptoDepositModal
          initialAsset={selectedCryptoAsset}
          onClose={() => {
            setShowCryptoDepositModal(false);
            setSelectedCryptoAsset(undefined);
          }}
        />
      )}

      {showCryptoWithdrawModal && (
        <CryptoWithdrawModal
          initialAsset={selectedCryptoAsset}
          cryptoBalances={getCryptoBalancesMap()}
          onClose={() => {
            setShowCryptoWithdrawModal(false);
            setSelectedCryptoAsset(undefined);
          }}
          onSuccess={handleTransactionSuccess}
        />
      )}
    </div>
  );
}
