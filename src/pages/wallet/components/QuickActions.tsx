interface QuickActionsProps {
  onDeposit: () => void;
  onWithdraw: () => void;
}

export default function QuickActions({ onDeposit, onWithdraw }: QuickActionsProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
      <h3 className="text-lg font-bold text-slate-900 mb-6">Quick Actions</h3>
      
      <div className="space-y-3">
        <button
          onClick={onDeposit}
          className="w-full flex items-center space-x-4 p-4 rounded-xl hover:bg-emerald-50 transition-all cursor-pointer whitespace-nowrap border-2 border-transparent hover:border-emerald-500 group"
        >
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:shadow-emerald-500/40">
            <i className="ri-add-circle-fill text-white text-xl"></i>
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-slate-900">Add Money</p>
            <p className="text-sm text-slate-500">Deposit to your payment account</p>
          </div>
          <i className="ri-arrow-right-s-line text-slate-400 group-hover:text-emerald-600"></i>
        </button>

        <button
          onClick={onWithdraw}
          className="w-full flex items-center space-x-4 p-4 rounded-xl hover:bg-slate-50 transition-all cursor-pointer whitespace-nowrap border-2 border-transparent hover:border-slate-300 group"
        >
          <div className="w-12 h-12 bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl flex items-center justify-center shadow-lg">
            <i className="ri-arrow-up-circle-fill text-white text-xl"></i>
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-slate-900">Send Money</p>
            <p className="text-sm text-slate-500">Withdraw to bank account</p>
          </div>
          <i className="ri-arrow-right-s-line text-slate-400 group-hover:text-slate-600"></i>
        </button>

        <a
          href="/transactions"
          className="w-full flex items-center space-x-4 p-4 rounded-xl hover:bg-slate-50 transition-all cursor-pointer whitespace-nowrap border-2 border-transparent hover:border-slate-300 group"
        >
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <i className="ri-history-line text-white text-xl"></i>
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-slate-900">View History</p>
            <p className="text-sm text-slate-500">All transactions</p>
          </div>
          <i className="ri-arrow-right-s-line text-slate-400 group-hover:text-indigo-600"></i>
        </a>
      </div>

      <div className="mt-6 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
            <i className="ri-shield-check-fill text-white"></i>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 mb-1">Secure & Protected</p>
            <p className="text-xs text-slate-600">Your funds are protected with bank-level security and encryption.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
