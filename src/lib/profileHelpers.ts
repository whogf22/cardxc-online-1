// Profile helper functions - uses real backend API
import { authApi } from './api';
import type { Profile } from '../types/database';

export async function getOrCreateProfile(
  userId: string,
  userEmail: string,
  fullName?: string
): Promise<Profile | null> {
  try {
    const result = await authApi.getSession();
    
    if (result.success && result.data?.user) {
      const user = result.data.user;
      console.log('[Profile] Profile found:', user.id);
      
      return {
        id: user.id,
        email: user.email,
        full_name: user.full_name || fullName || userEmail.split('@')[0],
        phone: user.phone || null,
        country: user.country || null,
        role: user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'USER',
        status: (user.account_status as 'active' | 'suspended' | 'blocked') || 'active',
        kyc_verified: user.kyc_status === 'approved',
        kyc_status: (user.kyc_status as 'pending' | 'approved' | 'rejected' | 'verified' | 'not_started') || 'pending',
        is_admin: user.role === 'SUPER_ADMIN',
        created_at: user.created_at,
        updated_at: user.updated_at || user.created_at,
        account_status: (user.account_status as 'active' | 'limited' | 'suspended' | 'closed' | 'frozen') || 'active',
      } as Profile;
    }

    console.log('[Profile] No active session, returning null');
    return null;
  } catch (error) {
    console.error('[Profile] getOrCreateProfile error:', error);
    throw error;
  }
}

export async function ensureProfileExists(
  userId: string,
  userEmail: string,
  fullName?: string
): Promise<Profile> {
  const profile = await getOrCreateProfile(userId, userEmail, fullName);
  
  if (!profile) {
    throw new Error('Failed to get or create profile');
  }
  
  return profile;
}
