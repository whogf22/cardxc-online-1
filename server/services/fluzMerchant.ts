/**
 * Payment provider merchant integration — extension point for future merchant-specific APIs.
 * Card checkout continues to use the provider client for orders and webhooks.
 * This module is for optional merchant features (e.g. merchant balance, merchant payouts).
 */

import { isFluzConfigured, getFluzBaseUrl, testFluzConnection } from './fluzClient';
import { logger } from '../middleware/logger';

const FLUZ_MERCHANT_ID = process.env.FLUZ_MERCHANT_ID;
const FLUZ_MERCHANT_WEBHOOK_SECRET = process.env.FLUZ_MERCHANT_WEBHOOK_SECRET;

/** Whether merchant-specific env (e.g. merchant ID) is set. Same provider, optional merchant context. */
export function isFluzMerchantConfigured(): boolean {
  return isFluzConfigured() && !!FLUZ_MERCHANT_ID;
}

export function getFluzMerchantId(): string | undefined {
  return FLUZ_MERCHANT_ID;
}

export function getFluzMerchantWebhookSecret(): string | undefined {
  return FLUZ_MERCHANT_WEBHOOK_SECRET;
}

/** For future: merchant balance, payouts, etc. Reuses same base URL/auth as provider client. */
export async function getFluzMerchantStatus(): Promise<{ configured: boolean; baseUrl: string; merchantId?: string }> {
  const baseUrl = getFluzBaseUrl();
  if (!isFluzConfigured()) {
    return { configured: false, baseUrl, merchantId: undefined };
  }
  const merchantId = FLUZ_MERCHANT_ID || undefined;
  logger.info('Payment provider merchant status', { baseUrl: baseUrl.substring(0, 40), hasMerchantId: !!merchantId });
  return { configured: true, baseUrl, merchantId };
}

/** Test connectivity for merchant context. */
export async function testFluzMerchantConnection(): Promise<{ success: boolean; error?: string }> {
  return testFluzConnection();
}
