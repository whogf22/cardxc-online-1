export interface VirtualCard {
  id: string;
  user_id: string;
  card_number_masked: string;
  last_four: string;
  expiry_month: number;
  expiry_year: number;
  card_brand: 'VISA' | 'MASTERCARD';
  status: 'ACTIVE' | 'FROZEN' | 'EXPIRED' | 'CANCELLED';
  card_type: 'VIRTUAL' | 'PHYSICAL';
  balance: number;
  currency: string;
  daily_limit: number;
  monthly_limit: number;
  per_transaction_limit: number;
  daily_spent: number;
  monthly_spent: number;
  provider_ref?: string;
  card_name?: string;
  created_at: string;
  updated_at: string;
  is_frozen?: boolean;
  /** True if card is backed by Fluz (can reveal details) */
  hasProviderCard?: boolean;
}

export interface CardTransaction {
  id: string;
  card_id: string;
  user_id: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
  currency: string;
  merchant_name?: string;
  merchant_category?: string;
  merchant_icon?: string;
  status: 'PENDING' | 'COMPLETED' | 'DECLINED' | 'REFUNDED';
  decline_reason?: string;
  reference?: string;
  description?: string;
  created_at: string;
  card_last_four?: string;
}

export interface CreateCardRequest {
  card_brand?: 'VISA' | 'MASTERCARD';
  card_name?: string;
  /** Spend limit (max amount card can be charged) - maps to Fluz spendLimit */
  spending_limit?: number;
  /** Daily limit - fallback when spending_limit not set */
  daily_limit?: number;
  monthly_limit?: number;
  per_transaction_limit?: number;
  /** Fluz offer ID from getVirtualCardOffers */
  offer_id?: string;
  /** DAILY | WEEKLY | MONTHLY | ANNUAL | LIFETIME */
  spend_limit_duration?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL' | 'LIFETIME';
  /** Lock card after first use */
  is_single_use?: boolean;
}

export interface UpdateLimitsRequest {
  daily_limit?: number;
  monthly_limit?: number;
  per_transaction_limit?: number;
}
