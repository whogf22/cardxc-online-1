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
      onClick: () => navigate('/rates'),
    },
    {
      title: 'Bills',
      description: 'Pay utility bills',
      icon: 'ri-file-list-3-line',
      iconBg: 'bg-orange-500/10',
      iconColor: 'text-orange-500',
      onClick: () => navigate('/bills'),
    },
    {
      title: 'Virtual Card',
      description: 'Get virtual cards',
      icon: 'ri-bank-card-line',
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-500',
      onClick: () => navigate('/cards'),
    },
  ];

  return (
    <div className="bg-dark-card rounded-[2rem] border border-white/5 p-6 shadow-3d-depth">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
        <h3 className="text-lg font-black text-white uppercase tracking-tighter">Explore Features</h3>
        <button className="text-xs text-cream-300 font-bold hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-full">
          See All
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={action.onClick}
            className="group relative bg-dark-elevated/40 backdrop-blur-md border border-white/5 p-4 rounded-[1.5rem] transition-all duration-300 transform-gpu hover:-translate-y-2 hover:bg-dark-elevated hover:shadow-3d-float hover:border-cream-300/20 active:shadow-3d-pressed active:scale-95 cursor-pointer"
          >
            {/* Floating Reflection Layer */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-[1.5rem]"></div>

            <div className="flex flex-col items-center gap-4 relative z-10">
              <div className={`w-14 h-14 ${action.iconBg} rounded-[1.25rem] flex items-center justify-center transition-all duration-500 group-hover:scale-110 shadow-3d-depth group-hover:shadow-glow-sm bg-white/5`}>
                <i className={`${action.icon} text-2xl ${action.iconColor}`}></i>
              </div>
              <div className="text-center">
                <span className="text-xs font-black text-white block uppercase tracking-wide">{action.title}</span>
                <span className="text-[10px] text-neutral-500 font-medium block mt-1 line-clamp-1">{action.description}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
