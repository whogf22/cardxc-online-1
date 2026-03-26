/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { authApi } from '../lib/api';
import { clearSessionCache } from '../lib/api';
import { clearGatewaySessionCache } from '../lib/gateway';
import { resetApiClient } from '../lib/apiClient';

export interface User {
  id: string;
  email: string;
  fullName?: string;
  full_name?: string;
  role?: string;
  kyc_status?: string;
  account_status?: string;
  profile_picture?: string;
  user_metadata?: {
    full_name?: string;
    phone?: string;
  };
  created_at?: string;
}

interface AuthState {
  user: User | null;
  role: 'customer' | 'admin' | null;
  loading: boolean;
  roleLoading: boolean;
  roleError: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  twoFactorEnabled?: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string, twoFactorToken?: string) => Promise<{ success: boolean; requiresTwoFactor?: boolean; error?: string }>;
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshAuth: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function clearAllSessionCaches(): void {
  clearSessionCache();
  clearGatewaySessionCache();
  console.log('[Auth] Session caches cleared');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    role: null,
    loading: true,
    roleLoading: false,
    roleError: false,
    error: null,
    isAuthenticated: false,
    isAdmin: false,
    twoFactorEnabled: false,
  });

  const checkAuth = useCallback(async () => {
    try {
      console.log('[Auth] Checking authentication');
      
      const result = await authApi.getSession();

      setAuthState(prev => {
        if (!result.success || !result.data?.user) {
          console.log('[Auth] No active session');
          return {
            ...prev,
            user: null,
            role: null,
            loading: false,
            isAuthenticated: false,
            isAdmin: false,
          };
        }

        const user = result.data.user;
        const role = user.role === 'SUPER_ADMIN' ? 'admin' : 'customer';
        const kycStatus = (user.kyc_status || 'not_started').toLowerCase();
        const accountStatus = (user.account_status || 'active').toLowerCase();
        return {
          ...prev,
          user: {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            full_name: user.full_name,
            role: user.role,
            kyc_status: kycStatus,
            account_status: accountStatus,
            user_metadata: { full_name: user.full_name, phone: user.phone },
          },
          role,
          loading: false,
          isAuthenticated: true,
          isAdmin: role === 'admin',
          twoFactorEnabled: user.two_factor_enabled,
        };
      });
    } catch (err) {
      console.warn('[Auth] Auth check error:', err instanceof Error ? err.message : err);
      setAuthState(prev => ({
        ...prev,
        loading: false,
      }));
    }
  }, []);

  const authCheckCompleted = useRef(false);
  const signingIn = useRef(false);
  
  useEffect(() => {
    let isMounted = true;
    let timeoutTimer: NodeJS.Timeout | null = null;
    authCheckCompleted.current = false;
    
    const runCheck = async () => {
      // Small delay to ensure cookies are settled
      await new Promise(resolve => setTimeout(resolve, 100));
      await checkAuth();
      authCheckCompleted.current = true;
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
    };
    
    runCheck();
    
    timeoutTimer = setTimeout(() => {
      if (isMounted && !authCheckCompleted.current) {
        console.warn('[Auth] Auth check timeout');
        setAuthState(prev => {
          if (prev.loading) {
            return { ...prev, loading: false };
          }
          return prev;
        });
      }
    }, 8000);

    return () => {
      isMounted = false;
      if (timeoutTimer) clearTimeout(timeoutTimer);
    };
  }, [checkAuth]);

  const signIn = useCallback(async (email: string, password: string, twoFactorToken?: string) => {
    if (signingIn.current) {
      return { success: false, error: 'Sign in already in progress' };
    }
    
    signingIn.current = true;
    try {
      console.log('[Auth] Signing in');
      
      const result = await authApi.signIn({ email, password, twoFactorToken });
      
      if (!result.success) {
        return { success: false, error: result.error?.message || 'Login failed' };
      }
      
      if (result.data?.requiresTwoFactor) {
        return { success: true, requiresTwoFactor: true };
      }
      
      const user = result.data?.user;
      if (user) {
          const role = user.role === 'SUPER_ADMIN' ? 'admin' : 'customer';
        const isAdmin = role === 'admin';
        
        resetApiClient();
        
        const kycStatus = (user.kyc_status || 'not_started').toLowerCase();
        const accountStatus = (user.account_status || 'active').toLowerCase();
        setAuthState({
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            full_name: user.fullName,
            role: user.role,
            kyc_status: kycStatus,
            account_status: accountStatus,
            user_metadata: { full_name: user.fullName },
          },
          role,
          loading: false,
          roleLoading: false,
          roleError: false,
          error: null,
          isAuthenticated: true,
          isAdmin,
        });
      }
      
      return { success: true };
    } catch (err) {
      console.error('[Auth] Sign in error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Login failed' };
    } finally {
      signingIn.current = false;
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string, phone?: string) => {
    try {
      console.log('[Auth] Signing up');
      
      const result = await authApi.signUp({ email, password, fullName, phone });
      
      if (!result.success) {
        return { success: false, error: result.error?.message || 'Signup failed' };
      }
      
      const user = result.data?.user;
      if (user) {
        resetApiClient();
        
        const kycStatus = (user.kyc_status || 'not_started').toLowerCase();
        const accountStatus = (user.account_status || 'active').toLowerCase();
        setAuthState({
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            full_name: user.fullName,
            role: user.role,
            kyc_status: kycStatus,
            account_status: accountStatus,
            user_metadata: { full_name: user.fullName },
          },
          role: 'customer',
          loading: false,
          roleLoading: false,
          roleError: false,
          error: null,
          isAuthenticated: true,
          isAdmin: false,
        });
      }
      
      return { success: true };
    } catch (err) {
      console.error('[Auth] Sign up error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Signup failed' };
    }
  }, []);

  const signOut = useCallback(async () => {
    console.log('[Auth] Signing out');
    clearAllSessionCaches();
    
    await authApi.signOut();
    
    setAuthState({
      user: null,
      role: null,
      loading: false,
      roleLoading: false,
      roleError: false,
      error: null,
      isAuthenticated: false,
      isAdmin: false,
    });
  }, []);

  const value: AuthContextValue = {
    ...authState,
    signIn,
    signUp,
    signOut,
    refreshAuth: checkAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
