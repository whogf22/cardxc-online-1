import { useUserContext } from '../hooks/useUserContext';

export function AccountStateBanner() {
  const { context, loading } = useUserContext();

  if (loading || !context) return null;

  if (context.account_status === 'active') return null;

  const stateConfig = {
    limited: {
      icon: 'ri-shield-line',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      textColor: 'text-amber-800',
      iconColor: 'text-amber-600',
      title: 'Limited Account Access',
      message: 'Some features are temporarily restricted on your account.',
    },
    suspended: {
      icon: 'ri-pause-circle-line',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-600',
      title: 'Account Suspended',
      message: 'Your account has been suspended. Please contact support for assistance.',
    },
    closed: {
      icon: 'ri-close-circle-line',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      textColor: 'text-gray-800',
      iconColor: 'text-gray-600',
      title: 'Account Closed',
      message: 'This account has been closed and cannot be used.',
    },
  };

  const config = stateConfig[context.account_status as keyof typeof stateConfig];
  if (!config) return null;

  return (
    <div className={`${config.bgColor} border ${config.borderColor} rounded-lg p-4 mb-6`}>
      <div className="flex items-start gap-3">
        <i className={`${config.icon} text-2xl ${config.iconColor} mt-0.5`}></i>
        <div className="flex-1">
          <h4 className={`font-semibold ${config.textColor} mb-1`}>
            {config.title}
          </h4>
          <p className={`text-sm ${config.textColor} opacity-90 mb-3`}>
            {config.message}
          </p>
          {context.account_status !== 'closed' && (
            <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              Contact Support
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
