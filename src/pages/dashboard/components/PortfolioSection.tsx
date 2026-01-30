import { useState } from 'react';
import { useCurrencyFormat } from '../../../hooks/useCurrencyFormat';

interface PortfolioSectionProps {
  usdBalance: number;
  usdtBalance: number;
  showBalance: boolean;
}

export default function PortfolioSection({ usdBalance, usdtBalance, showBalance }: PortfolioSectionProps) {
  const format = useCurrencyFormat();
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);

  const assets = [
    {
      id: 'usd',
      name: 'US Dollar',
      symbol: 'USD',
      balance: usdBalance,
      icon: 'ri-money-dollar-circle-fill',
      iconBg: 'bg-green-500/10',
      iconColor: 'text-green-500',
      change: '+2.5%',
      changePositive: true,
    },
    {
      id: 'usdt',
      name: 'Tether',
      symbol: 'USDT',
      balance: usdtBalance,
      icon: 'ri-coin-fill',
      iconBg: 'bg-teal-500/10',
      iconColor: 'text-teal-500',
      change: '+0.1%',
      changePositive: true,
    },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-slate-900">Portfolio</h3>
        <button className="text-xs text-emerald-600 font-medium hover:text-emerald-700">
          View All
        </button>
      </div>

      <div className="space-y-3">
        {assets.map((asset) => (
          <div key={asset.id}>
            <button
              onClick={() => setExpandedAsset(expandedAsset === asset.id ? null : asset.id)}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${asset.iconBg} rounded-xl flex items-center justify-center`}>
                  <i className={`${asset.icon} text-xl ${asset.iconColor}`}></i>
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-900">{asset.name}</p>
                  <p className="text-xs text-slate-500">{asset.symbol}</p>
                </div>
              </div>
              <div className="text-right flex items-center gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {showBalance 
                      ? (asset.symbol === 'USDT' 
                          ? `${asset.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`
                          : format(asset.balance))
                      : '••••••'}
                  </p>
                  <p className={`text-xs font-medium ${asset.changePositive ? 'text-emerald-600' : 'text-red-600'}`}>
                    {asset.change}
                  </p>
                </div>
                <i className={`ri-arrow-${expandedAsset === asset.id ? 'up' : 'down'}-s-line text-slate-400`}></i>
              </div>
            </button>
            
            {expandedAsset === asset.id && (
              <div className="mt-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs mb-1">Available Balance</p>
                    <p className="font-semibold text-slate-900">
                      {showBalance 
                        ? (asset.symbol === 'USDT' 
                            ? `${asset.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`
                            : format(asset.balance))
                        : '••••••'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs mb-1">24h Change</p>
                    <p className={`font-semibold ${asset.changePositive ? 'text-emerald-600' : 'text-red-600'}`}>
                      {asset.change}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
