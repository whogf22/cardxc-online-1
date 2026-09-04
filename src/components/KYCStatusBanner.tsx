import { useUserContext } from '../hooks/useUserContext';

interface KYCStatusBannerProps {
  onUploadClick?: () => void;
}

function isFinalRejection(type: 'FINAL' | 'RETRY' | null | undefined): boolean {
  return type === 'FINAL';
}

export function KYCStatusBanner({ onUploadClick }: KYCStatusBannerProps) {
  const { context, loading } = useUserContext();

  if (loading || !context) return null;

  // Never show KYC banner for Super Admins
  if (context.is_admin) return null;

  if (context.kyc_status === 'approved') return null;

  const baseConfig = {
    not_started: {
      icon: 'ri-shield-check-line',
      bgColor: 'bg-gradient-to-r from-violet-500/10 to-indigo-500/10',
      borderColor: 'border-violet-500/30',
      textColor: 'text-white',
      iconColor: 'text-violet-400',
      title: 'Verify Your Identity',
      message: 'Financial regulations require us to confirm who you are before you can send, withdraw, or use virtual cards. Your documents are processed securely by our verification partner.',
      buttonText: 'Start Verification',
      showButton: true,
    },
    pending: {
      icon: 'ri-time-line',
      bgColor: 'bg-gradient-to-r from-blue-500/10 to-cyan-500/10',
      borderColor: 'border-blue-500/30',
      textColor: 'text-white',
      iconColor: 'text-blue-400',
      title: 'Verification In Progress',
      message: 'Your verification is being reviewed. We will notify you by email once it is complete.',
      buttonText: '',
      showButton: false,
    },
    rejected: {
      icon: 'ri-close-circle-line',
      bgColor: 'bg-gradient-to-r from-red-500/10 to-rose-500/10',
      borderColor: 'border-red-500/30',
      textColor: 'text-white',
      iconColor: 'text-red-400',
      title: 'Verification Rejected',
      message: 'We could not approve your verification. Please review the feedback and resubmit if prompted.',
      buttonText: 'Resubmit Verification',
      showButton: true,
    },
    expired: {
      icon: 'ri-error-warning-line',
      bgColor: 'bg-gradient-to-r from-amber-500/10 to-orange-500/10',
      borderColor: 'border-amber-500/30',
      textColor: 'text-white',
      iconColor: 'text-amber-400',
      title: 'Verification Expired',
      message: 'Your verification has expired. Please resubmit to continue using all features.',
      buttonText: 'Restart Verification',
      showButton: true,
    },
  };

  const config = { ...baseConfig[context.kyc_status as keyof typeof baseConfig] };
  if (!config) return null;

  // Final rejections from the provider cannot be retried.
  if (context.kyc_status === 'rejected' && isFinalRejection(context.kyc_rejection_type)) {
    config.message = 'Your verification was rejected and cannot be retried through the automated flow. Please contact support for assistance.';
    config.buttonText = '';
    config.showButton = false;
  }

  return (
    <div className={`${config.bgColor} border ${config.borderColor} rounded-2xl p-4 mb-6 backdrop-blur-sm`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
          <i className={`${config.icon} text-xl ${config.iconColor}`}></i>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`font-semibold ${config.textColor} mb-0.5 text-sm`}>
            {config.title}
          </h4>
          <p className="text-xs text-gray-400 mb-2 leading-relaxed">
            {config.message}
          </p>
          {config.showButton && onUploadClick && (
            <button
              onClick={onUploadClick}
              className="px-4 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-lg shadow-violet-500/20"
            >
              {config.buttonText}
            </button>
          )}
          {context.kyc_status === 'pending' && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-blue-400">
                <i className="ri-loader-4-line animate-spin text-sm"></i>
                Under Review
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
