interface TransactionStatusBadgeProps {
  status: 'pending' | 'completed' | 'failed' | 'approved' | 'rejected';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function TransactionStatusBadge({
  status,
  size = 'md',
  showIcon = true,
}: TransactionStatusBadgeProps) {
  const statusConfig = {
    pending: {
      label: 'Pending',
      icon: 'ri-time-line',
      bgColor: 'bg-amber-100',
      textColor: 'text-amber-700',
      iconColor: 'text-amber-600',
    },
    completed: {
      label: 'Completed',
      icon: 'ri-checkbox-circle-line',
      bgColor: 'bg-emerald-100',
      textColor: 'text-emerald-700',
      iconColor: 'text-emerald-600',
    },
    failed: {
      label: 'Failed',
      icon: 'ri-close-circle-line',
      bgColor: 'bg-red-100',
      textColor: 'text-red-700',
      iconColor: 'text-red-600',
    },
    approved: {
      label: 'Approved',
      icon: 'ri-checkbox-circle-line',
      bgColor: 'bg-green-100',
      textColor: 'text-green-700',
      iconColor: 'text-green-600',
    },
    rejected: {
      label: 'Rejected',
      icon: 'ri-close-circle-line',
      bgColor: 'bg-red-100',
      textColor: 'text-red-700',
      iconColor: 'text-red-600',
    },
  };

  const config = statusConfig[status];
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full font-medium
        ${config.bgColor} ${config.textColor} ${sizeClasses[size]}
      `}
    >
      {showIcon && <i className={`${config.icon} ${config.iconColor}`}></i>}
      {config.label}
    </span>
  );
}
