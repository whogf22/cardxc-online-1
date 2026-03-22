// Card service - uses real backend API
import { apiClient } from './apiClient';
import type { VirtualCard, CardTransaction, CreateCardRequest, UpdateLimitsRequest } from '../types/card';

export const cardService = {
  async getCards(): Promise<VirtualCard[]> {
    try {
      // Switched from /user/cards to /cards to use the dedicated cardsRouter
      const response = await apiClient.get('/cards');
      if (response.success && response.data?.cards) {
        return response.data.cards.map((card: any) => ({
          id: card.id,
          user_id: card.user_id,
          card_name: card.card_name,
          card_number_masked: `**** **** **** ${card.last_four}`,
          last_four: card.last_four,
          card_type: 'VIRTUAL',
          card_brand: card.card_type || 'VISA',
          status: (card.status || 'ACTIVE').toUpperCase(),
          balance: card.balance_cents ? card.balance_cents / 100 : (card.balance || 0),
          currency: card.currency || 'USD',
          daily_limit: card.spending_limit_cents ? card.spending_limit_cents / 100 : 5000,
          monthly_limit: 25000,
          per_transaction_limit: 2500,
          daily_spent: 0,
          monthly_spent: 0,
          expiry_month: new Date().getMonth() + 1,
          expiry_year: new Date().getFullYear() + 3,
          created_at: card.created_at,
          updated_at: card.updated_at || card.created_at,
          is_frozen: card.frozen || card.status === 'frozen',
          hasProviderCard: card.hasProviderCard ?? !!card.fluz_card_id,
        }));
      }
      return [];
    } catch (error: any) {
      console.error('[CardService] Failed to get cards:', error);
      throw new Error(error?.message || 'Could not load cards. Please try again.');
    }
  },

  async getCard(cardId: string): Promise<VirtualCard | null> {
    const cards = await this.getCards();
    return cards.find(c => c.id === cardId) || null;
  },

  async revealCard(cardId: string): Promise<{
    cardNumber: string;
    expiryMMYY: string;
    cvv: string;
    cardHolderName: string;
    billingAddress?: Record<string, string>;
  }> {
    const response = await apiClient.get(`/cards/${cardId}/reveal`);
    if (!response.success || !response.data) {
      throw new Error((response as any).error?.message || 'Failed to reveal card');
    }
    return response.data as any;
  },

  async createCard(request: CreateCardRequest = {}): Promise<VirtualCard> {
    const spendLimit = request.spending_limit ?? request.daily_limit ?? 100;
    const response = await apiClient.post('/cards', {
      cardName: request.card_name || 'My Card',
      cardType: request.card_brand || 'VISA',
      spendingLimit: spendLimit,
      spendLimitDuration: request.spend_limit_duration || (request.is_single_use ? 'LIFETIME' : 'MONTHLY'),
      isSingleUse: request.is_single_use ?? false,
      offerId: request.offer_id || undefined,
    });

    if (!response.success || !response.data?.card) {
      throw new Error((response as any).error?.message || 'Failed to create card');
    }

    const card = response.data.card;
    return {
      id: card.id,
      user_id: card.user_id,
      card_name: card.card_name,
      card_number_masked: `**** **** **** ${card.last_four}`,
      last_four: card.last_four,
      card_type: 'VIRTUAL',
      card_brand: card.card_type || 'VISA',
      status: (card.status || 'ACTIVE').toUpperCase(),
      balance: card.balance_cents ? card.balance_cents / 100 : (card.balance || 0),
      currency: card.currency || 'USD',
      daily_limit: card.spending_limit_cents ? card.spending_limit_cents / 100 : 5000,
      monthly_limit: 25000,
      per_transaction_limit: 2500,
      daily_spent: 0,
      monthly_spent: 0,
      expiry_month: new Date().getMonth() + 1,
      expiry_year: new Date().getFullYear() + 3,
      created_at: card.created_at,
      updated_at: card.created_at,
    };
  },

  async deleteCard(cardId: string): Promise<void> {
    await apiClient.delete(`/cards/${cardId}`);
  },

  async freezeCard(cardId: string): Promise<void> {
    await apiClient.post(`/cards/${cardId}/freeze`);
  },

  async unfreezeCard(cardId: string): Promise<void> {
    await apiClient.post(`/cards/${cardId}/unfreeze`);
  },

  async updateLimits(cardId: string, limits: UpdateLimitsRequest): Promise<void> {
    if (limits.daily_limit !== undefined) {
      await apiClient.post(`/cards/${cardId}/spending-limit`, { limit: limits.daily_limit });
    }
  },

  async topUpCard(cardId: string, amount: number, currency: string = 'USD'): Promise<void> {
    await apiClient.post(`/cards/${cardId}/top-up`, { amount, currency });
  },

  async getTransactions(cardId: string): Promise<CardTransaction[]> {
    const response = await apiClient.get(`/cards/${cardId}/transactions`);
    if (response.success && response.data?.transactions) {
      return response.data.transactions.map((t: any) => ({
        id: t.id,
        card_id: cardId,
        amount: t.amount_cents / 100,
        currency: t.currency,
        merchant: t.merchant,
        category: t.category,
        status: t.status,
        created_at: t.created_at,
      }));
    }
    return [];
  },
};
