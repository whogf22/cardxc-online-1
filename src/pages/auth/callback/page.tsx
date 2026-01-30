// Auth Callback Page - handles email confirmation and OAuth redirects

import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { getOrCreateProfile } from '../../../lib/profileHelpers';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const handleAuthCallback = useCallback(async () => {
    try {
      console.log('[AuthCallback] Starting callback handling');
      console.log('[AuthCallback] URL verified');
      
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const queryParams = searchParams;
      
      const error = queryParams.get('error') || hashParams.get('error');
      const errorCode = queryParams.get('error_code') || hashParams.get('error_code');
      const errorDescription = queryParams.get('error_description') || hashParams.get('error_description');
      
      const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
      const type = hashParams.get('type') || queryParams.get('type');

      console.log('[AuthCallback] Error check performed');
      console.log('[AuthCallback] Token status checked');

      if (error || errorCode) {
        console.error('[AuthCallback] Error detected:', error, errorCode, errorDescription);
        setStatus('error');
        setError(errorDescription || error || 'Authentication failed');
        setErrorCode(errorCode || error || 'unknown_error');
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
          setError(`Session check failed: ${sessionCheckError.message}`);
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
          setError('Invalid or expired confirmation link. Please try signing in again.');
          setErrorCode('invalid_token');
        }
      }
    } catch (err: any) {
      console.error('[AuthCallback] Exception:', err);
      setStatus('error');
      setError(err.message || 'Authentication failed');
      setErrorCode(err.code || 'unknown_error');
    }
  }, [navigate, searchParams]);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const queryParams = new URLSearchParams(window.location.search);
    
    const urlError = queryParams.get('error') || hashParams.get('error');
    const urlErrorCode = queryParams.get('error_code') || hashParams.get('error_code');
    const urlErrorDescription = queryParams.get('error_description') || hashParams.get('error_description');
    
    if (urlError || urlErrorCode) {
      console.error('[AuthCallback] Error detected in URL:', urlError, urlErrorCode, urlErrorDescription);
      setStatus('error');
      setError(urlErrorDescription || urlError || 'Authentication failed');
      setErrorCode(urlErrorCode || urlError || 'unknown_error');
      return;
    }
    
    handleAuthCallback();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthCallback] Auth state changed');
      
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
    const email = 
      searchParams.get('email') || 
      localStorage.getItem('pending_signup_email') ||
      localStorage.getItem('signup_email');
    
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
        setError(`Failed to resend email: ${resendError.message}`);
        return;
      }

      setStatus('success');
      setError(null);
      
      setTimeout(() => {
        navigate('/signin', { replace: true, state: { message: 'Confirmation email sent! Please check your inbox.' } });
      }, 2000);
    } catch (err: any) {
      setError(`Failed to resend email: ${err.message || 'Unknown error'}`);
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
