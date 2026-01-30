import { useState } from 'react';
import NetworkSelector from './NetworkSelector';
import AddressBook, { SavedAddress } from '../../../components/AddressBook';

interface CryptoWithdrawModalProps {
  initialAsset?: string;
  cryptoBalances: Record<string, number>;
  onClose: () => void;
  onSuccess: () => void;
}

interface CryptoAsset {
  symbol: string;
  name: string;
  icon: string;
  color: string;
  networks: {
    id: string;
    name: string;
    fullName: string;
    icon: string;
    fee: string;
    confirmations: number;
    minDeposit: string;
    depositAddress: string;
  }[];
}

const CRYPTO_ASSETS: CryptoAsset[] = [
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    icon: 'ri-bit-coin-line',
    color: 'from-orange-500 to-orange-600',
    networks: [
      {
        id: 'btc-native',
        name: 'Bitcoin',
        fullName: 'Bitcoin Network',
        icon: 'ri-bit-coin-line',
        fee: '0.0001 BTC',
        confirmations: 3,
        minDeposit: '0.0001 BTC',
        depositAddress: ''
      }
    ]
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    icon: 'ri-coin-line',
    color: 'from-indigo-500 to-indigo-600',
    networks: [
      {
        id: 'eth-erc20',
        name: 'ERC-20',
        fullName: 'Ethereum Network',
        icon: 'ri-coin-line',
        fee: '0.002 ETH',
        confirmations: 12,
        minDeposit: '0.001 ETH',
        depositAddress: ''
      }
    ]
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    icon: 'ri-money-dollar-circle-line',
    color: 'from-teal-500 to-teal-600',
    networks: [
      {
        id: 'usdt-erc20',
        name: 'ERC-20',
        fullName: 'Ethereum Network',
        icon: 'ri-coin-line',
        fee: '5 USDT',
        confirmations: 12,
        minDeposit: '10 USDT',
        depositAddress: ''
      },
      {
        id: 'usdt-trc20',
        name: 'TRC-20',
        fullName: 'Tron Network',
        icon: 'ri-flashlight-line',
        fee: '1 USDT',
        confirmations: 20,
        minDeposit: '1 USDT',
        depositAddress: ''
      },
      {
        id: 'usdt-bep20',
        name: 'BEP-20',
        fullName: 'BNB Smart Chain',
        icon: 'ri-shape-line',
        fee: '0.5 USDT',
        confirmations: 15,
        minDeposit: '5 USDT',
        depositAddress: ''
      }
    ]
  },
  {
    symbol: 'BNB',
    name: 'BNB',
    icon: 'ri-shape-line',
    color: 'from-yellow-500 to-yellow-600',
    networks: [
      {
        id: 'bnb-bep20',
        name: 'BEP-20',
        fullName: 'BNB Smart Chain',
        icon: 'ri-shape-line',
        fee: '0.0005 BNB',
        confirmations: 15,
        minDeposit: '0.01 BNB',
        depositAddress: ''
      }
    ]
  },
  {
    symbol: 'TRX',
    name: 'Tron',
    icon: 'ri-flashlight-line',
    color: 'from-red-500 to-red-600',
    networks: [
      {
        id: 'trx-trc20',
        name: 'TRC-20',
        fullName: 'Tron Network',
        icon: 'ri-flashlight-line',
        fee: '1 TRX',
        confirmations: 20,
        minDeposit: '10 TRX',
        depositAddress: ''
      }
    ]
  }
];

