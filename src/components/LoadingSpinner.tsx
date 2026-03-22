interface LoadingSpinnerProps {
  variant?: 'light' | 'dark' | 'auto' | 'lime';
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

export function LoadingSpinner({ 
  variant = 'auto', 
  size = 'md',
  fullScreen = true 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: { outer: 'w-8 h-8 border-2', inner: 'w-4 h-4' },
    md: { outer: 'w-16 h-16 border-4', inner: 'w-8 h-8' },
    lg: { outer: 'w-24 h-24 border-4', inner: 'w-12 h-12' },
  };

  const bgClasses = {
    light: 'bg-gradient-to-br from-slate-50 via-white to-slate-100',
    dark: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900',
    auto: 'bg-gradient-to-br from-slate-50 via-white to-slate-100',
    lime: 'bg-dark-bg',
  };

  const spinnerClasses = {
    light: { border: 'border-sky-500/30 border-t-sky-500', pulse: 'bg-sky-500/20' },
    dark: { border: 'border-sky-400/30 border-t-sky-400', pulse: 'bg-sky-400/20' },
    auto: { border: 'border-sky-500/30 border-t-sky-500', pulse: 'bg-sky-500/20' },
    lime: { border: 'border-lime-500/30 border-t-lime-500', pulse: 'bg-lime-500/10' },
  };

  const spinnerContent = (
    <div className="relative" role="status" aria-label="Loading">
      <div className={`${sizeClasses[size].outer} ${spinnerClasses[variant].border} rounded-full animate-spin`}></div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`${sizeClasses[size].inner} ${spinnerClasses[variant].pulse} rounded-full animate-pulse`}></div>
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );

  if (!fullScreen) {
    return spinnerContent;
  }

  return (
    <div className={`min-h-screen flex items-center justify-center ${bgClasses[variant]}`}>
      {spinnerContent}
    </div>
  );
}
