import { useState } from 'react';
import DepositAddressScreen from './DepositAddressScreen';

interface CryptoDepositModalProps {
  initialAsset?: string;
  onClose: () => void;
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
        fee: 'Free',
        confirmations: 3,
        minDeposit: '0.0001 BTC',
        depositAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
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
        fee: 'Free',
        confirmations: 12,
        minDeposit: '0.001 ETH',
        depositAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f1E2C3'
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
        fee: 'Free',
        confirmations: 12,
        minDeposit: '10 USDT',
        depositAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f1E2C3'
      },
      {
        id: 'usdt-trc20',
        name: 'TRC-20',
        fullName: 'Tron Network',
        icon: 'ri-flashlight-line',
        fee: 'Free',
        confirmations: 20,
        minDeposit: '1 USDT',
        depositAddress: 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9'
      },
      {
        id: 'usdt-bep20',
        name: 'BEP-20',
        fullName: 'BNB Smart Chain',
        icon: 'ri-shape-line',
        fee: 'Free',
        confirmations: 15,
        minDeposit: '5 USDT',
        depositAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f1E2C3'
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
        fee: 'Free',
        confirmations: 15,
        minDeposit: '0.01 BNB',
        depositAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f1E2C3'
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
        fee: 'Free',
        confirmations: 20,
        minDeposit: '10 TRX',
        depositAddress: 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9'
      }
    ]
  }
];

export default function CryptoDepositModal({ initialAsset, onClose }: CryptoDepositModalProps) {
  const [selectedAsset, setSelectedAsset] = useState<string | null>(initialAsset || null);
  
  const assetData = selectedAsset ? CRYPTO_ASSETS.find(a => a.symbol === selectedAsset) : null;

  const handleAssetSelect = (symbol: string) => {
    setSelectedAsset(symbol);
  };

  const handleBack = () => {
    setSelectedAsset(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Deposit Crypto</h2>
              <p className="text-sm text-slate-600 mt-1">
                {selectedAsset ? `Receive ${selectedAsset} to your wallet` : 'Select an asset to deposit'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-2xl text-slate-600"></i>
            </button>
          </div>
        </div>

        <div className="p-6">
          {!selectedAsset ? (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700 mb-4">
                Select Cryptocurrency
              </label>
              {CRYPTO_ASSETS.map((asset) => (
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
                  <div className="flex items-center space-x-2">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                      {asset.networks.length} {asset.networks.length === 1 ? 'network' : 'networks'}
                    </span>
                    <i className="ri-arrow-right-s-line text-slate-400"></i>
                  </div>
                </button>
              ))}
            </div>
          ) : assetData ? (
            <DepositAddressScreen
              asset={assetData.symbol}
              networks={assetData.networks}
              onBack={handleBack}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
