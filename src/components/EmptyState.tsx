interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'card' | 'inline';
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
    card: 'p-8 bg-white rounded-2xl border border-slate-200 shadow-sm',
    inline: 'py-8 px-4',
  };

  return (
    <div className={`flex flex-col items-center justify-center text-center ${containerClasses[variant]}`}>
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <i className={`${icon} text-3xl text-slate-400`}></i>
      </div>
      
      <h3 className="text-lg font-semibold text-slate-900 mb-2">
        {title}
      </h3>
      
      {description && (
        <p className="text-slate-600 text-sm max-w-sm mb-6">
          {description}
        </p>
      )}
      
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap shadow-lg shadow-sky-600/20"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
