import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';

interface AdminRouteProps {
  children: React.ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { loading, roleLoading, roleError, isAuthenticated, isAdmin, error, refreshAuth } = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !roleLoading && !roleError) {
      if (!isAuthenticated) {
        navigate('/signin', { replace: true });
      } else if (!isAdmin) {
        console.log('[AdminRoute] Non-admin user, redirecting to home');
        navigate('/', { replace: true });
      }
    }
  }, [loading, roleLoading, roleError, isAuthenticated, isAdmin, navigate]);

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-slate-400 font-medium">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (roleError && isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border border-slate-700">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-wifi-off-line text-3xl text-amber-500"></i>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Connection Issue</h2>
          <p className="text-slate-400 mb-6">We couldn't verify your admin access. Please check your connection and try again.</p>
          <button
            onClick={() => refreshAuth()}
            className="inline-block w-full bg-sky-600 hover:bg-sky-700 text-white px-6 py-3 rounded-xl font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            Retry Verification
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border border-slate-700">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-shield-cross-line text-3xl text-red-500"></i>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <a
            href="/signin"
            className="inline-block w-full bg-sky-600 hover:bg-sky-700 text-white px-6 py-3 rounded-xl font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            Back to Sign In
          </a>
        </div>
      </div>
    );
  }

  return isAdmin ? <>{children}</> : null;
}
