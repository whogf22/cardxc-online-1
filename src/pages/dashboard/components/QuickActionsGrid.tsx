import { useNavigate } from 'react-router-dom';

export default function QuickActionsGrid() {
  const navigate = useNavigate();
  
  const actions = [
    { title: 'Transfer', icon: 'ri-send-plane-line', iconBg: 'bg-lime-500/20', iconColor: 'text-lime-400', onClick: () => navigate('/transfer') },
    { title: 'Virtual Card', icon: 'ri-bank-card-line', iconBg: 'bg-lime-500/20', iconColor: 'text-lime-400', onClick: () => navigate('/cards') },
    { title: 'Savings', icon: 'ri-safe-2-line', iconBg: 'bg-emerald-500/20', iconColor: 'text-emerald-400', onClick: () => navigate('/savings') },
    { title: 'Rates', icon: 'ri-exchange-dollar-line', iconBg: 'bg-blue-500/20', iconColor: 'text-blue-400', onClick: () => navigate('/calculator') },
    { title: 'Rewards', icon: 'ri-trophy-line', iconBg: 'bg-amber-500/20', iconColor: 'text-amber-400', onClick: () => navigate('/rewards') },
    { title: 'Swap', icon: 'ri-swap-line', iconBg: 'bg-cyan-500/20', iconColor: 'text-cyan-400', onClick: () => navigate('/swap') },
    { title: 'Payments', icon: 'ri-money-dollar-circle-line', iconBg: 'bg-orange-500/20', iconColor: 'text-orange-400', onClick: () => navigate('/payments') },
    { title: 'Gift Cards', icon: 'ri-gift-line', iconBg: 'bg-pink-500/20', iconColor: 'text-pink-400', onClick: () => navigate('/giftcards') },
  ];

  return (
    <div 
      className="bg-dark-card rounded-2xl border border-dark-border p-5 animate-fade-in-up transition-all duration-300 hover:border-lime-500/20 shadow-3d-depth" 
      style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-bold text-white">Quick Actions</h3>
        <button 
          onClick={() => navigate('/wallet')}
          className="text-xs text-lime-400 font-semibold hover:text-lime-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 rounded px-2 py-1"
        >
          See All
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={action.onClick}
            className="group flex flex-col items-center gap-2.5 py-4 px-2 rounded-xl hover:bg-dark-elevated active:scale-[0.98] transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-card min-h-[88px]"
          >
            <div className={`w-12 h-12 ${action.iconBg} rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105`}>
              <i className={`${action.icon} text-xl ${action.iconColor}`}></i>
            </div>
            <span className="text-xs font-medium text-neutral-400 group-hover:text-white transition-colors text-center leading-tight">{action.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
