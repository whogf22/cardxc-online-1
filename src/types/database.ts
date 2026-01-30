// Database types for CardXC platform

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  country: string | null;
  role: 'USER' | 'SUPER_ADMIN';
  status: 'active' | 'suspended' | 'blocked';
  kyc_status: 'pending' | 'approved' | 'rejected' | 'expired' | 'verified' | 'not_started';
  account_status: 'active' | 'limited' | 'suspended' | 'closed' | 'frozen';
  is_admin: boolean;
  kyc_verified: boolean;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export interface LedgerEntry {
  id: string;
  user_id: string;
  entry_type: 'credit' | 'debit';
  amount: number;
  currency: string;
  provider?: string;
  reference: string;
  description?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  profiles?: Profile;
}

export interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  profiles?: Profile;
}

export interface WalletBalance {
  user_id: string;
  currency: string;
  balance: number;
}

export interface WebhookEvent {
  id: string;
  provider: string;
  event_type: string;
  reference: string;
  payload: Record<string, unknown>;
  processed: boolean;
  processed_at?: string;
  created_at: string;
}

export interface CurrencyRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  updated_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
  profiles?: Profile;
}

export interface VirtualCard {
  id: string;
  user_id: string;
  card_number: string;
  card_name: string;
  card_brand: 'VISA' | 'MASTERCARD';
  balance: number;
  spending_limit: number;
  status: 'active' | 'frozen' | 'deleted';
  expiry_month: number;
  expiry_year: number;
  cvv: string;
  created_at: string;
  updated_at: string;
}

export interface AdminOverview {
  total_customers: number;
  new_customers_30d: number;
  total_deposits: number;
  total_withdrawals: number;
  pending_withdrawals: number;
  unprocessed_webhooks: number;
}

export interface Database {
  public: {
    Tables: {
      profiles: { 
        Row: Profile; 
        Insert: Partial<Profile> & { id: string; email: string }; 
        Update: Partial<Profile>; 
      };
      ledger_entries: { 
        Row: LedgerEntry; 
        Insert: Omit<LedgerEntry, 'id' | 'created_at'>; 
        Update: Partial<LedgerEntry>; 
      };
      withdrawal_requests: { 
        Row: WithdrawalRequest; 
        Insert: Omit<WithdrawalRequest, 'id' | 'created_at' | 'profiles'>; 
        Update: Partial<WithdrawalRequest>; 
      };
      wallet_balances: { 
        Row: WalletBalance; 
        Insert: WalletBalance; 
        Update: Partial<WalletBalance>; 
      };
      payment_settings: { 
        Row: Record<string, unknown>; 
        Insert: Record<string, unknown>; 
        Update: Record<string, unknown>; 
      };
      webhook_events: { 
        Row: WebhookEvent; 
        Insert: Omit<WebhookEvent, 'id' | 'created_at'>; 
        Update: Partial<WebhookEvent>; 
      };
      currency_rates: { 
        Row: CurrencyRate; 
        Insert: Omit<CurrencyRate, 'id'>; 
        Update: Partial<CurrencyRate>; 
      };
      support_tickets: {
        Row: SupportTicket;
        Insert: Omit<SupportTicket, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<SupportTicket>;
      };
      virtual_cards: {
        Row: VirtualCard;
        Insert: Omit<VirtualCard, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<VirtualCard>;
      };
    };
    Functions: {
      create_virtual_card: {
        Args: { p_card_brand: 'VISA' | 'MASTERCARD'; p_card_name: string; p_initial_balance: number };
        Returns: VirtualCard;
      };
      freeze_card: {
        Args: { p_card_id: string };
        Returns: VirtualCard;
      };
      unfreeze_card: {
        Args: { p_card_id: string };
        Returns: VirtualCard;
      };
      delete_card: {
        Args: { p_card_id: string };
        Returns: { success: boolean };
      };
      top_up_card: {
        Args: { p_card_id: string; p_amount: number };
        Returns: VirtualCard;
      };
      set_spending_limit: {
        Args: { p_card_id: string; p_limit: number };
        Returns: VirtualCard;
      };
    };
  };
}

export interface FraudIndicator {
  user_id: string;
  email: string;
  full_name?: string;
  balance: number;
  currency: string;
  txn_last_hour: number;
  negative_balance: boolean;
  high_velocity: boolean;
}
