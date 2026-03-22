/**
 * Withdraw Type Selection Modal - Spent-style
 * Choose: Crypto | Fiat (Bank) | Send to Spender
 */

interface WithdrawTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCrypto: () => void;
  onSelectFiat: () => void;
  onSelectPlatform: () => void;
  usdtBalance: number;
  usdBalance: number;
}

export default function WithdrawTypeModal({
  isOpen,
  onClose,
  onSelectCrypto,
  onSelectFiat,
  onSelectPlatform,
  usdtBalance,
  usdBalance,
}: WithdrawTypeModalProps) {
  if (!isOpen) return null;

  const options = [
    {
      id: 'crypto',
      label: 'Crypto Withdrawal',
      desc: 'Withdraw USDT to external wallet',
      icon: 'ri-database-2-line',
      color: 'from-orange-500 to-orange-600',
      onClick: onSelectCrypto,
      balance: usdtBalance,
      disabled: usdtBalance <= 0,
    },
    {
      id: 'fiat',
      label: 'Fiat Withdrawal',
      desc: 'Withdraw money to your bank account',
      icon: 'ri-bank-line',
      color: 'from-purple-500 to-purple-600',
      onClick: onSelectFiat,
      balance: usdBalance,
      disabled: usdBalance <= 0,
    },
    {
      id: 'platform',
      label: 'Send to Spender',
      desc: 'Send funds using email/username',
      icon: 'ri-user-line',
      color: 'from-emerald-500 to-emerald-600',
      onClick: onSelectPlatform,
      balance: usdBalance + usdtBalance,
      disabled: usdBalance + usdtBalance <= 0,
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-3xl border border-white/10 shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Withdraw</h2>
            <p className="text-sm text-neutral-400 mt-0.5">Choose how you wish to withdraw</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => !opt.disabled && opt.onClick()}
              disabled={opt.disabled}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                opt.disabled
                  ? 'bg-white/5 border-white/5 opacity-60 cursor-not-allowed'
                  : 'bg-white/5 border-white/10 hover:border-lime-500/30 hover:bg-white/[0.08] cursor-pointer'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${opt.color} flex items-center justify-center shrink-0`}>
                <i className={`${opt.icon} text-white text-xl`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white">{opt.label}</p>
                <p className="text-sm text-neutral-400 truncate">{opt.desc}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-medium ${opt.disabled ? 'text-neutral-500' : 'text-lime-400'}`}>
                  ${opt.balance.toFixed(2)}
                </p>
                {opt.disabled && (
                  <p className="text-xs text-neutral-500">Add funds first</p>
                )}
              </div>
              {!opt.disabled && (
                <i className="ri-arrow-right-s-line text-neutral-500 text-xl"></i>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
