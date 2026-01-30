import { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  type: ToastType;
  message: string;
  onClose: () => void;
  duration?: number;
}

export function Toast({ type, message, onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const config = {
    success: {
      icon: 'ri-checkbox-circle-line',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      iconColor: 'text-emerald-600',
      textColor: 'text-emerald-900',
    },
    error: {
      icon: 'ri-error-warning-line',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      iconColor: 'text-red-600',
      textColor: 'text-red-900',
    },
    warning: {
      icon: 'ri-alert-line',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      iconColor: 'text-amber-600',
      textColor: 'text-amber-900',
    },
    info: {
      icon: 'ri-information-line',
      bgColor: 'bg-sky-50',
      borderColor: 'border-sky-200',
      iconColor: 'text-sky-600',
      textColor: 'text-sky-900',
    },
  };

  const style = config[type];

  return (
    <div
      className={`
        ${style.bgColor} ${style.borderColor}
        border rounded-xl shadow-lg p-4 min-w-[320px] max-w-md
        animate-slide-in-right
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 ${style.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <i className={`${style.icon} ${style.iconColor} text-xl`}></i>
        </div>
        <div className="flex-1 pt-1">
          <p className={`${style.textColor} font-medium text-sm leading-relaxed`}>
            {message}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
        >
          <i className="ri-close-line text-lg"></i>
        </button>
      </div>
    </div>
  );
}

// Toast Container
interface ToastContainerProps {
  children: React.ReactNode;
}

export function ToastContainer({ children }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
      {children}
    </div>
  );
}
