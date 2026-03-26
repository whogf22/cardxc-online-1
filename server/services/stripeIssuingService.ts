/**
 * Stripe Issuing Service
 * Manages virtual card issuance, reveal, freeze/unfreeze via Stripe Issuing API.
 * Falls back gracefully when STRIPE_ISSUING_CARDHOLDER_ID is not configured.
 */
import Stripe from 'stripe';
import { logger } from '../middleware/logger';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const cardholderIdEnv = process.env.STRIPE_ISSUING_CARDHOLDER_ID;

let stripe: Stripe | null = null;
if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-02-24.acacia' });
}

export function isIssuingConfigured(): boolean {
  return !!(stripe && cardholderIdEnv);
}

export interface IssuedCard {
  issuingCardId: string;
  last4: string;
  expMonth: number;
  expYear: number;
  status: string;
  brand: string;
  cardholderName: string;
}

export interface RevealedCard {
  cardNumber: string;
  expiryMMYY: string;
  cvv: string;
  cardHolderName: string;
}

/**
 * Create a virtual card via Stripe Issuing.
 * Requires STRIPE_ISSUING_CARDHOLDER_ID to be set.
 */
export async function createIssuingCard(options: {
  cardName: string;
  spendingLimitCents?: number;
  spendLimitDuration?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time';
  currency?: string;
}): Promise<IssuedCard> {
  if (!stripe || !cardholderIdEnv) {
    throw new Error('Stripe Issuing not configured. Set STRIPE_SECRET_KEY and STRIPE_ISSUING_CARDHOLDER_ID.');
  }

  const { cardName, spendingLimitCents, spendLimitDuration = 'monthly', currency = 'usd' } = options;

  const cardParams: Stripe.Issuing.CardCreateParams = {
    cardholder: cardholderIdEnv,
    currency: currency.toLowerCase() as Stripe.Issuing.CardCreateParams.Currency,
    type: 'virtual',
    status: 'active',
    metadata: { cardName },
  };

  if (spendingLimitCents) {
    cardParams.spending_controls = {
      spending_limits: [
        {
          amount: spendingLimitCents,
          interval: spendLimitDuration,
        },
      ],
    };
  }

  const card = await stripe.issuing.cards.create(cardParams);

  logger.info('Stripe Issuing card created', { cardId: card.id, last4: card.last4 });

  return {
    issuingCardId: card.id,
    last4: card.last4,
    expMonth: card.exp_month,
    expYear: card.exp_year,
    status: card.status,
    brand: card.brand,
    cardholderName: card.cardholder.name,
  };
}

/**
 * Reveal full card details (number, CVC) via Stripe Issuing.
 * Requires client-side ephemeral key flow in production.
 * In test mode, uses retrieve with expand.
 */
export async function revealIssuingCard(issuingCardId: string): Promise<RevealedCard> {
  if (!stripe) {
    throw new Error('Stripe not configured');
  }

  // Retrieve card details with number expansion (test mode only)
  const card = await stripe.issuing.cards.retrieve(issuingCardId, {
    expand: ['number', 'cvc'],
  }) as any;

  const expMonth = String(card.exp_month).padStart(2, '0');
  const expYear = String(card.exp_year).slice(-2);

  return {
    cardNumber: card.number || `**** **** **** ${card.last4}`,
    expiryMMYY: `${expMonth}/${expYear}`,
    cvv: card.cvc || '***',
    cardHolderName: card.cardholder?.name || 'CARD HOLDER',
  };
}

/**
 * Freeze (suspend) a Stripe Issuing card.
 */
export async function freezeIssuingCard(issuingCardId: string): Promise<void> {
  if (!stripe) throw new Error('Stripe not configured');
  await stripe.issuing.cards.update(issuingCardId, { status: 'inactive' });
  logger.info('Stripe Issuing card frozen', { cardId: issuingCardId });
}

/**
 * Unfreeze (reactivate) a Stripe Issuing card.
 */
export async function unfreezeIssuingCard(issuingCardId: string): Promise<void> {
  if (!stripe) throw new Error('Stripe not configured');
  await stripe.issuing.cards.update(issuingCardId, { status: 'active' });
  logger.info('Stripe Issuing card unfrozen', { cardId: issuingCardId });
}

/**
 * Cancel (close) a Stripe Issuing card permanently.
 */
export async function cancelIssuingCard(issuingCardId: string): Promise<void> {
  if (!stripe) throw new Error('Stripe not configured');
  await stripe.issuing.cards.update(issuingCardId, { status: 'canceled' });
  logger.info('Stripe Issuing card cancelled', { cardId: issuingCardId });
}

/**
 * Update spending limit on a Stripe Issuing card.
 */
export async function updateIssuingCardLimit(
  issuingCardId: string,
  spendingLimitCents: number,
  interval: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time' = 'monthly'
): Promise<void> {
  if (!stripe) throw new Error('Stripe not configured');
  await stripe.issuing.cards.update(issuingCardId, {
    spending_controls: {
      spending_limits: [{ amount: spendingLimitCents, interval }],
    },
  });
  logger.info('Stripe Issuing card limit updated', { cardId: issuingCardId, spendingLimitCents });
}

/**
 * List all Stripe Issuing cards for the cardholder.
 */
export async function listIssuingCards(): Promise<IssuedCard[]> {
  if (!stripe || !cardholderIdEnv) return [];
  const cards = await stripe.issuing.cards.list({ cardholder: cardholderIdEnv, limit: 100 });
  return cards.data.map(card => ({
    issuingCardId: card.id,
    last4: card.last4,
    expMonth: card.exp_month,
    expYear: card.exp_year,
    status: card.status,
    brand: card.brand,
    cardholderName: card.cardholder.name,
  }));
}

/**
 * Create an ephemeral key for client-side card reveal (production use).
 */
export async function createEphemeralKey(issuingCardId: string, apiVersion: string): Promise<string> {
  if (!stripe) throw new Error('Stripe not configured');
  const key = await stripe.ephemeralKeys.create(
    { issuing_card: issuingCardId },
    { apiVersion }
  );
  return key.secret;
}
