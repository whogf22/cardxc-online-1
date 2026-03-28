import { useEffect, useState, useCallback } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import type { UserContext } from '../types/userContext';

export function useUserContext() {
  const { user, loading: authLoading, isAuthenticated, refreshAuth } = useAuthContext();
  const [context, setContext] = useState<UserContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Derive context from AuthContext instead of making separate API call
  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!isAuthenticated || !user) {
      setContext(null);
      setLoading(false);
      return;
    }

    const kycStatus = (user.kyc_status || 'not_started').toLowerCase() as UserContext['kyc_status'];
    const accountStatus = (user.account_status || 'active').toLowerCase() as UserContext['account_status'];
    const userContext: UserContext = {
      user_id: user.id || '',
      email: user.email || '',
      full_name: user.full_name || user.fullName || null,
      phone: user.user_metadata?.phone || null,
      country: null,
      kyc_status: kycStatus,
      account_status: accountStatus,
      is_admin: user.role === 'SUPER_ADMIN' || false,
      balances: [],
      created_at: user.created_at || '',
      updated_at: ''
    };

    setContext(userContext);
    setLoading(false);
    setError(null);
  }, [user, authLoading, isAuthenticated]);

  const fetchUserContext = useCallback(async () => {
    await refreshAuth();
  }, [refreshAuth]);

  const hasFeature = useCallback((_featureName?: string): boolean => {
    if (!context) return false;
    if (context.account_status !== 'active') return false;
    if (context.kyc_status !== 'approved') return false;
    return true;
  }, [context]);

  return { context, loading, error, refetch: fetchUserContext, hasFeature };
}
