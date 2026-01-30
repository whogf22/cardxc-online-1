import { ReactNode } from 'react';
import { useUserContext } from '../hooks/useUserContext';

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
  showReason?: boolean;
}

export function FeatureGate({ 
  feature, 
  children, 
  fallback,
  showReason = true 
}: FeatureGateProps) {
  const { hasFeature, loading, context } = useUserContext();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasFeature(feature)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showReason) {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <i className="ri-lock-line text-4xl text-amber-600 mb-3"></i>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Feature Not Available
          </h3>
          <p className="text-gray-600 mb-4">
            {getFeatureBlockReason(feature, context)}
          </p>
          {context?.kyc_status !== 'approved' && (
            <button className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
              Complete KYC Verification
            </button>
          )}
        </div>
      );
    }

    return null;
  }

  return <>{children}</>;
}

function getFeatureBlockReason(feature: string, context: any): string {
  if (!context) return 'Please sign in to access this feature.';

  if (context.kyc_status !== 'approved') {
    return 'This feature requires KYC verification. Please complete your identity verification to continue.';
  }

  if (context.account_status !== 'active') {
    return `Your account is currently ${context.account_status}. Please contact support for assistance.`;
  }

  return 'This feature is not available for your account.';
}
