import { useNavigate } from 'react-router-dom';

interface ActionButtonsProps {
  onDepositClick: () => void;
  onWithdrawClick: () => void;
}

export default function ActionButtons({ onDepositClick, onWithdrawClick }: ActionButtonsProps) {
  const navigate = useNavigate();

  const actions = [
    { icon: 'ri-arrow-right-up-line', label: 'Withdraw', onClick: onWithdrawClick },
    { icon: 'ri-arrow-left-down-line', label: 'Deposit', onClick: onDepositClick },
    { icon: 'ri-bank-card-line', label: 'Pay', onClick: () => navigate('/payments') },
    { icon: 'ri-qr-scan-2-line', label: 'Scan', onClick: () => navigate('/transfer') },
  ];

  return (
    <div className="flex items-center justify-between px-2 sm:px-4 gap-2">
      {actions.map((action, index) => (
        <button
          key={index}
          onClick={action.onClick}
          className="flex flex-col items-center gap-2 cursor-pointer group opacity-0 animate-fade-in-up flex-1 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-bg rounded-xl py-2"
          style={{ animationDelay: `${index * 0.06}s`, animationFillMode: 'forwards' }}
        >
          <div className="w-14 h-14 rounded-2xl bg-dark-elevated border border-dark-border flex items-center justify-center group-hover:bg-dark-hover group-hover:border-lime-500/30 group-active:scale-95 transition-all duration-200 shrink-0">
            <i className={`${action.icon} text-neutral-300 group-hover:text-lime-400 text-xl`}></i>
          </div>
          <span className="text-neutral-400 text-xs font-medium group-hover:text-white transition-colors truncate w-full text-center">{action.label}</span>
        </button>
      ))}
    </div>
  );
}
