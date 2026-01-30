import { useState } from 'react';
import { useCurrencyFormat } from '../../../hooks/useCurrencyFormat';

interface TransactionListProps {
  transactions: any[];
}

export default function TransactionList({ transactions }: TransactionListProps) {
  const format = useCurrencyFormat();
  const [filter, setFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'exchange'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const getTransactionType = (entry: any): string => {
    if (entry.entry_type === 'credit') return 'deposit';
    if (entry.entry_type === 'debit') return 'withdrawal';
    return entry.transaction_type || entry.type || '';
  };

  const filteredTransactions = transactions.filter(t => {
    const transactionType = getTransactionType(t);
    const matchesFilter = filter === 'all' || transactionType === filter;
    const matchesSearch = searchQuery === '' || 
      t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.currency_code?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getTransactionIcon = (entry: any) => {
    const transactionType = getTransactionType(entry);
    switch (transactionType) {
      case 'deposit':
        return { icon: 'ri-arrow-down-circle-fill', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
      case 'withdrawal':
        return { icon: 'ri-arrow-up-circle-fill', color: 'text-orange-400', bg: 'bg-orange-500/10' };
      case 'exchange':
        return { icon: 'ri-exchange-dollar-fill', color: 'text-blue-400', bg: 'bg-blue-500/10' };
      default:
        return { icon: 'ri-arrow-left-right-line', color: 'text-neutral-400', bg: 'bg-neutral-500/10' };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-wider rounded-lg border border-emerald-500/20 shadow-glow-sm">Completed</span>;
      case 'pending':
        return <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 text-[10px] font-black uppercase tracking-wider rounded-lg border border-amber-500/20">Pending</span>;
      case 'failed':
        return <span className="px-2.5 py-1 bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-wider rounded-lg border border-red-500/20">Failed</span>;
      default:
        return <span className="px-2.5 py-1 bg-neutral-500/10 text-neutral-400 text-[10px] font-black uppercase tracking-wider rounded-lg">{status}</span>;
    }
  };

  return (
    <div className="bg-dark-card rounded-[2rem] border border-white/5 p-6 shadow-3d-depth">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-xl font-black text-white uppercase tracking-tighter">Ledger History</h3>
          <p className="text-xs text-neutral-500 mt-1 font-medium">{filteredTransactions.length} operations detected</p>
        </div>
        <button className="btn-3d px-6 py-2.5 !rounded-xl !text-xs self-start sm:self-auto">
          <span className="flex items-center gap-2">
            <i className="ri-download-2-fill text-sm"></i>
            Export Logs
          </span>
        </button>
      </div>

      <div className="flex flex-col gap-4 mb-8">
        <div className="relative">
          <i className="ri-search-2-line absolute left-5 top-1/2 -translate-y-1/2 text-neutral-500"></i>
          <input
            type="text"
            placeholder="Search by description or currency..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-dark-elevated/50 border border-white/5 rounded-2xl text-sm text-white focus:outline-none focus:ring-4 focus:ring-cream-300/10 focus:border-cream-300/30 transition-all shadow-inner"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {['all', 'deposit', 'withdrawal', 'exchange'].map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type as any)}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all transform-gpu active:scale-95 ${
                filter === type
                  ? 'bg-cream-300 text-dark-bg shadow-glow-sm'
                  : 'bg-dark-elevated text-neutral-400 hover:text-white hover:bg-dark-hover border border-white/5'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-20 bg-dark-elevated/20 rounded-3xl border border-dashed border-white/5">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="ri-ghost-line text-4xl text-neutral-600"></i>
            </div>
            <p className="text-white font-black uppercase tracking-tighter">Empty Vault</p>
            <p className="text-xs text-neutral-500 mt-2">No matching operations found in your ledger.</p>
          </div>
        ) : (
          filteredTransactions.map((transaction) => {
            const transactionType = getTransactionType(transaction);
            const iconData = getTransactionIcon(transaction);
            const isDeposit = transactionType === 'deposit';
            return (
              <div
                key={transaction.id}
                className="group flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-cream-300/20 hover:shadow-3d-float transition-all duration-300 transform-gpu hover:-translate-y-1 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 ${iconData.bg} rounded-[1.25rem] flex items-center justify-center transition-transform group-hover:scale-110 shadow-inner`}>
                    <i className={`${iconData.icon} text-2xl ${iconData.color}`}></i>
                  </div>
                  <div>
                    <p className="text-sm font-black text-white uppercase tracking-tight">
                      {transaction.merchantDisplayName || transaction.description || `${transactionType} trx`}
                    </p>
                    <p className="text-[10px] text-neutral-500 font-bold mt-1">
                      {new Date(transaction.created_at).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="hidden sm:block">
                    {getStatusBadge(transaction.status)}
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-black tracking-tighter ${
                      isDeposit ? 'text-emerald-400' : 'text-white'
                    }`}>
                      {isDeposit ? '+' : '-'}{format(transaction.amount || 0)}
                    </p>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase">
                      {transaction.currency_code || 'USD'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {filteredTransactions.length > 0 && (
        <div className="flex items-center justify-between mt-10 pt-8 border-t border-white/5 px-2">
          <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">
            Page 1 of 12
          </p>
          <div className="flex gap-3">
            <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-dark-elevated text-neutral-500 hover:text-white transition-colors border border-white/5">
              <i className="ri-arrow-left-s-line text-xl"></i>
            </button>
            <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-dark-elevated text-neutral-500 hover:text-white transition-colors border border-white/5 shadow-glow-sm">
              <i className="ri-arrow-right-s-line text-xl"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
