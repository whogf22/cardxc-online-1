import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function QuickActionsGrid() {
  const navigate = useNavigate();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  const actions = [
    { title: 'Transfer', icon: 'ri-send-plane-line', gradient: 'from-lime-500/20 to-lime-600/10', glowColor: 'rgba(132,204,22,0.15)', iconColor: 'text-lime-400', onClick: () => navigate('/transfer') },
    { title: 'Virtual Card', icon: 'ri-bank-card-line', gradient: 'from-lime-500/20 to-emerald-600/10', glowColor: 'rgba(132,204,22,0.15)', iconColor: 'text-lime-400', onClick: () => navigate('/cards') },
    { title: 'Savings', icon: 'ri-safe-2-line', gradient: 'from-emerald-500/20 to-emerald-600/10', glowColor: 'rgba(16,185,129,0.15)', iconColor: 'text-emerald-400', onClick: () => navigate('/savings') },
    { title: 'Rates', icon: 'ri-exchange-dollar-line', gradient: 'from-blue-500/20 to-blue-600/10', glowColor: 'rgba(59,130,246,0.15)', iconColor: 'text-blue-400', onClick: () => navigate('/calculator') },
    { title: 'Rewards', icon: 'ri-trophy-line', gradient: 'from-amber-500/20 to-amber-600/10', glowColor: 'rgba(245,158,11,0.15)', iconColor: 'text-amber-400', onClick: () => navigate('/rewards') },
    { title: 'Swap', icon: 'ri-swap-line', gradient: 'from-cyan-500/20 to-cyan-600/10', glowColor: 'rgba(6,182,212,0.15)', iconColor: 'text-cyan-400', onClick: () => navigate('/swap') },
    { title: 'Payments', icon: 'ri-money-dollar-circle-line', gradient: 'from-orange-500/20 to-orange-600/10', glowColor: 'rgba(249,115,22,0.15)', iconColor: 'text-orange-400', onClick: () => navigate('/payments') },
    { title: 'Gift Cards', icon: 'ri-gift-line', gradient: 'from-pink-500/20 to-pink-600/10', glowColor: 'rgba(236,72,153,0.15)', iconColor: 'text-pink-400', onClick: () => navigate('/giftcards') },
  ];

  return (
    <div 
      className="relative rounded-3xl border border-white/[0.06] p-5 opacity-0 animate-fade-in-up overflow-hidden" 
      style={{ 
        animationDelay: '0.2s', 
        animationFillMode: 'forwards',
        background: 'linear-gradient(145deg, rgba(13,13,13,0.8) 0%, rgba(20,20,20,0.6) 100%)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 20px 40px -10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      {/* Subtle mesh gradient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-40 h-40 bg-lime-500/[0.02] rounded-full blur-[60px]" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/[0.02] rounded-full blur-[50px]" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-white tracking-tight">Quick Actions</h3>
          <button 
            onClick={() => navigate('/wallet')}
            className="text-xs text-lime-400/80 font-semibold hover:text-lime-300 transition-colors px-2 py-1 rounded-lg hover:bg-lime-400/5"
          >
            See All
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="group relative flex flex-col items-center gap-2.5 py-4 px-2 rounded-2xl transition-all duration-300 cursor-pointer min-h-[96px] opacity-0 animate-fade-in-up"
              style={{
                animationDelay: `${0.25 + index * 0.05}s`,
                animationFillMode: 'forwards',
                background: hoveredIndex === index ? 'rgba(255,255,255,0.03)' : 'transparent',
                transform: hoveredIndex === index ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
                boxShadow: hoveredIndex === index ? `0 12px 24px -8px ${action.glowColor}` : 'none',
              }}
            >
              {/* Icon container with gradient background */}
              <div 
                className={`relative w-13 h-13 bg-gradient-to-br ${action.gradient} rounded-xl flex items-center justify-center transition-all duration-300 overflow-hidden`}
                style={{
                  width: '52px',
                  height: '52px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  transform: hoveredIndex === index ? 'scale(1.08)' : 'scale(1)',
                }}
              >
                {/* Shimmer on hover */}
                <div 
                  className="absolute inset-0 transition-opacity duration-500"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(255,255,255,0.05) 100%)',
                    opacity: hoveredIndex === index ? 1 : 0,
                  }}
                />
                <i className={`${action.icon} text-xl ${action.iconColor} relative z-10 transition-transform duration-300 ${hoveredIndex === index ? 'scale-110' : ''}`}></i>
              </div>
              
              <span className="text-[11px] font-medium text-neutral-500 group-hover:text-white transition-colors duration-300 text-center leading-tight">
                {action.title}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
