interface ProgressBarProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'danger';
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  size = 'md',
  variant = 'default',
  showLabel = false,
  label,
  animated = true,
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  
  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };
  
  const variantClasses = {
    default: 'bg-sky-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
  };

  return (
    <div className="space-y-2">
      {(showLabel || label) && (
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">{label}</span>
          {showLabel && (
            <span className="font-medium text-slate-900">{Math.round(percentage)}%</span>
          )}
        </div>
      )}
      <div 
        className={`w-full bg-slate-200 rounded-full overflow-hidden ${sizeClasses[size]}`}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={`${sizeClasses[size]} ${variantClasses[variant]} rounded-full transition-all duration-500 ease-out ${animated ? 'animate-shimmer' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
