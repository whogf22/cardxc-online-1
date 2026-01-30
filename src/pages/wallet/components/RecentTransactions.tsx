interface Transaction {
  id: string;
  entry_type: 'credit' | 'debit';
  amount: number;
  currency: string;
  description: string;
  reference: string;
  created_at: string;
  status?: string;
  merchantDisplayName?: string;
  merchant_display_name?: string;
}

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export default function RecentTransactions({ transactions }: RecentTransactionsProps) {
  const formatAmount = (amount: number, currency: string) => {
    const symbols: Record<string, string> = {
      NGN: '₦',
      USD: '$',
      BDT: '৳'
    };
    return `${symbols[currency] || ''}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-100">
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Recent Transactions</h2>
          <a href="/transactions" className="text-sm font-medium text-emerald-600 hover:text-emerald-700 cursor-pointer whitespace-nowrap">
            View All
          </a>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {transactions.length > 0 ? (
          transactions.slice(0, 10).map((transaction) => (
            <div key={transaction.id} className="p-6 hover:bg-slate-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    transaction.entry_type === 'credit'
                      ? 'bg-emerald-100'
                      : 'bg-red-100'
                  }`}>
                    <i className={`text-xl ${
                      transaction.entry_type === 'credit'
                        ? 'ri-arrow-down-line text-emerald-600'
                        : 'ri-arrow-up-line text-red-600'
                    }`}></i>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{transaction.merchantDisplayName || transaction.merchant_display_name || transaction.description || 'Transaction'}</p>
                    <p className="text-sm text-slate-500">{formatDate(transaction.created_at)}</p>
                    <p className="text-xs text-slate-400 mt-1">Ref: {transaction.reference}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${
                    transaction.entry_type === 'credit'
                      ? 'text-emerald-600'
                      : 'text-red-600'
                  }`}>
                    {transaction.entry_type === 'credit' ? '+' : '-'}{formatAmount(transaction.amount, transaction.currency)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{transaction.currency}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-history-line text-3xl text-slate-400"></i>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">No Transactions Yet</h3>
            <p className="text-slate-600">Your transaction history will appear here once you start using your wallet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
