/**
 * Reloadly Gift Card Service
 * Manages gift card purchases and reveals via Reloadly API.
 * Falls back gracefully when credentials are not configured.
 */
import axios, { AxiosInstance } from 'axios';
import { logger } from '../middleware/logger';

const clientId = process.env.RELOADLY_CLIENT_ID;
const clientSecret = process.env.RELOADLY_CLIENT_SECRET;
const reloadlyBaseUrl = process.env.RELOADLY_API_URL || 'https://api.reloadly.com';

let accessToken: string | null = null;
let tokenExpiresAt: number = 0;
let axiosInstance: AxiosInstance | null = null;

export function isReloadlyConfigured(): boolean {
  return !!(clientId && clientSecret);
}

/**
 * Get or refresh Reloadly access token
 */
async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (accessToken && tokenExpiresAt > now) {
    return accessToken;
  }

  if (!clientId || !clientSecret) {
    throw new Error('Reloadly credentials not configured');
  }

  try {
    const response = await axios.post(`${reloadlyBaseUrl}/oauth/token`, {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    });

    accessToken = response.data.access_token;
    tokenExpiresAt = now + (response.data.expires_in - 60) * 1000; // Refresh 60s before expiry
    logger.info('Reloadly access token obtained');
    return accessToken;
  } catch (error: any) {
    logger.error('Failed to get Reloadly access token', { error: error?.message });
    throw new Error('Failed to authenticate with Reloadly');
  }
}

/**
 * Get Reloadly axios instance with auth
 */
async function getAxiosInstance(): Promise<AxiosInstance> {
  if (!axiosInstance) {
    axiosInstance = axios.create({
      baseURL: reloadlyBaseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    axiosInstance.interceptors.request.use(async (config) => {
      const token = await getAccessToken();
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }
  return axiosInstance;
}

export interface ReloadlyProduct {
  id: number;
  productName: string;
  productOperatorId: number;
  logoUrls: { png: string; svg: string };
  category: string;
  operatorName: string;
  minDenomination: number;
  maxDenomination: number;
  denominationType: string; // 'FIXED' or 'RANGE'
  fixedDenominations: number[];
  fixedRecipientDenominations: number[];
  displayDenominations: number[];
  country: { isoName: string; name: string };
  status: string;
}

export interface ReloadlyOrder {
  transactionId: string;
  customTransactionId?: string;
  productId: number;
  productName: string;
  operatorName: string;
  countryCode: string;
  recipientPhone?: string;
  amount: number;
  discount: number;
  discountPercentage: number;
  totalInclusive: number;
  status: string;
  pinDetail?: { pin: string; serial: string };
  code?: string;
  message?: string;
  operatorTransactionId?: string;
  customOperatorId?: string;
  deliveryMethod?: string;
  email?: string;
  smsPhone?: string;
  createdDate: string;
}

/**
 * List all available gift card products from Reloadly
 */
export async function listGiftCardProducts(filters?: {
  operatorId?: number;
  countryCode?: string;
  limit?: number;
  offset?: number;
}): Promise<ReloadlyProduct[]> {
  if (!isReloadlyConfigured()) {
    logger.warn('Reloadly not configured, returning empty product list');
    return [];
  }

  try {
    const instance = await getAxiosInstance();
    const params = new URLSearchParams();
    if (filters?.operatorId) params.append('operatorId', String(filters.operatorId));
    if (filters?.countryCode) params.append('countryCode', filters.countryCode);
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.offset) params.append('offset', String(filters.offset));

    const response = await instance.get('/gift-cards/products', { params });
    return response.data.data || [];
  } catch (error: any) {
    logger.error('Failed to list Reloadly gift card products', { error: error?.message });
    return [];
  }
}

/**
 * Get details of a specific gift card product
 */
export async function getProductDetails(productId: number): Promise<ReloadlyProduct | null> {
  if (!isReloadlyConfigured()) return null;

  try {
    const instance = await getAxiosInstance();
    const response = await instance.get(`/gift-cards/products/${productId}`);
    return response.data.data || null;
  } catch (error: any) {
    logger.error('Failed to get Reloadly product details', { productId, error: error?.message });
    return null;
  }
}

/**
 * Purchase a gift card via Reloadly
 */
export async function purchaseGiftCard(options: {
  productId: number;
  amount: number;
  recipientPhone?: string;
  email?: string;
  customTransactionId?: string;
}): Promise<ReloadlyOrder> {
  if (!isReloadlyConfigured()) {
    throw new Error('Reloadly not configured');
  }

  const { productId, amount, recipientPhone, email, customTransactionId } = options;

  try {
    const instance = await getAxiosInstance();
    const payload: any = {
      productId,
      amount,
    };

    if (recipientPhone) payload.recipientPhone = recipientPhone;
    if (email) payload.email = email;
    if (customTransactionId) payload.customTransactionId = customTransactionId;

    const response = await instance.post('/gift-cards/orders', payload);

    logger.info('Reloadly gift card purchased', {
      transactionId: response.data.data?.transactionId,
      productId,
      amount,
    });

    return response.data.data;
  } catch (error: any) {
    logger.error('Failed to purchase Reloadly gift card', {
      productId,
      amount,
      error: error?.response?.data || error?.message,
    });
    throw new Error(`Gift card purchase failed: ${error?.response?.data?.message || error?.message}`);
  }
}

/**
 * Get the status of a gift card order
 */
export async function getOrderStatus(transactionId: string): Promise<ReloadlyOrder | null> {
  if (!isReloadlyConfigured()) return null;

  try {
    const instance = await getAxiosInstance();
    const response = await instance.get(`/gift-cards/orders/${transactionId}`);
    return response.data.data || null;
  } catch (error: any) {
    logger.error('Failed to get Reloadly order status', { transactionId, error: error?.message });
    return null;
  }
}

/**
 * List gift card orders (with optional filters)
 */
export async function listOrders(filters?: {
  status?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<ReloadlyOrder[]> {
  if (!isReloadlyConfigured()) return [];

  try {
    const instance = await getAxiosInstance();
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.offset) params.append('offset', String(filters.offset));

    const response = await instance.get('/gift-cards/orders', { params });
    return response.data.data || [];
  } catch (error: any) {
    logger.error('Failed to list Reloadly orders', { error: error?.message });
    return [];
  }
}

/**
 * Test Reloadly connection
 */
export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  if (!isReloadlyConfigured()) {
    return { success: false, error: 'Reloadly credentials not configured' };
  }

  try {
    const products = await listGiftCardProducts({ limit: 1 });
    return { success: products.length > 0 };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}
