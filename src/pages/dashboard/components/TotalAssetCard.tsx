import { useNavigate } from 'react-router-dom';
import { useCurrencyFormat } from '../../../hooks/useCurrencyFormat';

interface TotalAssetCardProps {
  usdBalance: number;
  usdtBalance: number;
  showBalance: boolean;
  onToggleBalance: () => void;
}

export default function TotalAssetCard({ usdBalance, usdtBalance, showBalance, onToggleBalance }: TotalAssetCardProps) {
  const navigate = useNavigate();
  const format = useCurrencyFormat();
  const totalBalance = usdBalance + usdtBalance;

  return (
    <div className="bg-dark-card rounded-2xl p-5 border border-dark-border animate-fade-in-up transition-all duration-300 hover:border-lime-500/20 shadow-3d-depth">
      <div className="flex items-center justify-between mb-3">
        <span className="text-neutral-400 text-sm">My Balance</span>
        <button
          onClick={() => navigate('/cards')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dark-border text-white text-xs font-medium hover:bg-dark-elevated transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500"
        >
          Add Card <i className="ri-add-line text-sm"></i>
        </button>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <button onClick={onToggleBalance} className="cursor-pointer focus:outline-none">
          {showBalance ? (
            <span className="text-4xl font-bold text-white tracking-tight">
              {format(totalBalance, { maximumFractionDigits: 2 })}
            </span>
          ) : (
            <span className="text-4xl font-bold text-white tracking-tight">*****</span>
          )}
        </button>
        <button
          onClick={onToggleBalance}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-dark-elevated cursor-pointer hover:bg-dark-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500"
        >
          <i className={`${showBalance ? 'ri-eye-line' : 'ri-eye-off-line'} text-neutral-400 text-sm`}></i>
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-lime-400 text-sm font-medium">
          <i className="ri-arrow-up-s-fill"></i>
          {totalBalance > 0 ? '+2.06%' : '0.00%'}
        </span>
      </div>
    </div>
  );
}