export default function CryptoWithdrawModal({ initialAsset, cryptoBalances, onClose, onSuccess }: CryptoWithdrawModalProps) {
  const [selectedAsset, setSelectedAsset] = useState<string | null>(initialAsset || null);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [step, setStep] = useState<'asset' | 'form' | 'confirm' | 'success'>('asset');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAddressBook, setShowAddressBook] = useState(false);

  const handleSelectFromAddressBook = (savedAddress: SavedAddress) => {
    setDestinationAddress(savedAddress.address);
    if (savedAddress.network) {
      setSelectedNetwork(savedAddress.network);
    }
    setShowAddressBook(false);
  };

  const assetData = selectedAsset ? CRYPTO_ASSETS.find(a => a.symbol === selectedAsset) : null;
  const networkData = assetData?.networks.find(n => n.id === selectedNetwork);
  const balance = selectedAsset ? (cryptoBalances[selectedAsset] || 0) : 0;

  const handleAssetSelect = (symbol: string) => {
    const asset = CRYPTO_ASSETS.find(a => a.symbol === symbol);
    setSelectedAsset(symbol);
    setSelectedNetwork(asset?.networks[0]?.id || '');
    setStep('form');
  };

  const handleMaxClick = () => {
    setAmount(balance.toString());
  };

  const validateForm = (): boolean => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return false;
    }
    if (parseFloat(amount) > balance) {
      setError('Insufficient balance');
      return false;
    }
    if (!destinationAddress) {
      setError('Please enter a destination address');
      return false;
    }
    if (selectedAsset === 'BTC' && !destinationAddress.match(/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/)) {
      setError('Invalid Bitcoin address format');
      return false;
    }
    if ((selectedAsset === 'ETH' || selectedNetwork?.includes('erc20') || selectedNetwork?.includes('bep20')) 
        && !destinationAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Invalid EVM address format (should start with 0x)');
      return false;
    }
    if ((selectedAsset === 'TRX' || selectedNetwork?.includes('trc20')) 
        && !destinationAddress.match(/^T[a-zA-HJ-NP-Z0-9]{33}$/)) {
      setError('Invalid Tron address format (should start with T)');
      return false;
    }
    return true;
  };

  const handleContinue = () => {
    setError('');
    if (validateForm()) {
      setStep('confirm');
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      setStep('success');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'confirm') {
      setStep('form');
    } else if (step === 'form') {
      setSelectedAsset(null);
      setStep('asset');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {(step === 'form' || step === 'confirm') && (
                <button
                  onClick={handleBack}
                  className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <i className="ri-arrow-left-line text-xl text-slate-600"></i>
                </button>
              )}
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Withdraw Crypto</h2>
                <p className="text-sm text-slate-600 mt-1">
                  {step === 'asset' && 'Select an asset to withdraw'}
                  {step === 'form' && `Send ${selectedAsset} to external wallet`}
                  {step === 'confirm' && 'Confirm withdrawal details'}
                  {step === 'success' && 'Withdrawal submitted'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              disabled={loading}
            >
              <i className="ri-close-line text-2xl text-slate-600"></i>
            </button>
          </div>
        </div>

        <div className="p-6">
          {step === 'asset' && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700 mb-4">
                Select Cryptocurrency
              </label>
              {CRYPTO_ASSETS.map((asset) => {
                const assetBalance = cryptoBalances[asset.symbol] || 0;
                return (
                  <button
                    key={asset.symbol}
                    onClick={() => handleAssetSelect(asset.symbol)}
                    className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 bg-gradient-to-br ${asset.color} rounded-xl flex items-center justify-center shadow-lg`}>
                        <i className={`${asset.icon} text-white text-xl`}></i>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-slate-900">{asset.symbol}</p>
                        <p className="text-sm text-slate-500">{asset.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">{assetBalance.toFixed(8)}</p>
                      <p className="text-xs text-slate-500">{asset.symbol}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {step === 'form' && assetData && (
            <div className="space-y-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Available Balance</span>
                  <span className="text-lg font-bold text-slate-900">
                    {balance.toFixed(8)} {selectedAsset}
                  </span>
                </div>
              </div>

              {assetData.networks.length > 1 && (
                <NetworkSelector
                  networks={assetData.networks}
                  selectedNetwork={selectedNetwork}
                  onSelect={setSelectedNetwork}
                />
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00000000"
                    step="0.00000001"
                    className="w-full px-4 py-4 pr-20 text-lg font-bold border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors"
                  />
                  <button
                    onClick={handleMaxClick}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-semibold text-sm rounded-lg transition-colors cursor-pointer"
                  >
                    MAX
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Destination Address
                  </label>
                  <button
                    onClick={() => setShowAddressBook(true)}
                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center space-x-1 cursor-pointer"
                  >
                    <i className="ri-book-line"></i>
                    <span>Address Book</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  placeholder={
                    selectedAsset === 'BTC' ? 'bc1q... or 1... or 3...' :
                    selectedNetwork?.includes('trc20') ? 'T...' :
                    '0x...'
                  }
                  className="w-full px-4 py-4 text-sm font-mono border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors"
                />
              </div>

              {networkData && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Network Fee</span>
                    <span className="text-sm font-semibold text-slate-900">{networkData.fee}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">You will receive</span>
                    <span className="text-sm font-semibold text-emerald-600">
                      {amount ? `~${parseFloat(amount).toFixed(8)} ${selectedAsset}` : '--'}
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button
                onClick={handleContinue}
                disabled={!amount || !destinationAddress}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-slate-300 disabled:to-slate-400 text-white font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/30"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'confirm' && assetData && networkData && (
            <div className="space-y-6">
              <div className="text-center py-6">
                <div className={`w-20 h-20 bg-gradient-to-br ${assetData.color} rounded-2xl flex items-center justify-center mx-auto shadow-xl mb-4`}>
                  <i className={`${assetData.icon} text-white text-3xl`}></i>
                </div>
                <p className="text-3xl font-bold text-slate-900">{amount} {selectedAsset}</p>
                <p className="text-sm text-slate-500 mt-1">via {networkData.name}</p>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">To Address</p>
                  <p className="text-sm font-mono text-slate-900 break-all">{destinationAddress}</p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">Amount</span>
                    <span className="text-sm font-semibold text-slate-900">{amount} {selectedAsset}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">Network Fee</span>
                    <span className="text-sm font-semibold text-slate-900">{networkData.fee}</span>
                  </div>
                  <div className="border-t border-slate-200 my-2 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">Total Deducted</span>
                      <span className="text-sm font-bold text-slate-900">{amount} {selectedAsset}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start space-x-2">
                  <i className="ri-error-warning-line text-amber-600 mt-0.5"></i>
                  <p className="text-sm text-amber-800">
                    Please verify the address carefully. Crypto transactions are irreversible.
                  </p>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-slate-300 disabled:to-slate-400 text-white font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/30 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Confirm Withdrawal</span>
                )}
              </button>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="ri-check-line text-4xl text-emerald-600"></i>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Withdrawal Submitted</h3>
              <p className="text-slate-600 mb-6">
                Your withdrawal of {amount} {selectedAsset} has been submitted and is being processed.
              </p>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Estimated Processing Time</p>
                <p className="text-sm font-semibold text-slate-900">10-30 minutes</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showAddressBook && (
        <AddressBook
          isModal={true}
          onClose={() => setShowAddressBook(false)}
          onSelectAddress={handleSelectFromAddressBook}
          filterNetwork={selectedNetwork}
        />
      )}
    </div>
  );
}
