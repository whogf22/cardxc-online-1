import { useCurrencyFormat } from '../../../hooks/useCurrencyFormat';
import CurrencySelector from '../../../components/CurrencySelector';

interface TotalAssetCardProps {
  usdBalance: number;
  usdtBalance: number;
  showBalance: boolean;
  onToggleBalance: () => void;
}

export default function TotalAssetCard({ usdBalance, usdtBalance, showBalance, onToggleBalance }: TotalAssetCardProps) {
  const format = useCurrencyFormat();
  const totalBalance = usdBalance + usdtBalance;

  return (
    <div className="relative preserve-3d group cursor-pointer">
      {/* 3D Background Shadow Layer */}
      <div className="absolute inset-0 bg-emerald-900/40 rounded-[2.5rem] blur-2xl transform transition-transform duration-500 group-hover:scale-105 group-hover:translate-y-4"></div>

      <div className="relative bg-gradient-to-br from-[#1a1a1a] via-[#0d0d0d] to-[#050505] rounded-[2.5rem] border border-white/10 p-6 sm:p-8 overflow-hidden transition-all duration-500 transform-gpu group-hover:rotate-x-2 group-hover:-rotate-y-2 group-hover:-translate-y-2 shadow-3d-float">
        
        {/* Animated 3D Light Reflection */}
        <div className="absolute -inset-[100%] bg-gradient-to-tr from-transparent via-white/5 to-transparent transition-transform duration-1000 group-hover:translate-x-1/2 group-hover:translate-y-1/2 rotate-45 pointer-events-none"></div>

        {/* 3D Interactive Elements (Floating Blobs) */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-emerald-500/30 rounded-full blur-[100px] animate-pulse-soft"></div>
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-cream-300/10 rounded-full blur-[80px]"></div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-cream-300 text-dark-bg rounded-2xl flex items-center justify-center shadow-3d-depth">
                <i className="ri-wallet-3-fill text-2xl"></i>
              </div>
              <div>
                <span className="text-xs text-neutral-400 block font-medium uppercase tracking-widest">Total Portfolio</span>
                <span className="text-xs text-emerald-400 font-bold bg-emerald-400/10 px-2 py-0.5 rounded-full mt-1 inline-block">
                  Live Balance
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-1">
                <CurrencySelector variant="minimal" size="sm" className="text-white" />
              </div>
              <button
                onClick={onToggleBalance}
                className="w-10 h-10 flex items-center justify-center bg-white/5 backdrop-blur-md rounded-2xl hover:bg-white/10 transition-all border border-white/10"
              >
                <i className={`${showBalance ? 'ri-eye-line' : 'ri-eye-off-line'} text-white text-lg`}></i>
              </button>
            </div>
          </div>

          <div className="mb-10 text-center sm:text-left">
            <div className="inline-flex items-baseline gap-2 mb-3 transform-gpu transition-transform duration-500 group-hover:translate-z-10">
              {showBalance ? (
                <span className="text-5xl sm:text-6xl md:text-7xl font-black text-white tracking-tighter depth-text">
                  {format(totalBalance, { maximumFractionDigits: 2 })}
                </span>
              ) : (
                <span className="text-5xl sm:text-6xl md:text-7xl font-bold text-white tracking-[0.2em]">••••••••</span>
              )}
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-3">
              <div className="flex items-center gap-1.5 bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-black shadow-3d-depth">
                <i className="ri-arrow-up-s-fill"></i>
                <span>2.06%</span>
              </div>
              <span className="text-neutral-500 text-sm font-semibold italic">Up since last login</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/5 backdrop-blur-xl rounded-[1.5rem] p-4 border border-white/10 hover:bg-white/10 transition-colors shadow-inner">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <i className="ri-money-dollar-circle-fill text-emerald-400 text-xl"></i>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">USD Wallet</span>
                  <span className="text-lg font-bold text-white block">
                    {showBalance ? `$${usdBalance.toLocaleString()}` : '••••'}
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-xl rounded-[1.5rem] p-4 border border-white/10 hover:bg-white/10 transition-colors shadow-inner">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-500/20 rounded-xl flex items-center justify-center">
                  <i className="ri-coin-fill text-teal-400 text-xl"></i>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">USDT Wallet</span>
                  <span className="text-lg font-bold text-white block">
                    {showBalance ? `${usdtBalance.toLocaleString()} USDT` : '••••'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
