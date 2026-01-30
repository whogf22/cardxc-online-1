const API_BASE = '/api';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    });

    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: data.error || { message: 'An error occurred', code: 'UNKNOWN' },
      };
    }

    return data;
  } catch (error) {
    console.error('[API] Request failed:', error);
    return {
      success: false,
      error: { message: 'Network error. Please check your connection.', code: 'NETWORK_ERROR' },
    };
  }
}

export const authApi = {
  async signUp(data: { email: string; password: string; fullName: string; phone?: string }) {
    return request<{ user: any; token: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async signIn(data: { email: string; password: string; twoFactorToken?: string }) {
    return request<{ user: any; token: string; requiresTwoFactor?: boolean }>('/auth/signin', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async signOut() {
    try {
      return await request('/auth/logout', { method: 'POST' });
    } catch (err) {
      // Fallback to signout if logout fails
      return await request('/auth/signout', { method: 'POST' });
    }
  },

  async getSession(forceRefresh = false) {
    // Use cache if available and not expired
    const now = Date.now();
    if (!forceRefresh && cachedSession && (now - lastSessionFetch) < SESSION_CACHE_TTL) {
      return cachedSession;
    }

    // If there's already a pending request, return it (deduplication)
    if (pendingSessionRequest) {
      return pendingSessionRequest;
    }

    // Make the request and cache it
    pendingSessionRequest = request<{ user: any }>('/auth/session')
      .then((result) => {
        cachedSession = result;
        lastSessionFetch = now;
        pendingSessionRequest = null;
        return result;
      })
      .catch((error) => {
        pendingSessionRequest = null;
        // Clear cache on error
        if (error?.error?.code === 'UNAUTHORIZED' || error?.error?.code === 'SESSION_EXPIRED') {
          cachedSession = null;
          lastSessionFetch = 0;
        }
        throw error;
      });

    return pendingSessionRequest;
  },

  async getSessions() {
    return request<{ sessions: any[] }>('/auth/sessions');
  },

  async revokeSession(sessionId: string) {
    return request(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
  },

  async revokeAllSessions() {
    return request('/auth/sessions', { method: 'DELETE' });
  },

  async setup2FA() {
    return request<{ secret: string; qrCode: string }>('/auth/2fa/setup', { method: 'POST' });
  },

  async verify2FA(token: string) {
    return request('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  async disable2FA(password: string) {
    return request('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },
};

export const userApi = {
  async getProfile() {
    return request<{ user: any }>('/user/profile');
  },

  async updateProfile(data: { fullName?: string; phone?: string; country?: string }) {
    return request('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getWallets() {
    return request<{ wallets: any[] }>('/user/wallets');
  },

  async getTransactions(params?: { limit?: number; offset?: number; type?: string }) {
    const query = params ? new URLSearchParams(params as any).toString() : '';
    return request<{ transactions: any[] }>(`/user/transactions${query ? `?${query}` : ''}`);
  },

  async requestWithdrawal(data: {
    amount: number;
    currency: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  }) {
    return request<{ withdrawalId: string; status: string }>('/user/withdraw', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getWithdrawals() {
    return request<{ withdrawals: any[] }>('/user/withdrawals');
  },

  async getCards() {
    return request<{ cards: any[] }>('/user/cards');
  },

  async createCard(data: { cardName: string; cardType?: string; spendingLimit?: number }) {
    return request<{ card: any }>('/user/cards', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export const transactionApi = {
  async deposit(data: { amount: number; currency: string; idempotencyKey?: string }) {
    return request<{ transactionId: string; status: string }>('/transactions/deposit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async transfer(data: {
    recipientEmail: string;
    amount: number;
    currency: string;
    description?: string;
    idempotencyKey?: string;
  }) {
    return request<{ transactionId: string; status: string }>('/transactions/transfer', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getTransaction(transactionId: string) {
    return request<{ transaction: any }>(`/transactions/${transactionId}`);
  },
};

export const adminApi = {
  async getOverview() {
    return request<{
      users: { total: number; active: number; verified: number };
      transactions: { total: number; totalDeposits: number; totalWithdrawals: number };
      pendingWithdrawals: number;
      activeFraudFlags: number;
    }>('/admin/overview');
  },

  async getUsers(params?: { limit?: number; offset?: number; search?: string }) {
    const query = params ? new URLSearchParams(params as any).toString() : '';
    return request<{ users: any[] }>(`/admin/users${query ? `?${query}` : ''}`);
  },

  async getUser(userId: string) {
    return request<{ user: any; wallets: any[] }>(`/admin/users/${userId}`);
  },

  async updateUserStatus(userId: string, status: string, reason?: string) {
    return request(`/admin/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, reason }),
    });
  },

  async updateUserRole(userId: string, role: string) {
    return request(`/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  },

  async getUserBalances() {
    return request<{ balances: any[] }>('/admin/users');
  },

  async getPendingWithdrawals() {
    return request<{ withdrawals: any[] }>('/admin/withdrawals?status=pending');
  },

  async getWithdrawals(status?: string) {
    const query = status ? `?status=${status}` : '';
    return request<{ withdrawals: any[] }>(`/admin/withdrawals${query}`);
  },

  async approveWithdrawal(withdrawalId: string, notes?: string) {
    return request(`/admin/withdrawals/${withdrawalId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  async rejectWithdrawal(withdrawalId: string, reason: string) {
    return request(`/admin/withdrawals/${withdrawalId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async getLedger(limit = 100) {
    return request<{ entries: any[] }>(`/admin/audit-logs?limit=${limit}`);
  },

  async createAdjustment(data: {
    userId: string;
    type: 'credit' | 'debit';
    amount: number;
    currency: string;
    reason: string;
  }) {
    return request<{ adjustmentId: string; status: string }>('/admin/adjustments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getAdjustments(status?: string) {
    const query = status ? `?status=${status}` : '';
    return request<{ adjustments: any[] }>(`/admin/adjustments${query}`);
  },

  async approveAdjustment(adjustmentId: string) {
    return request(`/admin/adjustments/${adjustmentId}/approve`, { method: 'POST' });
  },

  async rejectAdjustment(adjustmentId: string, reason: string) {
    return request(`/admin/adjustments/${adjustmentId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async getAuditLogs(params?: {
    userId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    const query = params ? new URLSearchParams(params as any).toString() : '';
    return request<{ logs: any[] }>(`/admin/audit-logs${query ? `?${query}` : ''}`);
  },

  async exportAuditLogs(params?: { userId?: string; action?: string; startDate?: string; endDate?: string }) {
    const query = params ? new URLSearchParams(params as any).toString() : '';
    window.open(`${API_BASE}/admin/audit-logs/export${query ? `?${query}` : ''}`, '_blank');
  },

  async getFraudIndicators() {
    return request<{ flags: any[] }>('/admin/fraud-flags?status=active');
  },

  async getFraudFlags(params?: { userId?: string; status?: string; severity?: string }) {
    const query = params ? new URLSearchParams(params as any).toString() : '';
    return request<{ flags: any[] }>(`/admin/fraud-flags${query ? `?${query}` : ''}`);
  },

  async reviewFraudFlag(flagId: string, status: string, notes?: string) {
    return request(`/admin/fraud-flags/${flagId}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, notes }),
    });
  },

  async getWebhookEvents(_limit = 50) {
    return { success: true, data: { events: [] } };
  },
};

export const healthApi = {
  async check() {
    return request<{ status: string; database: any; memory: any }>('/health');
  },
};

export const customerApi = {
  async getBalance() {
    const result = await userApi.getWallets();
    if (result.success && result.data) {
      return result.data.wallets.map((w: any) => ({
        user_id: '',
        currency: w.currency,
        balance: w.balanceCents || w.balance * 100,
      }));
    }
    return [];
  },

  async getTransactions(limit = 50) {
    const result = await userApi.getTransactions({ limit });
    if (result.success && result.data) {
      return result.data.transactions.map((t: any) => ({
        id: t.id,
        user_id: '',
        entry_type: t.type === 'deposit' || t.type === 'transfer_in' ? 'credit' : 'debit',
        amount: t.amountCents || t.amount * 100,
        currency: t.currency,
        reference: t.reference || t.id,
        description: t.description,
        created_at: t.created_at,
      }));
    }
    return [];
  },

  async createDemoDeposit(amount: number, currency: string = 'USD') {
    const result = await transactionApi.deposit({ amount, currency });
    return { success: result.success, message: result.success ? 'Deposit successful' : 'Deposit failed' };
  },

  async requestWithdrawal(data: {
    amount: number;
    currency: string;
    bank_name: string;
    account_number: string;
    account_name: string;
  }) {
    return userApi.requestWithdrawal({
      amount: data.amount,
      currency: data.currency,
      bankName: data.bank_name,
      accountNumber: data.account_number,
      accountName: data.account_name,
    });
  },

  async getWithdrawalRequests() {
    const result = await userApi.getWithdrawals();
    if (result.success && result.data) {
      return result.data.withdrawals;
    }
    return [];
  },
};

export const aiApi = {
  async getConversations() {
    return request<{ conversations: any[] }>('/ai/conversations');
  },

  async createConversation(title?: string) {
    return request<{ conversation: any }>('/ai/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  },

  async getConversation(id: string) {
    return request<{ conversation: any; messages: any[] }>(`/ai/conversations/${id}`);
  },

  async deleteConversation(id: string) {
    return request(`/ai/conversations/${id}`, { method: 'DELETE' });
  },

  async streamMessage(conversationId: string, content: string): Promise<ReadableStreamDefaultReader<string>> {
    const response = await fetch(`/api/ai/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ content }),
    });
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    return {
      read: async () => {
        const result = await reader?.read();
        if (result?.done) return { done: true, value: '' };
        return { done: false, value: decoder.decode(result?.value) };
      },
    } as any;
  },
};

export const paymentsApi = {
  async p2pTransfer(data: { recipient: string; recipientType: 'email' | 'phone' | 'username'; amount: number; currency: string; note?: string }) {
    return request<{ transactionId: string; recipient: string }>('/payments/p2p/transfer', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async createPaymentLink(data: { amount?: number; currency: string; description?: string; expiresInHours?: number }) {
    return request<{ paymentLink: any; url: string }>('/payments/payment-links', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getPaymentLinks() {
    return request<{ paymentLinks: any[] }>('/payments/payment-links');
  },

  async generateQR(data: { amount?: number; currency: string }) {
    return request<{ qrIntent: any; qrData: string }>('/payments/qr/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getRecurringTransfers() {
    return request<{ recurringTransfers: any[] }>('/payments/recurring');
  },

  async createRecurringTransfer(data: { recipientEmail: string; amount: number; currency: string; frequency: string; description?: string }) {
    return request<{ recurringTransfer: any }>('/payments/recurring', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async cancelRecurringTransfer(id: string) {
    return request(`/payments/recurring/${id}`, { method: 'DELETE' });
  },

  async getSplitBills() {
    return request<{ createdSplits: any[]; participatingSplits: any[] }>('/payments/splits');
  },

  async createSplitBill(data: { title: string; totalAmount: number; currency: string; participants: { email: string; amount: number }[] }) {
    return request<{ splitId: string }>('/payments/split', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async paySplit(id: string) {
    return request(`/payments/splits/${id}/pay`, { method: 'POST' });
  },
};

export const checkoutApi = {
  async createCardCheckout(data: { amount: number; currency: string; merchantName: string; targetUserId?: string }) {
    return request<{ checkoutUrl: string }>('/checkout/card', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export const cardsApi = {
  async getCards() {
    return request<{ cards: any[] }>('/cards');
  },

  async createCard(data: { cardName: string; cardType?: string; spendingLimit?: number; isSingleUse?: boolean; currency?: string }) {
    return request<{ card: any }>('/cards', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async freezeCard(id: string) {
    return request(`/cards/${id}/freeze`, { method: 'POST' });
  },

  async unfreezeCard(id: string) {
    return request(`/cards/${id}/unfreeze`, { method: 'POST' });
  },

  async updateSpendingLimit(id: string, limit: number) {
    return request(`/cards/${id}/spending-limit`, {
      method: 'POST',
      body: JSON.stringify({ limit }),
    });
  },

  async blockMerchant(id: string, merchant: string) {
    return request(`/cards/${id}/block-merchant`, {
      method: 'POST',
      body: JSON.stringify({ merchant }),
    });
  },

  async unblockMerchant(id: string, merchant: string) {
    return request(`/cards/${id}/unblock-merchant`, {
      method: 'POST',
      body: JSON.stringify({ merchant }),
    });
  },

  async setCategoryLimit(id: string, data: { category: string; limit: number; period: string }) {
    return request(`/cards/${id}/category-limit`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getCardTransactions(id: string) {
    return request<{ transactions: any[] }>(`/cards/${id}/transactions`);
  },

  async topUpCard(id: string, data: { amount: number; currency: string }) {
    return request(`/cards/${id}/top-up`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async cancelCard(id: string) {
    return request(`/cards/${id}`, { method: 'DELETE' });
  },
};

export const savingsApi = {
  async getVaults() {
    return request<{ vaults: any[] }>('/savings/vaults');
  },

  async createVault(data: { name: string; targetAmount: number; currency: string; emoji?: string; color?: string }) {
    return request<{ vault: any }>('/savings/vaults', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async depositToVault(id: string, amount: number) {
    return request<{ vault: any }>(`/savings/vaults/${id}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  },

  async withdrawFromVault(id: string, amount: number) {
    return request<{ vault: any }>(`/savings/vaults/${id}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  },

  async deleteVault(id: string) {
    return request(`/savings/vaults/${id}`, { method: 'DELETE' });
  },

  async getRoundupRule() {
    return request<{ roundupRule: any }>('/savings/roundup');
  },

  async updateRoundupRule(data: { enabled: boolean; vaultId?: string; multiplier?: number }) {
    return request<{ roundupRule: any }>('/savings/roundup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getBudgets() {
    return request<{ budgets: any[] }>('/savings/budgets');
  },

  async createBudget(data: { category: string; limit: number; period: string; currency: string; alertThreshold?: number }) {
    return request<{ budget: any }>('/savings/budgets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateBudget(id: string, data: { limit?: number; alertThreshold?: number }) {
    return request<{ budget: any }>(`/savings/budgets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteBudget(id: string) {
    return request(`/savings/budgets/${id}`, { method: 'DELETE' });
  },

  async getAnalytics(period: string = 'month', currency: string = 'USD') {
    return request<{ spendingByCategory: any[]; dailySpending: any[]; summary: any }>(`/savings/analytics?period=${period}&currency=${currency}`);
  },

  async getAlerts() {
    return request<{ alerts: any[] }>('/savings/alerts');
  },

  async markAlertRead(id: string) {
    return request(`/savings/alerts/${id}/read`, { method: 'POST' });
  },
};

export const rewardsApi = {
  async getCashback() {
    return request<{ summary: any; recentRewards: any[] }>('/rewards/cashback');
  },

  async getReferralInfo() {
    return request<{ referralCode: any; referralLink: string; referrals: any[] }>('/rewards/referral');
  },

  async applyReferralCode(code: string) {
    return request('/rewards/referral/apply', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  async getSubscriptions() {
    return request<{ subscriptions: any[]; monthlyTotal: number }>('/rewards/subscriptions');
  },

  async addSubscription(data: { merchant: string; amount: number; currency: string; frequency: string; nextChargeDate: string }) {
    return request<{ subscription: any }>('/rewards/subscriptions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateSubscription(id: string, data: { amount?: number; frequency?: string; nextChargeDate?: string; status?: string }) {
    return request<{ subscription: any }>(`/rewards/subscriptions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteSubscription(id: string) {
    return request(`/rewards/subscriptions/${id}`, { method: 'DELETE' });
  },

  async detectSubscriptions() {
    return request<{ potentialSubscriptions: any[] }>('/rewards/subscriptions/detect');
  },
};

let cachedSession: any = null;
let lastSessionFetch = 0;
const SESSION_CACHE_TTL = 10000; // 10 seconds cache
let pendingSessionRequest: Promise<any> | null = null;

export function clearSessionCache(): void {
  cachedSession = null;
  lastSessionFetch = 0;
  pendingSessionRequest = null;
  console.log('[Auth] Session cache purged');
}
