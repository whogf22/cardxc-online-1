// API Gateway client - uses real backend API
import { authApi } from './api';
import { apiClient } from './apiClient';

// Removed redundant session check - getSession now has built-in caching and deduplication
async function ensureAuthenticated(): Promise<void> {
  const result = await authApi.getSession();
  
  if (!result.success || !result.data?.user) {
    throw new Error('Not authenticated');
  }
}

export function clearGatewaySessionCache(): void {
  // Cache is now handled in api.ts
  console.log('[Gateway] Cache cleared');
}

export const gateway = {
  async createDeposit(amount: number, currency: string) {
    await ensureAuthenticated();
    return apiClient.post('/transactions/deposit', { amount, currency });
  },

  async createWithdrawal(params: {
    amount: number;
    currency: string;
    bank_name: string;
    account_number: string;
    account_name: string;
  }) {
    await ensureAuthenticated();
    return apiClient.post('/user/withdraw', {
      amount: params.amount,
      currency: params.currency,
      bankName: params.bank_name,
      accountNumber: params.account_number,
      accountName: params.account_name,
    });
  },

  async getWallets() {
    await ensureAuthenticated();
    return apiClient.get('/user/wallets');
  },

  async getTransactions() {
    await ensureAuthenticated();
    return apiClient.get('/user/transactions');
  },

  async getWithdrawals() {
    await ensureAuthenticated();
    return apiClient.get('/user/withdrawals');
  },

  async getProfile() {
    const result = await authApi.getSession();
    if (!result.success || !result.data?.user) {
      throw new Error('Not authenticated');
    }
    const user = result.data.user;
    return { 
      id: user.id,
      email: user.email,
      full_name: user.full_name || '',
      phone: user.phone || '',
    };
  },

  async updateProfile(params: {
    full_name?: string;
    phone?: string;
  }) {
    await ensureAuthenticated();
    return apiClient.put('/user/profile', {
      fullName: params.full_name,
      phone: params.phone,
    });
  },

  async getCards() {
    await ensureAuthenticated();
    return apiClient.get('/user/cards');
  },

  async createCard(params: { cardName: string; cardType?: string; spendingLimit?: number }) {
    await ensureAuthenticated();
    return apiClient.post('/user/cards', params);
  },

  async adminGetOverview() {
    await ensureAuthenticated();
    return apiClient.get('/admin/overview');
  },

  async adminGetUsers(params?: { role?: string; search?: string }) {
    await ensureAuthenticated();
    const queryParts = [];
    if (params?.role) queryParts.push(`role=${params.role}`);
    if (params?.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);
    const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    return apiClient.get(`/admin/users${query}`);
  },

  async adminGetAllWithdrawals() {
    await ensureAuthenticated();
    return apiClient.get('/admin/withdrawals');
  },

  async approveWithdrawal(withdrawal_id: string, admin_notes?: string) {
    await ensureAuthenticated();
    return apiClient.post(`/admin/withdrawals/${withdrawal_id}/approve`, { admin_notes });
  },

  async rejectWithdrawal(withdrawal_id: string, admin_notes?: string) {
    await ensureAuthenticated();
    return apiClient.post(`/admin/withdrawals/${withdrawal_id}/reject`, { admin_notes });
  },

  async adminGetAuditLogs(params?: { limit?: number; offset?: number }) {
    await ensureAuthenticated();
    const queryParts = [];
    if (params?.limit) queryParts.push(`limit=${params.limit}`);
    if (params?.offset) queryParts.push(`offset=${params.offset}`);
    const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    return apiClient.get(`/admin/audit-logs${query}`);
  },

  async adminGetFraudFlags() {
    await ensureAuthenticated();
    return apiClient.get('/admin/fraud-flags');
  },
};
