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
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-400',
    },
    {
      id: 'usdt',
      name: 'Tether',
      symbol: 'USDT',
      balance: usdtBalance,
      icon: 'ri-coin-fill',
      iconBg: 'bg-teal-500/10',
      iconColor: 'text-teal-400',
    },
  ];

  return (
    <div className="bg-slate-900/30 backdrop-blur-xl rounded-[2.5rem] border border-slate-800/50 p-8 shadow-3d">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Portfolio Allocation</h3>
          <p className="text-[10px] font-bold text-slate-600 mt-1 uppercase">Diversified Digital Assets</p>
        </div>
        <button className="text-[10px] font-black text-emerald-400 uppercase tracking-widest hover:text-emerald-300 transition-colors">
          Expand All Assets
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {assets.map((asset) => (
          <div key={asset.id} className="relative group">
            <button
              onClick={() => setExpandedAsset(expandedAsset === asset.id ? null : asset.id)}
              className={`w-full flex items-center justify-between p-6 rounded-[2rem] transition-all duration-300 border ${expandedAsset === asset.id
                  ? 'bg-slate-800/40 border-emerald-500/30 shadow-2xl scale-[1.02]'
                  : 'bg-slate-950/40 border-slate-800/50 hover:border-slate-700 hover:bg-slate-900/40'
                }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 ${asset.iconBg} rounded-2xl flex items-center justify-center border border-white/5 shadow-inner transition-transform group-hover:scale-110`}>
                  <i className={`${asset.icon} text-2xl ${asset.iconColor}`}></i>
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-white uppercase tracking-tight">{asset.name}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{asset.symbol}</p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-lg font-black text-white tracking-tighter">
                    {showBalance
                      ? (asset.symbol === 'USDT'
                        ? `${asset.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : format(asset.balance))
                      : '••••••'}
                    <span className="text-[10px] text-slate-500 ml-1 font-bold">{asset.symbol}</span>
                  </p>
                  <div className="flex items-center justify-end gap-1 text-[10px] font-black text-slate-500">
                    <span>{asset.symbol}</span>
                  </div>
                </div>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-slate-900 border border-slate-800 transition-transform ${expandedAsset === asset.id ? 'rotate-180 border-emerald-500/30' : ''}`}>
                  <i className="ri-arrow-down-s-line text-slate-500"></i>
                </div>
              </div>
            </button>

            {expandedAsset === asset.id && (
              <div className="mt-3 p-6 bg-slate-900/50 rounded-[2rem] border border-emerald-500/10 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Internal Vault</p>
                    <p className="text-xl font-black text-white tracking-tight">
                      {showBalance
                        ? (asset.symbol === 'USDT'
                          ? `${asset.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`
                          : format(asset.balance))
                        : '••••••'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Asset Type</p>
                    <p className="text-xl font-black text-slate-300">
                      {asset.symbol === 'USDT' ? 'Stablecoin' : 'Fiat'}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-white/5 flex gap-3">
                  <button className="flex-1 py-3 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:border-slate-700 transition-all">Receive</button>
                  <button className="flex-1 py-3 bg-emerald-500 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all">Send Asset</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
