// Card service - uses real backend API
import { apiClient } from './apiClient';
import type { VirtualCard, CardTransaction, CreateCardRequest, UpdateLimitsRequest } from '../types/card';

export const cardService = {
  async getCards(): Promise<VirtualCard[]> {
    try {
      const response = await apiClient.get('/user/cards');
      if (response.success && response.data?.cards) {
        return response.data.cards.map((card: any) => ({
          id: card.id,
          user_id: card.user_id,
          card_name: card.card_name,
          card_number_masked: `**** **** **** ${card.last_four}`,
          last_four: card.last_four,
          card_type: 'VIRTUAL',
          card_brand: card.card_type || 'VISA',
          status: card.status || 'ACTIVE',
          balance: card.balance || 0,
          currency: 'USD',
          daily_limit: card.spending_limit_cents ? card.spending_limit_cents / 100 : 5000,
          monthly_limit: 25000,
          per_transaction_limit: 2500,
          daily_spent: 0,
          monthly_spent: 0,
          expiry_month: new Date().getMonth() + 1,
          expiry_year: new Date().getFullYear() + 3,
          created_at: card.created_at,
          updated_at: card.updated_at || card.created_at,
        }));
      }
      return [];
    } catch (error) {
      console.error('[CardService] Failed to get cards:', error);
      return [];
    }
  },

  async getCard(cardId: string): Promise<VirtualCard | null> {
    const cards = await this.getCards();
    return cards.find(c => c.id === cardId) || null;
  },

  async createCard(request: CreateCardRequest = {}): Promise<VirtualCard> {
    const response = await apiClient.post('/user/cards', {
      cardName: request.card_name || 'My Card',
      cardType: request.card_brand || 'VISA',
      spendingLimit: request.daily_limit || 5000,
    });

    if (!response.success || !response.data?.card) {
      throw new Error('Failed to create card');
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
      status: card.status || 'ACTIVE',
      balance: card.balance || 0,
      currency: 'USD',
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
    console.log('[CardService] Card deletion requires backend support:', cardId);
    throw new Error('Card deletion coming soon');
  },

  async freezeCard(cardId: string): Promise<VirtualCard> {
    console.log('[CardService] Card freeze requires backend support:', cardId);
    throw new Error('Card freeze coming soon');
  },

  async unfreezeCard(cardId: string): Promise<VirtualCard> {
    console.log('[CardService] Card unfreeze requires backend support:', cardId);
    throw new Error('Card unfreeze coming soon');
  },

  async updateLimits(cardId: string, limits: UpdateLimitsRequest): Promise<VirtualCard> {
    console.log('[CardService] Update limits requires backend support:', cardId, limits);
    throw new Error('Limit updates coming soon');
  },

  async topUpCard(cardId: string, amount: number): Promise<VirtualCard> {
    console.log('[CardService] Card top-up requires backend support:', cardId, amount);
    throw new Error('Card top-up coming soon');
  },

  async getTransactions(cardId: string): Promise<CardTransaction[]> {
    console.log('[CardService] Card transactions requires backend support:', cardId);
    return [];
  },
};
