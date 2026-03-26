interface Balance {
  currency: string;
  available_balance: number;
  reserved_balance: number;
  total_balance: number;
  usdtBalance?: number;
}

interface BalanceCardsProps {
  balances: Balance[];
  onDeposit: (currency: string) => void;
  onWithdraw: (currency: string) => void;
}

const currencyConfig: Record<string, { icon: string; color: string; symbol: string; name: string }> = {
  USD: { icon: 'ri-money-dollar-circle-fill', color: 'from-lime-500 to-lime-600', symbol: '$', name: 'US Dollar' },
  EUR: { icon: 'ri-money-euro-circle-fill', color: 'from-blue-500 to-blue-600', symbol: '€', name: 'Euro' },
  GBP: { icon: 'ri-money-pound-circle-fill', color: 'from-indigo-500 to-indigo-600', symbol: '£', name: 'British Pound' },
  NGN: { icon: 'ri-currency-fill', color: 'from-orange-500 to-orange-600', symbol: '₦', name: 'Nigerian Naira' },
  BDT: { icon: 'ri-exchange-funds-fill', color: 'from-purple-500 to-purple-600', symbol: '৳', name: 'Bangladeshi Taka' },
};

export default function BalanceCards({ balances, onDeposit, onWithdraw }: BalanceCardsProps) {
  const formatAmount = (amount: number, currency: string) => {
    const config = currencyConfig[currency];
    return `${config?.symbol || ''}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-4">
      {balances.map((balance) => {
        const config = currencyConfig[balance.currency] || { icon: 'ri-coin-fill', color: 'from-gray-500 to-gray-600', symbol: '', name: balance.currency };
        
        return (
          <div key={balance.currency} className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden">
            <div className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br ${config.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <i className={`${config.icon} text-white text-lg sm:text-xl`}></i>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-white truncate">{balance.currency} Account</h3>
                    <p className="text-xs sm:text-sm text-neutral-500 truncate">{config.name}</p>
                  </div>
                </div>
                <div className="text-left sm:text-right pl-13 sm:pl-0">
                  <p className="text-xs text-neutral-500 mb-1">Total Balance</p>
                  <p className="text-xl sm:text-2xl font-bold text-white break-words">{formatAmount(balance.total_balance, balance.currency)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
                <div className="bg-lime-500/10 rounded-xl p-3 sm:p-4 border border-lime-500/20">
                  <p className="text-[10px] sm:text-xs text-lime-400 font-medium mb-1">Available</p>
                  <p className="text-sm sm:text-lg font-bold text-lime-400 break-words">{formatAmount(balance.available_balance, balance.currency)}</p>
                </div>
                <div className="bg-amber-500/10 rounded-xl p-3 sm:p-4 border border-amber-500/20">
                  <p className="text-[10px] sm:text-xs text-amber-400 font-medium mb-1">Reserved</p>
                  <p className="text-sm sm:text-lg font-bold text-amber-400 break-words">{formatAmount(balance.reserved_balance, balance.currency)}</p>
                </div>
              </div>

              {balance.usdtBalance && balance.usdtBalance > 0 && (
                <div className="bg-lime-500/10 rounded-xl p-3 sm:p-4 border border-lime-500/20 mb-4 sm:mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-lime-500 rounded-full flex items-center justify-center">
                      <i className="ri-coin-fill text-black text-xs"></i>
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs text-lime-400 font-medium">Crypto Balance</p>
                      <p className="text-sm sm:text-lg font-bold text-lime-400">{balance.usdtBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={() => onDeposit(balance.currency)}
                  className="flex-1 bg-lime-500 hover:bg-lime-400 text-black px-3 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center space-x-1 sm:space-x-2 text-sm sm:text-base"
                >
                  <i className="ri-add-circle-line text-base sm:text-lg"></i>
                  <span>Deposit</span>
                </button>
                <button
                  onClick={() => onWithdraw(balance.currency)}
                  className="flex-1 bg-dark-elevated hover:bg-dark-hover text-white px-3 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap border border-dark-border hover:border-lime-500/50 flex items-center justify-center space-x-1 sm:space-x-2 text-sm sm:text-base"
                >
                  <i className="ri-arrow-up-circle-line text-base sm:text-lg"></i>
                  <span>Withdraw</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {balances.length === 0 && (
        <div className="bg-dark-card rounded-2xl border border-dark-border p-12 text-center">
          <div className="w-16 h-16 bg-dark-elevated rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-wallet-3-line text-3xl text-neutral-500"></i>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">No Accounts Yet</h3>
          <p className="text-neutral-400">Your account balances will appear here once you make your first deposit.</p>
        </div>
      )}
    </div>
  );
}
