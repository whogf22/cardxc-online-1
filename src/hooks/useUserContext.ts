import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import type { UserContext } from '../types/userContext';

export function useUserContext() {
  const { user, loading: authLoading, isAuthenticated } = useAuthContext();
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

    const userContext: UserContext = {
      user_id: user.id || '',
      email: user.email || '',
      full_name: user.full_name || user.fullName || null,
      phone: user.user_metadata?.phone || null,
      country: null, // Will be fetched separately if needed
      kyc_status: 'pending', // Will be fetched separately if needed
      account_status: 'active', // Will be fetched separately if needed
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
    // This is now a no-op since we derive from AuthContext
    // Kept for backward compatibility
    setLoading(false);
  }, []);

  const hasFeature = useCallback((featureName: string): boolean => {
    if (!context) return false;
    if (context.account_status !== 'active') return false;
    if (context.kyc_status !== 'approved') return false;
    return true;
  }, [context]);

  return { context, loading, error, refetch: fetchUserContext, hasFeature };
}
