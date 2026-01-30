import { useUserContext } from '../hooks/useUserContext';

interface KYCStatusBannerProps {
  onUploadClick?: () => void;
}

export function KYCStatusBanner({ onUploadClick }: KYCStatusBannerProps) {
  const { context, loading } = useUserContext() as any;

  if (loading || !context) return null;

  // Never show KYC banner for Super Admins
  if (context.role === 'SUPER_ADMIN') return null;

  if (context.kyc_status === 'approved') return null;

  const statusConfig = {
    pending: {
      icon: 'ri-time-line',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      iconColor: 'text-blue-600',
      title: 'KYC Verification Pending',
      message: 'Your identity verification is being reviewed. This usually takes 24-48 hours.',
    },
    rejected: {
      icon: 'ri-close-circle-line',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-600',
      title: 'KYC Verification Rejected',
      message: 'Your verification was not approved. Please resubmit with valid documents.',
    },
    expired: {
      icon: 'ri-error-warning-line',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      textColor: 'text-amber-800',
      iconColor: 'text-amber-600',
      title: 'KYC Verification Expired',
      message: 'Your verification has expired. Please update your documents to continue.',
    },
  };

  const config = statusConfig[context.kyc_status as keyof typeof statusConfig];
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
          {context.kyc_status !== 'pending' && onUploadClick && (
            <button 
              onClick={onUploadClick}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              {context.kyc_status === 'rejected' ? 'Resubmit Documents' : 'Upload Documents'}
            </button>
          )}
          {context.kyc_status === 'pending' && !onUploadClick && (
            <span className="inline-flex items-center gap-2 text-sm text-blue-600">
              <i className="ri-loader-4-line animate-spin"></i>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
