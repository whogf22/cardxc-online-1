// Authentication hook - wrapper around AuthContext for backward compatibility

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';

interface UseAuthOptions {
  requireAuth?: boolean;
  requireAdmin?: boolean;
  redirectTo?: string;
}

export function useAuth(options: UseAuthOptions = {}) {
  const {
    requireAuth = false,
    requireAdmin = false,
    redirectTo = '/signin',
  } = options;

  const navigate = useNavigate();
  const authContext = useAuthContext();

  const isLoading = authContext.loading || (requireAdmin && authContext.roleLoading);

  useEffect(() => {
    if (isLoading) return;

    if (requireAuth && !authContext.isAuthenticated) {
      console.log('[Auth] Redirecting to login');
      navigate(redirectTo, { replace: true });
      return;
    }

    if (requireAdmin && !authContext.isAdmin) {
      console.log('[Auth] Admin access denied');
      navigate('/', { replace: true });
      return;
    }
  }, [isLoading, authContext.isAuthenticated, authContext.isAdmin, requireAuth, requireAdmin, redirectTo, navigate]);

  return {
    user: authContext.user,
    role: authContext.role,
    loading: isLoading,
    error: authContext.error,
    isAuthenticated: authContext.isAuthenticated,
    isAdmin: authContext.isAdmin,
    signOut: authContext.signOut,
    refreshAuth: authContext.refreshAuth,
  };
}
