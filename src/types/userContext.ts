// User Context Types
export type KYCStatus = 'not_started' | 'pending' | 'approved' | 'rejected' | 'expired';
export type VerificationLevel = 'basic' | 'intermediate' | 'advanced';
export type AccountState = 'active' | 'limited' | 'suspended' | 'closed';

export interface UserKYC {
  id: string;
  user_id: string;
  status: KYCStatus;
  verification_level?: VerificationLevel;
  submitted_at?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  rejection_reason?: string;
  documents: Array<{
    type: string;
    url: string;
    uploaded_at: string;
  }>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserAccountState {
  id: string;
  user_id: string;
  state: AccountState;
  reason?: string;
  limitations: string[];
  suspended_at?: string;
  suspended_by?: string;
  expires_at?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FeatureFlag {
  id: string;
  flag_name: string;
  description?: string;
  default_enabled: boolean;
  requires_kyc: boolean;
  requires_account_state: AccountState[];
  created_at: string;
  updated_at: string;
}

export interface UserFeatureFlag {
  id: string;
  user_id: string;
  flag_name: string;
  enabled: boolean;
  granted_by?: string;
  granted_at: string;
  expires_at?: string;
  reason?: string;
  created_at: string;
}

// Main UserContext interface - aligned with actual database schema
export interface UserContext {
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  country: string | null;
  kyc_status: KYCStatus;
  account_status: AccountState;
  is_admin: boolean;
  balances: Array<{
    currency: string;
    balance: number;
    reserved_balance: number;
    available_balance: number;
  }>;
  created_at: string;
  updated_at: string;
}

export interface UserContextHookReturn {
  context: UserContext | null;
  loading: boolean;
  error: Error | null;
  hasFeature: (featureName: string) => boolean;
  isKYCApproved: boolean;
  isAccountActive: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  refresh: () => Promise<void>;
}
