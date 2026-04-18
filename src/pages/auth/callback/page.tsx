// Auth Callback Page - handles email confirmation and OAuth redirects

import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { getOrCreateProfile } from '../../../lib/profileHelpers';

// Map known error codes/messages to user-friendly strings. Raw SDK error
// payloads may contain internal details and must not be rendered verbatim.
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  otp_expired: 'Your confirmation link has expired. Please request a new one.',
  expired_token: 'Your session expired. Please sign in again.',
  invalid_token: 'This confirmation link is invalid or already used.',
  access_denied: 'Access denied.',
  session_check_failed: 'We could not verify your session. Please try signing in again.',
  unknown_error: 'Authentication failed. Please try again.',
};
const GENERIC_AUTH_ERROR = 'Authentication failed. Please try again.';

function friendlyAuthError(code: string | null | undefined): string {
  if (code && Object.prototype.hasOwnProperty.call(AUTH_ERROR_MESSAGES, code)) {
    return AUTH_ERROR_MESSAGES[code];
  }
  return GENERIC_AUTH_ERROR;
}

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const handleAuthCallback = useCallback(async () => {
    try {
      if (import.meta.env.DEV) console.log('[AuthCallback] Starting callback handling');

      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const queryParams = searchParams;

      const error = queryParams.get('error') || hashParams.get('error');
      const errorCode = queryParams.get('error_code') || hashParams.get('error_code');
      const errorDescription = queryParams.get('error_description') || hashParams.get('error_description');

      const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
      void (hashParams.get('type') || queryParams.get('type'));

      // SECURITY: Clear the fragment from the URL immediately after extracting
      // tokens and BEFORE any await. Hash fragments are visible to every
      // script on the page; once consumed, they must not linger.
      if (typeof window !== 'undefined' && window.location.hash) {
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search
        );
      }

      if (error || errorCode) {
        if (import.meta.env.DEV) console.error('[AuthCallback] Error detected:', error, errorCode, errorDescription);
        setStatus('error');
        const code = errorCode || error || 'unknown_error';
        setError(friendlyAuthError(code));
        setErrorCode(code);
        return;
      }

      if (accessToken && refreshToken) {
        console.log('[AuthCallback] Tokens found, setting session');
        
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          console.error('[AuthCallback] Session error:', sessionError);
          throw sessionError;
        }

        if (data.session) {
          console.log('[AuthCallback] Session confirmed successfully');
          
          const user = data.session.user;
          const fullName = user.user_metadata?.full_name || user.user_metadata?.name;
          
          try {
            const profile = await getOrCreateProfile(
              user.id,
              user.email!,
              fullName
            );
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            setStatus('success');
            
            if (profile?.role === 'SUPER_ADMIN') {
              console.log('[AuthCallback] Super Admin user, redirecting to admin dashboard');
              navigate('/admin-dashboard', { replace: true });
            } else {
              console.log('[AuthCallback] User, redirecting to dashboard');
              navigate('/dashboard', { replace: true });
            }
          } catch (profileError) {
            console.error('[AuthCallback] Profile error:', profileError);
            setStatus('success');
            navigate('/dashboard', { replace: true });
          }
        } else {
          throw new Error('Session not created after confirmation');
        }
      } else {
        console.log('[AuthCallback] No tokens in URL, checking existing session');
        
        const { data: { session }, error: sessionCheckError } = await supabase.auth.getSession();
        
        if (sessionCheckError) {
          console.error('[AuthCallback] Session check error:', sessionCheckError);
          setStatus('error');
          setError(friendlyAuthError('session_check_failed'));
          setErrorCode('session_check_failed');
          return;
        }
        
        if (session) {
          console.log('[AuthCallback] Valid session found');
          
          const user = session.user;
          const fullName = user.user_metadata?.full_name || user.user_metadata?.name;
          
          try {
            const profile = await getOrCreateProfile(
              user.id,
              user.email!,
              fullName
            );
            
            setStatus('success');
            
            if (profile?.role === 'SUPER_ADMIN') {
              console.log('[AuthCallback] Super Admin user, redirecting to admin dashboard');
              navigate('/admin-dashboard', { replace: true });
            } else {
              console.log('[AuthCallback] User, redirecting to dashboard');
              navigate('/dashboard', { replace: true });
            }
          } catch (profileError) {
            console.error('[AuthCallback] Profile error:', profileError);
            setStatus('success');
            navigate('/dashboard', { replace: true });
          }
        } else {
          console.warn('[AuthCallback] No tokens or session found');
          setStatus('error');
          setError(friendlyAuthError('invalid_token'));
          setErrorCode('invalid_token');
        }
      }
    } catch (err: unknown) {
      // Log the raw error for developers but never surface it to the user.
      console.error('[AuthCallback] Exception:', err);
      const code =
        (typeof err === 'object' && err !== null && 'code' in err && typeof (err as { code?: unknown }).code === 'string')
          ? (err as { code: string }).code
          : 'unknown_error';
      setStatus('error');
      setError(friendlyAuthError(code));
      setErrorCode(code);
    }
  }, [navigate, searchParams]);

  useEffect(() => {
    // NOTE: read hash BEFORE handleAuthCallback runs (handleAuthCallback will
    // itself clear the fragment via history.replaceState synchronously, right
    // after extracting tokens and before any await).
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const queryParams = new URLSearchParams(window.location.search);

    const urlError = queryParams.get('error') || hashParams.get('error');
    const urlErrorCode = queryParams.get('error_code') || hashParams.get('error_code');
    const urlErrorDescription = queryParams.get('error_description') || hashParams.get('error_description');

    if (urlError || urlErrorCode) {
      if (import.meta.env.DEV) {
        console.error('[AuthCallback] Error detected in URL:', urlError, urlErrorCode, urlErrorDescription);
      }
      // Strip the fragment before any further script runs, so an attacker
      // cannot read `error_description` or stray tokens via the hash.
      if (typeof window !== 'undefined' && window.location.hash) {
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search
        );
      }
      setStatus('error');
      const code = urlErrorCode || urlError || 'unknown_error';
      setError(friendlyAuthError(code));
      setErrorCode(code);
      return;
    }

    handleAuthCallback();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (import.meta.env.DEV) console.log('[AuthCallback] Auth state changed');


      if (event === 'SIGNED_IN' && session && status === 'loading') {
        try {
          const user = session.user;
          const fullName = user.user_metadata?.full_name;
          
          const profile = await getOrCreateProfile(
            user.id,
            user.email!,
            fullName
          );
          
          setStatus('success');
          
          if (profile?.role === 'SUPER_ADMIN') {
            navigate('/admin-dashboard', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        } catch (profileError) {
          console.error('[AuthCallback] Profile error in state change:', profileError);
          setStatus('success');
          navigate('/dashboard', { replace: true });
        }
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [handleAuthCallback, navigate, status]);

  const handleResendConfirmation = async () => {
    // SECURITY: PII such as the signup email should not be persisted in
    // localStorage (accessible to any XSS across sessions). Prefer
    // sessionStorage; the codebase has no client-side writer for these keys
    // today — legacy localStorage values are read once for back-compat and
    // then cleared so they do not persist.
    const legacyPending = localStorage.getItem('pending_signup_email');
    const legacySignup = localStorage.getItem('signup_email');
    if (legacyPending) localStorage.removeItem('pending_signup_email');
    if (legacySignup) localStorage.removeItem('signup_email');

    const email =
      searchParams.get('email') ||
      sessionStorage.getItem('pending_signup_email') ||
      sessionStorage.getItem('signup_email') ||
      legacyPending ||
      legacySignup;

    if (!email) {
      setError('Email address not found. Please try signing up again.');
      setTimeout(() => {
        navigate('/signup', { replace: true });
      }, 2000);
      return;
    }

    try {
      setError(null);
      
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (resendError) {
        // Log raw SDK error for devs; show a generic message to the user.
        console.error('[AuthCallback] Resend error:', resendError);
        setError('Failed to resend confirmation email. Please try again.');
        return;
      }

      setStatus('success');
      setError(null);

      setTimeout(() => {
        navigate('/signin', { replace: true, state: { message: 'Confirmation email sent! Please check your inbox.' } });
      }, 2000);
    } catch (err: unknown) {
      console.error('[AuthCallback] Resend exception:', err);
      setError('Failed to resend confirmation email. Please try again.');
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50 to-purple-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-semibold text-slate-900">Confirming your account...</p>
          <p className="text-sm text-slate-600 mt-2">Please wait</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50 to-purple-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-checkbox-circle-line text-green-600 text-3xl"></i>
          </div>
          <p className="text-lg font-semibold text-slate-900">Account confirmed!</p>
          <p className="text-sm text-slate-600 mt-2">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  const isExpired = errorCode === 'otp_expired' || errorCode === 'expired_token';
  const isInvalidToken = errorCode === 'invalid_token';
  const isAccessDenied = errorCode === 'access_denied';
  const canResend = isExpired || isInvalidToken || isAccessDenied;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50 to-purple-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-error-warning-line text-red-600 text-3xl"></i>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Confirmation Failed</h1>
          <p className="text-slate-600 mb-6">{error || 'An error occurred during account confirmation'}</p>

          {canResend && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start">
                <i className="ri-time-line text-amber-600 text-xl mr-3 mt-0.5"></i>
                <div>
                  <p className="text-sm font-semibold text-amber-900 mb-1">
                    {isExpired 
                      ? 'Link Expired'
                      : isInvalidToken
                      ? 'Invalid Link'
                      : 'Access Denied'}
                  </p>
                  <p className="text-sm text-amber-800">
                    {isExpired 
                      ? 'Your confirmation link has expired. Email confirmation links are valid for 24 hours. Please request a new confirmation email below.'
                      : isInvalidToken
                      ? 'This confirmation link is invalid or has already been used. Please request a new confirmation email or try signing in if you have already confirmed.'
                      : 'Your confirmation link may be invalid or already used. Please request a new confirmation email.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {canResend && (
              <button
                onClick={handleResendConfirmation}
                className="w-full px-6 py-3 bg-sky-600 text-white rounded-lg font-semibold hover:bg-sky-700 transition-colors"
              >
                <i className="ri-mail-send-line mr-2"></i>
                Resend Confirmation Email
              </button>
            )}
            
            <button
              onClick={() => navigate('/signin', { replace: true })}
              className="w-full px-6 py-3 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
            >
              Go to Sign In
            </button>

            <button
              onClick={() => navigate('/signup', { replace: true })}
              className="w-full px-6 py-3 text-slate-600 hover:text-slate-900 transition-colors text-sm"
            >
              Create New Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
