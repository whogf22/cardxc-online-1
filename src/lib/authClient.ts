// Authentication client layer - provides compatibility interface
// This file provides a standardized auth interface for components

import { authApi } from './api';

export interface User {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    phone?: string;
  };
  created_at?: string;
}

export interface Session {
  user: User;
  access_token: string;
  expires_at: number;
}

export const authClient = {
  auth: {
    getSession: async () => {
      try {
        const result = await authApi.getSession();
        if (!result.success || !result.data?.user) {
          return { data: { session: null }, error: null };
        }
        const user = result.data.user;
        return {
          data: {
            session: {
              user: {
                id: user.id,
                email: user.email,
                user_metadata: { full_name: user.full_name, phone: user.phone },
                created_at: user.created_at,
              },
              access_token: 'jwt-token',
              expires_at: Math.floor(Date.now() / 1000) + 3600,
            },
          },
          error: null,
        };
      } catch (error) {
        return { data: { session: null }, error };
      }
    },
    getUser: async () => {
      try {
        const result = await authApi.getSession();
        if (!result.success || !result.data?.user) {
          return { data: { user: null }, error: null };
        }
        const user = result.data.user;
        return {
          data: {
            user: {
              id: user.id,
              email: user.email,
              user_metadata: { full_name: user.full_name, phone: user.phone },
              created_at: user.created_at,
            },
          },
          error: null,
        };
      } catch (error) {
        return { data: { user: null }, error };
      }
    },
    signUp: async (_params: { email: string; password: string; options?: any }) => {
      return { data: null, error: { message: 'Use authApi.signUp instead' } };
    },
    signInWithPassword: async (_params: { email: string; password: string }) => {
      return { data: null, error: { message: 'Use authApi.signIn instead' } };
    },
    signOut: async () => {
      await authApi.signOut();
      return { error: null };
    },
    signInWithOAuth: async (_params: { provider: string; options?: { redirectTo?: string } }) => {
      return { data: null, error: { message: 'OAuth not supported' } };
    },
    resetPasswordForEmail: async (_email: string, _options?: { redirectTo?: string }) => {
      return { data: {}, error: null };
    },
    updateUser: async (_params: { password?: string }) => {
      return { data: {}, error: null };
    },
    refreshSession: async () => {
      const result = await authClient.auth.getSession();
      return { data: result.data, error: null };
    },
    onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
      setTimeout(async () => {
        const result = await authClient.auth.getSession();
        callback('INITIAL_SESSION', result.data.session);
      }, 100);
      return {
        data: {
          subscription: {
            unsubscribe: () => {},
          },
        },
      };
    },
    resend: async (_params: { type: string; email: string; options?: { emailRedirectTo?: string } }) => {
      return { data: {}, error: null };
    },
    setSession: async (_params: { access_token: string; refresh_token: string }) => {
      const sessionResult = await authClient.auth.getSession();
      return { data: sessionResult.data, error: null };
    },
  },
  from: (_table: string) => {
    console.warn('[Auth] Direct database queries not supported. Use API endpoints.');
    return createEmptyQueryBuilder();
  },
  storage: {
    from: (_bucket: string) => ({
      upload: async (_path: string, _file: File) => {
        return { data: null, error: { message: 'Use API for file uploads' } };
      },
      getPublicUrl: (_path: string) => {
        return { data: { publicUrl: '' } };
      },
    }),
  },
  functions: {
    invoke: async (_functionName: string, _options?: { method?: string; body?: any }) => {
      return { data: null, error: null };
    },
  },
  realtime: {
    setAuth: (_token: string | null) => {},
    channels: [] as any[],
  },
  channel: (_name: string) => ({
    on: (_event: string, _config: any, _callback?: any) => ({ 
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
      subscribe: () => ({ unsubscribe: () => {} }) 
    }),
    subscribe: () => ({ unsubscribe: () => {} }),
  }),
  removeChannel: (_channel: any) => {},
};

// Backward compatibility export
export const supabase = authClient;

function createEmptyQueryBuilder() {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    neq: () => builder,
    order: () => builder,
    limit: () => builder,
    single: () => builder,
    maybeSingle: () => builder,
    insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'Use API' } }) }) }),
    update: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'Use API' } }) }),
    then: (resolve: (result: { data: any; error: any }) => void) => {
      resolve({ data: null, error: { message: 'Direct database queries not supported. Use API endpoints.' } });
    },
  };
  return builder;
}

export const authHelpers = {
  signUp: async (_email: string, _password: string, _fullName: string, _phone: string) => {
    return { data: null, error: { message: 'Use authApi.signUp' } };
  },
  signIn: async (_email: string, _password: string) => {
    return { data: null, error: { message: 'Use authApi.signIn' } };
  },
  signOut: async () => {
    await authApi.signOut();
    return { error: null };
  },
  getSession: async () => {
    const result = await authClient.auth.getSession();
    return { session: result.data.session, error: result.error };
  },
  getUser: async () => {
    const result = await authClient.auth.getUser();
    return { user: result.data.user, error: result.error };
  },
};
