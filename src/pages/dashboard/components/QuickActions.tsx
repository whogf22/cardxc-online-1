import { useNavigate } from 'react-router-dom';

interface QuickActionsProps {
  onDeposit?: () => void;
  onWithdraw?: () => void;
}

export default function QuickActions({ onDeposit, onWithdraw }: QuickActionsProps) {
  const navigate = useNavigate();
  
  const actions = [
    {
      icon: 'ri-bank-card-line',
      label: 'Virtual Cards',
      description: 'Manage your cards',
      color: 'lime',
      iconBg: 'bg-[#9AF941]/20',
      iconColor: 'text-[#9AF941]',
      onClick: () => navigate('/cards'),
    },
    {
      icon: 'ri-add-circle-line',
      label: 'Deposit',
      description: 'Add funds to payment account',
      color: 'emerald',
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
      onClick: onDeposit,
    },
    {
      icon: 'ri-money-dollar-circle-line',
      label: 'Withdraw',
      description: 'Cash out balance',
      color: 'purple',
      iconBg: 'bg-purple-500/20',
      iconColor: 'text-purple-400',
      onClick: onWithdraw,
    },
    {
      icon: 'ri-history-line',
      label: 'History',
      description: 'See all transactions',
      color: 'blue',
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      onClick: () => navigate('/transactions'),
    },
  ];

  return (
    <div className="dark-card p-6">
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <i className="ri-flashlight-line text-[#9AF941]"></i>
        Quick Actions
      </h2>

      <div className="space-y-2">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={action.onClick}
            className="w-full flex items-center gap-4 p-4 rounded-xl bg-dark-elevated border border-dark-border hover:border-neutral-600 hover:bg-dark-hover transition-all cursor-pointer group"
          >
            <div className={`w-10 h-10 ${action.iconBg} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
              <i className={`${action.icon} text-xl ${action.iconColor}`}></i>
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-white">{action.label}</p>
              <p className="text-xs text-neutral-500">{action.description}</p>
            </div>
            <i className="ri-arrow-right-s-line text-neutral-500 group-hover:text-[#9AF941] transition-colors"></i>
          </button>
        ))}
      </div>
    </div>
  );
}
