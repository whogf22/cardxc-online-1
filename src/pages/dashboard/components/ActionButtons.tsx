import { useNavigate } from 'react-router-dom';

interface ActionButtonsProps {
  onDepositClick: () => void;
  onWithdrawClick: () => void;
}

export default function ActionButtons({ onDepositClick, onWithdrawClick }: ActionButtonsProps) {
  const navigate = useNavigate();

  const actions = [
    {
      icon: 'ri-add-circle-fill',
      label: 'DEPOSIT',
      bgColor: 'bg-emerald-500 hover:shadow-emerald-500/40',
      textColor: 'text-white',
      onClick: onDepositClick,
    },
    {
      icon: 'ri-subtract-line',
      label: 'WITHDRAW',
      bgColor: 'bg-dark-elevated hover:shadow-white/10',
      textColor: 'text-white',
      border: 'border border-white/10',
      onClick: onWithdrawClick,
    },
    {
      icon: 'ri-arrow-left-right-line',
      label: 'SWAP',
      bgColor: 'bg-dark-elevated hover:shadow-white/10',
      textColor: 'text-white',
      border: 'border border-white/10',
      onClick: () => navigate('/swap'),
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4 sm:gap-6">
      {actions.map((action, index) => (
        <button
          key={index}
          onClick={action.onClick}
          className={`group relative ${action.bgColor} ${action.textColor} ${action.border || ''} h-28 sm:h-32 rounded-[1.75rem] font-black text-[10px] sm:text-xs transition-all duration-300 flex flex-col items-center justify-center gap-3 cursor-pointer shadow-3d-depth hover:-translate-y-2 hover:shadow-3d-float active:shadow-3d-pressed active:translate-y-1 transform-gpu`}
        >
          {/* 3D Inner Lighting Effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-[1.75rem]"></div>
          
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 shadow-3d-depth ${index === 0 ? 'bg-white/20' : 'bg-white/5'}`}>
            <i className={`${action.icon} text-2xl ${index === 0 ? 'text-white' : 'text-cream-300'}`}></i>
          </div>
          <span className="relative z-10 uppercase tracking-widest font-black">{action.label}</span>
          
          {/* Bottom Reflection */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-white/20 blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </button>
      ))}
    </div>
  );
}
