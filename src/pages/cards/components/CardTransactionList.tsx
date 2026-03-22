import type { CardTransaction } from '../../../types/card';

interface CardTransactionListProps {
  transactions: CardTransaction[];
  isLoading?: boolean;
}

export default function CardTransactionList({ transactions, isLoading }: CardTransactionListProps) {
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatAmount = (amount: number, type: 'DEBIT' | 'CREDIT') => {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return type === 'CREDIT' ? `+$${formatted}` : `-$${formatted}`;
  };

  const groupByDate = (txs: CardTransaction[]) => {
    const groups: { [key: string]: CardTransaction[] } = {};
    txs.forEach(tx => {
      const date = formatDate(tx.created_at);
      if (!groups[date]) groups[date] = [];
      groups[date].push(tx);
    });
    return groups;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-4 p-4 bg-dark-elevated rounded-xl animate-pulse">
            <div className="w-12 h-12 bg-dark-border rounded-xl"></div>
            <div className="flex-1">
              <div className="h-4 bg-dark-border rounded w-24 mb-2"></div>
              <div className="h-3 bg-dark-border rounded w-16"></div>
            </div>
            <div className="h-5 bg-dark-border rounded w-20"></div>
          </div>
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-dark-elevated rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="ri-exchange-line text-2xl text-neutral-500"></i>
        </div>
        <p className="text-neutral-400">No transactions yet</p>
        <p className="text-sm text-neutral-500 mt-1">Your card transactions will appear here</p>
      </div>
    );
  }

  const grouped = groupByDate(transactions);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([date, txs]) => (
        <div key={date}>
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
            {date}
          </div>
          <div className="space-y-2">
            {txs.map(tx => (
              <div
                key={tx.id}
                className="flex items-center gap-4 p-4 bg-dark-elevated hover:bg-dark-hover rounded-xl transition-colors cursor-pointer border border-dark-border"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  tx.merchant_icon ? 'bg-dark-card' : tx.type === 'CREDIT' ? 'bg-success-500/10' : 'bg-dark-card'
                }`}>
                  {tx.merchant_icon ? (
                    <i className={`${tx.merchant_icon} text-xl text-neutral-300`}></i>
                  ) : tx.type === 'CREDIT' ? (
                    <i className="ri-add-line text-xl text-success-400"></i>
                  ) : (
                    <i className="ri-shopping-bag-line text-xl text-neutral-400"></i>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white truncate">
                    {tx.merchant_name || 'Transaction'}
                  </div>
                  <div className="text-sm text-neutral-500 flex items-center gap-2">
                    <span>{formatTime(tx.created_at)}</span>
                    <span>|</span>
                    <span className={`${
                      tx.status === 'COMPLETED' ? 'text-success-400' :
                      tx.status === 'PENDING' ? 'text-warning-400' :
                      tx.status === 'DECLINED' ? 'text-danger-400' :
                      'text-neutral-400'
                    }`}>
                      {tx.status}
                    </span>
                  </div>
                </div>
                
                <div className={`font-bold text-lg ${
                  tx.type === 'CREDIT' ? 'text-success-400' : 'text-white'
                }`}>
                  {formatAmount(tx.amount, tx.type)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
