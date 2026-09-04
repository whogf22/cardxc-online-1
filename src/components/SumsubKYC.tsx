import { useState, useEffect, useCallback, useRef } from 'react';
import SumsubWebSdk from '@sumsub/websdk-react';
import type {
  PromisedTokenExpirationHandler,
  MessageHandler,
  ErrorHandler,
  SnsWebSdkBaseConfig,
  SnsWebSdkOptions,
} from '@sumsub/websdk/types';
import { userApi } from '../lib/api';
import { useToastContext } from '../contexts/ToastContext';

interface SumsubKYCProps {
  onComplete?: () => void;
  onClose?: () => void;
}

export function SumsubKYC({ onComplete, onClose }: SumsubKYCProps) {
  const toast = useToastContext();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchToken = useCallback(async (): Promise<string> => {
    const result = await userApi.getSumsubKycToken();
    if (!result.success || !result.data?.token) {
      throw new Error(result.error?.message || 'Unable to start identity verification.');
    }
    return result.data.token;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    setError(null);

    fetchToken()
      .then((token) => {
        if (mountedRef.current) {
          setAccessToken(token);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Verification could not be started.';
        if (mountedRef.current) {
          setError(message);
          setLoading(false);
          toast.error(message);
        }
      });

    return () => {
      mountedRef.current = false;
    };
  }, [fetchToken, toast]);

  const expirationHandler = useCallback<PromisedTokenExpirationHandler>(async () => {
    return fetchToken();
  }, [fetchToken]);

  const onMessage = useCallback<MessageHandler>((messageType, payload) => {
    if (
      messageType === 'idCheck.onApplicantSubmitted' ||
      messageType === 'idCheck.onApplicantVerificationCompleted' ||
      messageType === 'idCheck.applicantReviewComplete'
    ) {
      onComplete?.();
    }

    if (import.meta.env.DEV) {
      console.debug('[SumsubKYC]', messageType, payload);
    }
  }, [onComplete]);

  const onError = useCallback<ErrorHandler>((err) => {
    const message = err.error || err.reason || 'Verification encountered an error.';
    setError(message);
    toast.error(message);
  }, [toast]);

  const config: SnsWebSdkBaseConfig = { lang: 'en', theme: 'dark' };
  const options: SnsWebSdkOptions = {
    addViewportTag: false,
    adaptIframeHeight: true,
    enableScrollIntoView: true,
  };

  if (loading) {
    return (
      <div className="bg-[#1a1a2e] rounded-2xl p-8 text-center border border-white/10 min-h-[400px] flex items-center justify-center">
        <div className="inline-flex items-center gap-2 text-gray-400">
          <i className="ri-loader-4-line animate-spin text-lg"></i>
          <span className="text-sm">Preparing secure verification...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#1a1a2e] rounded-2xl p-8 text-center border border-red-500/30 min-h-[400px] flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="ri-error-warning-line text-red-400 text-3xl"></i>
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Verification Unavailable</h3>
        <p className="text-sm text-gray-400 mb-6">{error}</p>
        <div className="flex gap-3">
          <button
            onClick={() => { setError(null); setLoading(true); fetchToken(); }}
            className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-all"
          >
            Try Again
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-5 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium border border-white/10 transition-all"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="bg-[#1a1a2e] rounded-2xl p-8 text-center border border-white/10 min-h-[400px] flex items-center justify-center">
        <p className="text-sm text-gray-400">Unable to initialize verification.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a2e] rounded-2xl overflow-hidden border border-white/10" style={{ minHeight: '480px' }}>
      {onClose && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
          <div>
            <h2 className="text-base font-bold text-white">Identity Verification</h2>
            <p className="text-xs text-gray-400">Your documents are processed securely by our verification partner.</p>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          >
            <i className="ri-close-line text-gray-400 text-xl"></i>
          </button>
        </div>
      )}
      <div className="p-4" style={{ minHeight: '420px' }}>
        <SumsubWebSdk
          accessToken={accessToken}
          expirationHandler={expirationHandler}
          config={config}
          options={options}
          onMessage={onMessage}
          onError={onError}
        />
      </div>
    </div>
  );
}
