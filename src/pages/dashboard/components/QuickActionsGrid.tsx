import { useNavigate } from 'react-router-dom';

export default function QuickActionsGrid() {
  const navigate = useNavigate();
  
  const actions = [
    {
      title: 'Giftcards',
      description: 'Buy & sell giftcards',
      icon: 'ri-gift-line',
      iconBg: 'bg-pink-500/10',
      iconColor: 'text-pink-500',
      onClick: () => navigate('/giftcards'),
    },
    {
      title: 'Rates',
      description: 'Check exchange rates',
      icon: 'ri-exchange-dollar-line',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      onClick: () => navigate('/calculator'),
    },
    {
      title: 'Savings',
      description: 'Grow your money',
      icon: 'ri-safe-2-line',
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-500',
      onClick: () => navigate('/savings'),
    },
    {
      title: 'Virtual Card',
      description: 'Get virtual cards',
      icon: 'ri-bank-card-line',
      iconBg: 'bg-lime-500/10',
      iconColor: 'text-lime-500',
      onClick: () => navigate('/cards'),
    },
    {
      title: 'Rewards',
      description: 'Earn & redeem',
      icon: 'ri-trophy-line',
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-500',
      onClick: () => navigate('/rewards'),
    },
    {
      title: 'Transfer',
      description: 'Send money fast',
      icon: 'ri-send-plane-line',
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-500',
      onClick: () => navigate('/transfer'),
    },
    {
      title: 'Swap',
      description: 'Convert currencies',
      icon: 'ri-swap-line',
      iconBg: 'bg-cyan-500/10',
      iconColor: 'text-cyan-500',
      onClick: () => navigate('/swap'),
    },
    {
      title: 'Payments',
      description: 'Pay & receive',
      icon: 'ri-money-dollar-circle-line',
      iconBg: 'bg-orange-500/10',
      iconColor: 'text-orange-500',
      onClick: () => navigate('/payments'),
    },
  ];

  return (
    <div className="bg-dark-card rounded-2xl border border-white/5 p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-bold text-white">Quick Actions</h3>
        <button 
          onClick={() => navigate('/wallet')}
          className="text-xs text-lime-400 font-semibold hover:text-lime-300 transition-colors"
        >
          See All
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={action.onClick}
            className="group flex flex-col items-center gap-2.5 py-3 rounded-xl hover:bg-white/[0.03] transition-all cursor-pointer"
          >
            <div className={`w-12 h-12 ${action.iconBg} rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110`}>
              <i className={`${action.icon} text-xl ${action.iconColor}`}></i>
            </div>
            <span className="text-[11px] font-medium text-neutral-400 group-hover:text-white transition-colors text-center leading-tight">{action.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
