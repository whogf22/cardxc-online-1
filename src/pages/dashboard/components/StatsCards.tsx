import { useCurrencyFormat } from '../../../hooks/useCurrencyFormat';

interface StatsCardsProps {
  transactions: any[];
  currencyRates: any[];
}

export default function StatsCards({ transactions, currencyRates }: StatsCardsProps) {
  const format = useCurrencyFormat();
  const completedTransactions = transactions.filter(t => t.status === 'completed');
  const pendingTransactions = transactions.filter(t => t.status === 'pending');
  
  const totalIncome = completedTransactions
    .filter(t => t.entry_type === 'credit' || t.type === 'deposit' || t.transaction_type === 'deposit')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  
  const totalExpenses = completedTransactions
    .filter(t => t.entry_type === 'debit' || t.type === 'withdrawal' || t.transaction_type === 'withdrawal')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const stats = [
    {
      title: 'Total Income',
      value: format(totalIncome),
      change: '+12.5%',
      changeType: 'positive',
      icon: 'ri-arrow-up-circle-fill',
      bgColor: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
    },
    {
      title: 'Total Expenses',
      value: format(totalExpenses),
      change: '-8.2%',
      changeType: 'negative',
      icon: 'ri-arrow-down-circle-fill',
      bgColor: 'bg-gradient-to-br from-orange-500 to-orange-600',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
    },
    {
      title: 'Active Currencies',
      value: currencyRates.length.toString(),
      change: '+2 new',
      changeType: 'positive',
      icon: 'ri-exchange-dollar-fill',
      bgColor: 'bg-gradient-to-br from-blue-500 to-blue-600',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      title: 'Pending Transactions',
      value: pendingTransactions.length.toString(),
      change: 'Awaiting',
      changeType: 'neutral',
      icon: 'ri-time-fill',
      bgColor: 'bg-gradient-to-br from-purple-500 to-purple-600',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer"
        >
          <div className="flex items-start justify-between mb-4">
            <div className={`w-12 h-12 ${stat.iconBg} rounded-xl flex items-center justify-center`}>
              <i className={`${stat.icon} text-2xl ${stat.iconColor}`}></i>
            </div>
            <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
              stat.changeType === 'positive' 
                ? 'bg-emerald-100 text-emerald-700' 
                : stat.changeType === 'negative'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-slate-100 text-slate-700'
            }`}>
              {stat.change}
            </div>
          </div>
          <div>
            <p className="text-slate-600 text-sm font-medium mb-1">{stat.title}</p>
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
