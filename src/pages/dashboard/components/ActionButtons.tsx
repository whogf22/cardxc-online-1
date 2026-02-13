import { useNavigate } from 'react-router-dom';

interface ActionButtonsProps {
  onDepositClick: () => void;
  onWithdrawClick: () => void;
}

export default function ActionButtons({ onDepositClick, onWithdrawClick }: ActionButtonsProps) {
  const navigate = useNavigate();

  const actions = [
    {
      icon: 'ri-arrow-right-up-line',
      label: 'Withdraw',
      onClick: onWithdrawClick,
    },
    {
      icon: 'ri-arrow-left-down-line',
      label: 'Deposit',
      onClick: onDepositClick,
    },
    {
      icon: 'ri-bank-card-line',
      label: 'Pay',
      onClick: () => navigate('/cards'),
    },
    {
      icon: 'ri-qr-scan-2-line',
      label: 'Scan',
      onClick: () => navigate('/transfer'),
    },
  ];

  return (
    <div className="flex items-center justify-between px-4">
      {actions.map((action, index) => (
        <button
          key={index}
          onClick={action.onClick}
          className="flex flex-col items-center gap-2 cursor-pointer group"
        >
          <div className="w-14 h-14 rounded-2xl bg-[#1a1a1a] border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-all">
            <i className={`${action.icon} text-white text-xl`}></i>
          </div>
          <span className="text-gray-400 text-xs font-medium">{action.label}</span>
        </button>
      ))}
    </div>
  );
}
