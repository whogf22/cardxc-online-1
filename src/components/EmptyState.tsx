interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'card' | 'inline' | 'dark';
}

export function EmptyState({
  icon = 'ri-inbox-line',
  title,
  description,
  action,
  variant = 'default',
}: EmptyStateProps) {
  const containerClasses = {
    default: 'py-16 px-8',
    card: 'p-8 bg-dark-card rounded-2xl border border-dark-border',
    inline: 'py-8 px-4',
    dark: 'py-16 px-8 bg-dark-card rounded-2xl border border-dark-border',
  };

  const isDark = variant === 'dark' || variant === 'card' || variant === 'inline';
  const iconBgClass = isDark ? 'bg-dark-elevated' : 'bg-slate-100';
  const iconColorClass = isDark ? 'text-lime-400/80' : 'text-slate-400';
  const titleClass = isDark ? 'text-white' : 'text-slate-900';
  const descClass = isDark ? 'text-neutral-400' : 'text-slate-600';
  const btnClass = isDark
    ? 'btn-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-bg'
    : 'px-6 py-3 bg-lime-500 hover:bg-lime-600 text-white font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2';

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${containerClasses[variant]}`}
      role="status"
      aria-label={title}
    >
      <div className={`w-16 h-16 ${iconBgClass} rounded-2xl flex items-center justify-center mb-4`}>
        <i className={`${icon} text-3xl ${iconColorClass}`} aria-hidden></i>
      </div>
      
      <h3 className={`text-lg font-semibold mb-2 ${titleClass}`}>
        {title}
      </h3>
      
      {description && (
        <p className={`text-sm max-w-sm mb-6 ${descClass}`}>
          {description}
        </p>
      )}
      
      {action && (
        <button
          onClick={action.onClick}
          className={btnClass}
          type="button"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
