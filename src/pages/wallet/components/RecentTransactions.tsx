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
    if (isNaN(date.getTime())) return '—';
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
    <div className="bg-dark-card rounded-2xl border border-dark-border">
      <div className="p-6 border-b border-dark-border">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Recent Transactions</h2>
          <a href="/transactions" className="text-sm font-medium text-lime-400 hover:text-lime-300 cursor-pointer whitespace-nowrap">
            View All
          </a>
        </div>
      </div>

      <div className="divide-y divide-dark-border">
        {transactions.length > 0 ? (
          transactions.slice(0, 10).map((transaction) => (
            <div key={transaction.id} className="p-6 hover:bg-dark-elevated transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    transaction.entry_type === 'credit'
                      ? 'bg-lime-500/20'
                      : 'bg-red-500/20'
                  }`}>
                    <i className={`text-xl ${
                      transaction.entry_type === 'credit'
                        ? 'ri-arrow-down-line text-lime-400'
                        : 'ri-arrow-up-line text-red-400'
                    }`}></i>
                  </div>
                  <div>
                    <p className="font-semibold text-white">{transaction.merchantDisplayName || transaction.merchant_display_name || transaction.description || 'Transaction'}</p>
                    <p className="text-sm text-neutral-500">{formatDate(transaction.created_at)}</p>
                    <p className="text-xs text-neutral-400 mt-1">Ref: {transaction.reference}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${
                    transaction.entry_type === 'credit'
                      ? 'text-lime-400'
                      : 'text-red-400'
                  }`}>
                    {transaction.entry_type === 'credit' ? '+' : '-'}{formatAmount(transaction.amount, transaction.currency)}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">{transaction.currency}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-dark-elevated rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-history-line text-3xl text-neutral-500"></i>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">No Transactions Yet</h3>
            <p className="text-neutral-400">Your transaction history will appear here once you start using your wallet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
