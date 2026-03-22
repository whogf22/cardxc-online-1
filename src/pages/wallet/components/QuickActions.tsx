interface QuickActionsProps {
  onDeposit: () => void;
  onWithdraw: () => void;
}

export default function QuickActions({ onDeposit, onWithdraw }: QuickActionsProps) {
  return (
    <div className="bg-dark-card rounded-2xl border border-dark-border p-6">
      <h3 className="text-lg font-bold text-white mb-6">Quick Actions</h3>
      
      <div className="space-y-3">
        <button
          onClick={onDeposit}
          className="w-full flex items-center space-x-4 p-4 rounded-xl hover:bg-lime-500/10 transition-all cursor-pointer whitespace-nowrap border-2 border-transparent hover:border-lime-500/30 group"
        >
          <div className="w-12 h-12 bg-lime-500 rounded-xl flex items-center justify-center">
            <i className="ri-add-circle-fill text-black text-xl"></i>
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-white">Add Money</p>
            <p className="text-sm text-neutral-500">Deposit to your payment account</p>
          </div>
          <i className="ri-arrow-right-s-line text-neutral-400 group-hover:text-lime-400"></i>
        </button>

        <button
          onClick={onWithdraw}
          className="w-full flex items-center space-x-4 p-4 rounded-xl hover:bg-dark-elevated transition-all cursor-pointer whitespace-nowrap border-2 border-transparent hover:border-dark-border group"
        >
          <div className="w-12 h-12 bg-dark-elevated rounded-xl flex items-center justify-center border border-dark-border">
            <i className="ri-arrow-up-circle-fill text-neutral-400 text-xl"></i>
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-white">Send Money</p>
            <p className="text-sm text-neutral-500">Withdraw to bank account</p>
          </div>
          <i className="ri-arrow-right-s-line text-neutral-400 group-hover:text-white"></i>
        </button>

        <a
          href="/transactions"
          className="w-full flex items-center space-x-4 p-4 rounded-xl hover:bg-dark-elevated transition-all cursor-pointer whitespace-nowrap border-2 border-transparent hover:border-dark-border group"
        >
          <div className="w-12 h-12 bg-dark-elevated rounded-xl flex items-center justify-center border border-dark-border">
            <i className="ri-history-line text-neutral-400 text-xl"></i>
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-white">View History</p>
            <p className="text-sm text-neutral-500">All transactions</p>
          </div>
          <i className="ri-arrow-right-s-line text-neutral-400 group-hover:text-white"></i>
        </a>
      </div>

      <div className="mt-6 p-4 bg-lime-500/10 rounded-xl border border-lime-500/20">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 bg-lime-500 rounded-full flex items-center justify-center flex-shrink-0">
            <i className="ri-shield-check-fill text-black"></i>
          </div>
          <div>
            <p className="text-sm font-semibold text-white mb-1">Secure & Protected</p>
            <p className="text-xs text-neutral-400">Your funds are protected with bank-level security and encryption.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
