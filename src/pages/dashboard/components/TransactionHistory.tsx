import { useState } from 'react';
import { formatDateTime } from '../../../lib/localeUtils';

interface TransactionHistoryProps {
  transactions: any[];
  currencyRates: any[];
}

export default function TransactionHistory({ transactions, currencyRates }: TransactionHistoryProps) {
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending' | 'failed'>('all');

  const filteredTransactions = filter === 'all' 
    ? transactions 
    : transactions.filter(t => t.status === filter);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'pending':
        return 'bg-amber-500/20 text-amber-400';
      case 'failed':
        return 'bg-red-500/20 text-red-400';
      case 'cancelled':
        return 'bg-neutral-500/20 text-neutral-400';
      default:
        return 'bg-neutral-500/20 text-neutral-400';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'buy':
        return 'ri-arrow-down-circle-line text-emerald-400';
      case 'sell':
        return 'ri-arrow-up-circle-line text-blue-400';
      case 'exchange':
        return 'ri-exchange-line text-purple-400';
      default:
        return 'ri-exchange-line text-neutral-400';
    }
  };

  const getCurrencySymbol = (code: string) => {
    const currency = currencyRates.find(r => r.currency_code === code);
    return currency?.currency_symbol || code;
  };

  return (
    <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <i className="ri-history-line text-lime-400"></i>
          Transaction History
        </h2>

        {/* Filter Tabs */}
        <div className="flex gap-2 bg-dark-elevated p-1 rounded-lg">
          {['all', 'completed', 'pending', 'failed'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status as any)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                filter === status
                  ? 'bg-lime-500/20 text-lime-400'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions List */}
      {filteredTransactions.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-dark-elevated rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-inbox-line text-3xl text-neutral-500"></i>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No transactions yet</h3>
          <p className="text-sm text-neutral-500">Start trading to see your transaction history here</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {filteredTransactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center gap-4 p-4 rounded-lg border border-dark-border hover:border-lime-500/50 hover:bg-dark-elevated transition-all"
            >
              {/* Icon */}
              <div className="w-10 h-10 bg-dark-elevated rounded-lg flex items-center justify-center flex-shrink-0">
                <i className={`${getTypeIcon(transaction.transaction_type)} text-xl`}></i>
              </div>

              {/* Transaction Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-white capitalize">
                    {transaction.transaction_type}
                  </p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                    {transaction.status}
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  {getCurrencySymbol(transaction.from_currency)}{transaction.from_amount.toLocaleString()} {transaction.from_currency} → {getCurrencySymbol(transaction.to_currency)}{transaction.to_amount.toLocaleString()} {transaction.to_currency}
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  {formatDateTime(transaction.created_at)}
                </p>
              </div>

              {/* Amount */}
              <div className="text-right">
                <p className="text-sm font-bold text-white">
                  {getCurrencySymbol(transaction.to_currency)}{transaction.to_amount.toLocaleString()}
                </p>
                <p className="text-xs text-neutral-500">{transaction.to_currency}</p>
              </div>

              {/* Action Button */}
              <button className="w-8 h-8 flex items-center justify-center hover:bg-dark-elevated rounded-lg transition-colors cursor-pointer">
                <i className="ri-more-2-fill text-neutral-400"></i>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
