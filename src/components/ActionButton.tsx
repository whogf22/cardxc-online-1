import { useState, useCallback } from 'react';

interface ActionButtonProps {
  onClick: () => Promise<void> | void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  icon?: string;
  className?: string;
  fullWidth?: boolean;
}

export function ActionButton({
  onClick,
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  icon,
  className = '',
  fullWidth = false,
}: ActionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (isLoading || disabled) return;

    try {
      setIsLoading(true);
      await onClick();
    } catch (error) {
      console.error('Action button error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [onClick, isLoading, disabled]);

  const variantClasses = {
    primary: 'bg-gradient-to-r from-sky-500 to-purple-600 hover:from-sky-600 hover:to-purple-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const isDisabled = disabled || isLoading;

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        font-semibold rounded-lg transition-all duration-200
        flex items-center justify-center gap-2
        whitespace-nowrap
        ${className}
      `}
    >
      {isLoading ? (
        <>
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          <span>Processing...</span>
        </>
      ) : (
        <>
          {icon && <i className={`${icon} text-lg`}></i>}
          {children}
        </>
      )}
    </button>
  );
}
