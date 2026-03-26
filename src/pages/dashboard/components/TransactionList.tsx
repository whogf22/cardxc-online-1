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
    { key: 'all', label: 'All', icon: 'ri-list-check' },
    { key: 'deposit', label: 'Received', icon: 'ri-arrow-down-line' },
    { key: 'withdrawal', label: 'Sent', icon: 'ri-arrow-up-line' },
    { key: 'transfer', label: 'Transfer', icon: 'ri-arrow-left-right-line' },
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
        return { icon: 'ri-arrow-down-line', color: 'text-lime-400', bg: 'bg-lime-400/10', borderColor: 'border-lime-400/20' };
      case 'withdrawal':
        return { icon: 'ri-arrow-up-line', color: 'text-orange-400', bg: 'bg-orange-400/10', borderColor: 'border-orange-400/20' };
      default:
        return { icon: 'ri-arrow-left-right-line', color: 'text-blue-400', bg: 'bg-blue-400/10', borderColor: 'border-blue-400/20' };
    }
  };

  return (
    <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white text-lg font-semibold tracking-tight">Transactions</h3>
        <button
          onClick={() => navigate('/transactions')}
          className="text-neutral-500 text-xs font-medium cursor-pointer hover:text-lime-400 transition-colors px-2 py-1 rounded-lg hover:bg-lime-400/5"
        >
          See All <i className="ri-arrow-right-s-line text-sm"></i>
        </button>
      </div>

      {/* Filter pills with glass effect */}
      <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-hide pb-1">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300 cursor-pointer ${
              filter === f.key
                ? 'bg-lime-500 text-black shadow-glow-sm'
                : 'bg-white/[0.03] text-neutral-400 border border-white/[0.06] hover:bg-white/[0.06] hover:text-white backdrop-blur-sm'
            }`}
          >
            <i className={`${f.icon} text-[10px]`}></i>
            {f.label}
          </button>
        ))}
      </div>

      {/* Transaction list with glass cards */}
      <div 
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, rgba(13,13,13,0.6) 0%, rgba(20,20,20,0.4) 100%)',
          border: '1px solid rgba(255,255,255,0.04)',
          backdropFilter: 'blur(10px)',
        }}
      >
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-16 animate-fade-in">
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{
                background: 'linear-gradient(145deg, rgba(20,20,20,0.8), rgba(13,13,13,0.9))',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '0 8px 24px -4px rgba(0,0,0,0.4)',
              }}
            >
              <i className="ri-exchange-line text-2xl text-neutral-600"></i>
            </div>
            <p className="text-neutral-500 text-sm font-medium">No transactions yet</p>
            <p className="text-neutral-600 text-xs mt-1">Your activity will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {filteredTransactions.slice(0, 10).map((transaction, idx) => {
              const transactionType = getTransactionType(transaction);
              const iconData = getTransactionIcon(transaction);
              const isCredit = transactionType === 'deposit';
              return (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between py-3.5 px-4 hover:bg-white/[0.02] transition-all duration-200 cursor-pointer group opacity-0 animate-fade-in-up"
                  style={{ 
                    animationDelay: `${0.35 + idx * 0.04}s`, 
                    animationFillMode: 'forwards',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className={`w-11 h-11 ${iconData.bg} rounded-xl flex items-center justify-center border ${iconData.borderColor} transition-all duration-300 group-hover:scale-105`}
                    >
                      <i className={`${iconData.icon} text-lg ${iconData.color}`}></i>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white group-hover:text-lime-50 transition-colors">
                        {transaction.description || (isCredit ? 'Received' : 'Sent')}
                      </p>
                      <p className="text-[11px] text-neutral-600 mt-0.5">
                        {formatDateTime(transaction.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${isCredit ? 'text-lime-400' : 'text-white'}`}>
                      {isCredit ? '+' : '-'}{format(transaction.amount || 0)}
                    </p>
                    <p className={`text-[10px] mt-0.5 capitalize font-medium ${
                      transaction.status === 'completed' ? 'text-lime-500/60' : 
                      transaction.status === 'pending' ? 'text-amber-500/60' : 'text-neutral-600'
                    }`}>
                      {transaction.status || transactionType}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
