import { useEffect, useState } from 'react';
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

const DEFAULT_CRYPTO_ASSETS: CryptoAsset[] = [
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
        fee: 'Free',
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
        fee: 'Free',
        confirmations: 12,
        minDeposit: '10 USDT',
        depositAddress: ''
      },
      {
        id: 'usdt-trc20',
        name: 'TRC-20',
        fullName: 'Tron Network',
        icon: 'ri-flashlight-line',
        fee: 'Free',
        confirmations: 20,
        minDeposit: '1 USDT',
        depositAddress: ''
      },
      {
        id: 'usdt-bep20',
        name: 'BEP-20',
        fullName: 'BNB Smart Chain',
        icon: 'ri-shape-line',
        fee: 'Free',
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
        fee: 'Free',
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
        fee: 'Free',
        confirmations: 20,
        minDeposit: '10 TRX',
        depositAddress: ''
      }
    ]
  }
];

function applyServerAddresses(
  assets: CryptoAsset[],
  addresses: Record<string, Record<string, string>> | undefined
): CryptoAsset[] {
  if (!addresses) return assets;
  return assets.map((asset) => ({
    ...asset,
    networks: asset.networks.map((network) => ({
      ...network,
      depositAddress: addresses?.[asset.symbol]?.[network.id] || network.depositAddress,
    })),
  }));
}

export default function CryptoDepositModal({ initialAsset, onClose }: CryptoDepositModalProps) {
  const [selectedAsset, setSelectedAsset] = useState<string | null>(initialAsset || null);
  const [assets, setAssets] = useState<CryptoAsset[]>(DEFAULT_CRYPTO_ASSETS);
  const [configError, setConfigError] = useState('');

  useEffect(() => {
    let mounted = true;
    const loadCryptoConfig = async () => {
      try {
        const { userApi } = await import('../../../lib/api');
        const result = await userApi.getCryptoConfig();
        if (!mounted) return;
        if (result.success && result.data) {
          setAssets((prev) => applyServerAddresses(prev, result.data?.addresses));
          setConfigError('');
        } else {
          setConfigError(result.error?.message || 'Failed to load crypto deposit addresses');
        }
      } catch {
        if (mounted) setConfigError('Failed to load crypto deposit addresses');
      }
    };
    loadCryptoConfig();
    return () => {
      mounted = false;
    };
  }, []);

  const assetData = selectedAsset ? assets.find(a => a.symbol === selectedAsset) : null;

  const handleAssetSelect = (symbol: string) => {
    setSelectedAsset(symbol);
  };

  const handleBack = () => {
    setSelectedAsset(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d0d0d] rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-white/[0.08]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Deposit Crypto</h2>
              <p className="text-sm text-white/60 mt-1">
                {selectedAsset ? `Receive ${selectedAsset} to your wallet` : 'Select an asset to deposit'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-2xl text-white/60"></i>
            </button>
          </div>
        </div>

        <div className="p-6">
          {!selectedAsset ? (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-white/80 mb-4">
                Select Cryptocurrency
              </label>
              {assets.map((asset) => (
                <button
                  key={asset.symbol}
                  onClick={() => handleAssetSelect(asset.symbol)}
                  className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-white/[0.08] hover:border-lime-500 hover:bg-lime-500/[0.08] transition-all cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 bg-gradient-to-br ${asset.color} rounded-xl flex items-center justify-center shadow-lg`}>
                      <i className={`${asset.icon} text-white text-xl`}></i>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-white">{asset.symbol}</p>
                      <p className="text-sm text-white/50">{asset.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs bg-white/[0.06] text-white/60 px-2 py-1 rounded-full">
                      {asset.networks.length} {asset.networks.length === 1 ? 'network' : 'networks'}
                    </span>
                    <i className="ri-arrow-right-s-line text-white/40"></i>
                  </div>
                </button>
              ))}
              {configError && (
                <p className="text-xs text-amber-400 pt-2">{configError}</p>
              )}
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
