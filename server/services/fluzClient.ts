/**
 * Internal payment provider client — sole payment/settlement layer for Card Checkout.
 * All provider API calls go through this wrapper.
 */

import { AppError } from '../middleware/errorHandler';
import { logger } from '../middleware/logger';
import { sanitizeApiError } from '../lib/sanitizeLog';

const FLUZ_BASE_URL = process.env.FLUZ_BASE_URL || 'https://api-adapter.fluzapp.com/runa';
const FLUZ_AUTH_BASIC = process.env.FLUZ_AUTH_BASIC || process.env.FLUZ_API_KEY;

export function sanitizeSecret(secret: string | undefined): string {
  if (!secret) return '';
  return secret
    .replace(/[\r\n\t]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAuthHeader(): string {
  if (!FLUZ_AUTH_BASIC) {
    throw new AppError('Payment provider not configured', 500, 'PROVIDER_NOT_CONFIGURED');
  }
  const cleanToken = sanitizeSecret(FLUZ_AUTH_BASIC);
  if (cleanToken.toLowerCase().startsWith('basic ')) {
    return cleanToken;
  }
  return `Basic ${cleanToken}`;
}

export function isFluzConfigured(): boolean {
  return !!FLUZ_AUTH_BASIC;
}

export function getFluzBaseUrl(): string {
  return FLUZ_BASE_URL;
}

export function validateFluzAuthHeaderFormat(): { valid: boolean; format: string } {
  if (!FLUZ_AUTH_BASIC) {
    return { valid: false, format: 'missing' };
  }
  const cleanToken = sanitizeSecret(FLUZ_AUTH_BASIC);
  if (cleanToken.toLowerCase().startsWith('basic basic')) {
    return { valid: false, format: 'double_prefix' };
  }
  if (cleanToken.toLowerCase().startsWith('basic ')) {
    const base64Part = cleanToken.substring(6).trim();
    if (base64Part.length < 10) {
      return { valid: false, format: 'too_short' };
    }
    return { valid: true, format: 'ok' };
  }
  if (cleanToken.length < 10) {
    return { valid: false, format: 'too_short' };
  }
  return { valid: true, format: 'ok' };
}

export function detectFluzEnvironmentMismatch(): void {
  const baseUrl = FLUZ_BASE_URL.toLowerCase();
  const isStaging = baseUrl.includes('staging') || baseUrl.includes('sandbox') || baseUrl.includes('test');
  const isProd = baseUrl.includes('api-adapter.fluzapp.com') && !isStaging;
  if (isProd) {
    logger.info('Payment provider configured for production environment');
  } else if (isStaging) {
    logger.info('Payment provider configured for staging/sandbox environment');
  }
}

async function request<T = any>(
  endpoint: string,
  method: string,
  body?: object,
  idempotencyKey?: string
): Promise<T> {
  const authHeader = getAuthHeader();
  const headers: Record<string, string> = {
    Authorization: authHeader,
    'Content-Type': 'application/json',
  };
  if (idempotencyKey) {
    headers['X-Idempotency-Key'] = idempotencyKey;
  }

  const url = `${FLUZ_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Payment provider API error', {
      endpoint,
      method,
      status: response.status,
      errorPreview: sanitizeApiError(errorText, 80),
    });
    throw new AppError('Payment processing failed', response.status, 'PROVIDER_API_ERROR');
  }

  return response.json() as Promise<T>;
}

export interface FluzBalanceResponse {
  balance?: number;
  currency?: string;
  [key: string]: unknown;
}

export async function getFluzBalance(currency: string): Promise<FluzBalanceResponse> {
  return request<FluzBalanceResponse>(`/v2/balance?currency=${encodeURIComponent(currency)}`, 'GET');
}

export interface FluzCreateOrderPayload {
  payment_method: { type: string; currency: string };
  items: Array<{
    face_value: number;
    external_ref: string;
    distribution_method: { type: string };
    products: { type: string; value: string };
  }>;
}

export interface FluzOrderItem {
  id?: string;
  payout_link?: string;
  redemption_url?: string;
  link?: string;
  [key: string]: unknown;
}

export interface FluzCreateOrderResponse {
  id?: string;
  order_id?: string;
  status?: string;
  checkout_url?: string;
  items?: FluzOrderItem[];
  [key: string]: unknown;
}

export async function createFluzOrder(
  payload: FluzCreateOrderPayload,
  idempotencyKey: string
): Promise<FluzCreateOrderResponse> {
  return request<FluzCreateOrderResponse>('/v2/order', 'POST', payload, idempotencyKey);
}

export interface FluzProduct {
  id: string;
  name: string;
  description?: string;
  currency: string;
  status: string;
  face_values?: number[];
  min_value?: number;
  max_value?: number;
  /** Native logo from Fluz (preferred over Clearbit/favicon) */
  logoUrl?: string;
  logo_url?: string;
  image_url?: string;
  faceplateUrl?: string;
  [key: string]: unknown;
}

export async function getFluzProducts(params: { currency?: string; page?: number; limit?: number } = {}): Promise<{ items: FluzProduct[]; total: number }> {
  const query = new URLSearchParams();
  if (params.currency) query.append('currency', params.currency);
  if (params.page) query.append('page', params.page.toString());
  if (params.limit) query.append('limit', params.limit.toString());

  const queryString = query.toString();
  return request<{ items: FluzProduct[]; total: number }>(`/v2/product${queryString ? `?${queryString}` : ''}`, 'GET');
}

export async function getFluzProductDetails(productId: string): Promise<FluzProduct> {
  return request<FluzProduct>(`/v2/product/${productId}`, 'GET');
}

export async function testFluzConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    await getFluzBalance('USD');
    return { success: true };
  } catch (err: any) {
    if (err?.statusCode === 401) {
      logger.error('Payment provider auth failed. Check environment token (staging vs prod).');
      return { success: false, error: 'auth_failed' };
    }
    logger.error('Payment provider connection test failed', { message: err?.message });
    return { success: false, error: 'connection_failed' };
  }
}
