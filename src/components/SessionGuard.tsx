import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useLocation } from 'react-router-dom';

interface SessionGuardProps {
  children: React.ReactNode;
}

// Public pages that don't require authentication
const PUBLIC_PAGES = [
  '/signin',
  '/signup',
  '/login',
  '/',
  '/home',
  '/terms',
  '/privacy',
  '/admin-login'
];

export function SessionGuard({ children }: SessionGuardProps) {
  const [showExpirationWarning, setShowExpirationWarning] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const location = useLocation();

  const isPublicPage = PUBLIC_PAGES.includes(location.pathname);

  useEffect(() => {
    if (isPublicPage) {
      return;
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setSessionExpired(true);
        setShowExpirationWarning(false);
      } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        setSessionExpired(false);
        setShowExpirationWarning(false);
      }
    });

    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error && error.message && !error.message.includes('refresh')) {
          console.warn('[SessionGuard] Session error:', error);
          return;
        }

        if (!session) {
          return;
        }

        const expiresAt = session.expires_at;
        if (expiresAt) {
          const expiresIn = expiresAt * 1000 - Date.now();
          if (expiresIn < 5 * 60 * 1000 && expiresIn > 0) {
            setShowExpirationWarning(true);
          } else {
            setShowExpirationWarning(false);
          }
        }
      } catch (err) {
        console.warn('[SessionGuard] Session check error:', err);
      }
    };

    // Reduced frequency - check every 5 minutes instead of 2 minutes
    // Initial check after 30 seconds to avoid immediate duplicate calls
    const interval = setInterval(checkSession, 300000); // 5 minutes
    setTimeout(checkSession, 30000); // 30 seconds initial delay

    return () => {
      authListener.subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [isPublicPage]);

  const handleRefreshSession = async () => {
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('[SessionGuard] Session refresh failed:', error);
      setSessionExpired(true);
    } else {
      setShowExpirationWarning(false);
    }
  };

  if (sessionExpired && !isPublicPage) {
    return null;
  }

  if (showExpirationWarning && !isPublicPage) {
    return (
      <>
        {children}
        <div className="fixed bottom-4 right-4 bg-white rounded-xl shadow-2xl border border-amber-200 p-4 max-w-sm z-40">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="ri-alarm-warning-line text-xl text-amber-600"></i>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 mb-1">
                Session Expiring Soon
              </h3>
              <p className="text-sm text-slate-600 mb-3">
                Your session will expire in a few minutes. Refresh to stay signed in.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleRefreshSession}
                  className="flex-1 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors whitespace-nowrap"
                >
                  Refresh Session
                </button>
                <button
                  onClick={() => setShowExpirationWarning(false)}
                  className="px-4 py-2 text-slate-600 text-sm hover:text-slate-900 transition-colors whitespace-nowrap"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return <>{children}</>;
}
