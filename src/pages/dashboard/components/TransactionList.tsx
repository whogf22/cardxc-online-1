import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrencyFormat } from '../../../hooks/useCurrencyFormat';
import { formatDateTime } from '../../../lib/localeUtils';

interface TransactionListProps {
  transactions: any[];
}

export default function TransactionList({ transactions }: TransactionListProps) {
  const format = useCurrencyFormat();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>('all');

  const getTransactionType = (entry: any): string => {
    if (entry.entry_type === 'credit') return 'deposit';
    if (entry.entry_type === 'debit') return 'withdrawal';
    return entry.transaction_type || entry.type || '';
  };

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'deposit', label: 'Received' },
    { key: 'withdrawal', label: 'Sent' },
    { key: 'transfer', label: 'Transfer' },
  ];

  const filteredTransactions = transactions.filter(t => {
    const transactionType = getTransactionType(t);
    if (filter === 'all') return true;
    return transactionType === filter;
  });

  const getTransactionIcon = (entry: any) => {
    const transactionType = getTransactionType(entry);
    switch (transactionType) {
      case 'deposit':
        return { icon: 'ri-arrow-down-line', color: 'text-lime-400', bg: 'bg-lime-400/10' };
      case 'withdrawal':
        return { icon: 'ri-arrow-up-line', color: 'text-orange-400', bg: 'bg-orange-400/10' };
      default:
        return { icon: 'ri-arrow-left-right-line', color: 'text-blue-400', bg: 'bg-blue-400/10' };
    }
  };

  return (
    <div className="animate-fade-in-up" style={{ animationDelay: '0.25s', animationFillMode: 'forwards' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white text-lg font-semibold">Transactions</h3>
        <button
          onClick={() => navigate('/transactions')}
          className="text-neutral-400 text-xs font-medium cursor-pointer hover:text-lime-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 rounded px-2 py-1"
        >
          See All
        </button>
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-hide pb-1">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 ${
              filter === f.key
                ? 'bg-lime-500 text-black'
                : 'bg-dark-elevated text-neutral-400 border border-dark-border hover:bg-dark-hover hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12 animate-fade-in-up">
            <div className="w-16 h-16 bg-dark-elevated rounded-full flex items-center justify-center mx-auto mb-3 border border-dark-border">
              <i className="ri-exchange-line text-2xl text-neutral-500"></i>
            </div>
            <p className="text-neutral-500 text-sm">No transactions yet</p>
          </div>
        ) : (
          filteredTransactions.slice(0, 10).map((transaction) => {
            const transactionType = getTransactionType(transaction);
            const iconData = getTransactionIcon(transaction);
            const isCredit = transactionType === 'deposit';
            return (
              <div
                key={transaction.id}
                className="flex items-center justify-between py-3 cursor-pointer hover:bg-dark-elevated rounded-xl px-2 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 ${iconData.bg} rounded-full flex items-center justify-center`}>
                    <i className={`${iconData.icon} text-lg ${iconData.color}`}></i>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {transaction.description || (isCredit ? 'Received' : 'Sent')}
                    </p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {formatDateTime(transaction.created_at)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${isCredit ? 'text-lime-400' : 'text-white'}`}>
                    {isCredit ? '+' : '-'}{format(transaction.amount || 0)}
                  </p>
                  <p className="text-[10px] text-neutral-500 capitalize mt-0.5">
                    {transaction.status || transactionType}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
