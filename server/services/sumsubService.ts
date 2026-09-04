import crypto from 'crypto';
import { logger } from '../middleware/logger';
import { AppError } from '../middleware/errorHandler';

const SUMSUB_BASE_URL = process.env.SUMSUB_BASE_URL || 'https://api.sumsub.com';
const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN;
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY;
const SUMSUB_LEVEL_NAME = process.env.SUMSUB_LEVEL_NAME;
const SUMSUB_WEBHOOK_SECRET = process.env.SUMSUB_WEBHOOK_SECRET;

const WEBHOOK_ALGORITHMS: Record<string, string> = {
  HMAC_SHA1_HEX: 'sha1',
  HMAC_SHA256_HEX: 'sha256',
  HMAC_SHA512_HEX: 'sha512',
};

export interface SumsubApplicant {
  id: string;
  inspectionId: string;
  externalUserId: string;
  review?: {
    reviewStatus?: string;
    reviewResult?: {
      reviewAnswer?: 'GREEN' | 'RED';
      reviewRejectType?: 'FINAL' | 'RETRY';
      rejectLabels?: string[];
    };
  };
}

export interface SumsubAccessToken {
  token: string;
  userId: string;
}

export interface SumsubWebhookPayload {
  type: string;
  applicantId?: string;
  externalUserId?: string;
  inspectionId?: string;
  reviewResult?: {
    reviewAnswer?: 'GREEN' | 'RED';
    reviewRejectType?: 'FINAL' | 'RETRY';
    rejectLabels?: string[];
    reviewId?: string;
    attemptId?: string;
    attemptCnt?: number;
  };
}

export function isConfigured(): boolean {
  return !!(SUMSUB_APP_TOKEN && SUMSUB_SECRET_KEY && SUMSUB_LEVEL_NAME);
}

export function isEnabled(): boolean {
  return isConfigured() && process.env.SUMSUB_ENABLED === 'true';
}

function signRequest(method: string, pathWithQuery: string, body: string, timestamp: number): { sig: string; ts: string } {
  if (!SUMSUB_SECRET_KEY) {
    throw new Error('SUMSUB_SECRET_KEY is not configured');
  }
  const ts = String(timestamp);
  const signingString = `${ts}${method}${pathWithQuery}${body}`;
  const sig = crypto.createHmac('sha256', SUMSUB_SECRET_KEY).update(signingString).digest('hex');
  return { sig, ts };
}

function encodeQueryParams(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

async function sumsubRequest<T = unknown>(
  method: 'GET' | 'POST',
  path: string,
  options: {
    query?: Record<string, string | number | undefined>;
    body?: Record<string, unknown>;
  } = {}
): Promise<T> {
  if (!isConfigured()) {
    throw new AppError('Sumsub provider not configured', 500, 'PROVIDER_NOT_CONFIGURED');
  }

  const pathWithQuery = options.query ? `${path}${encodeQueryParams(options.query)}` : path;
  const bodyString = options.body ? JSON.stringify(options.body) : '';
  const ts = Math.floor(Date.now() / 1000);
  const { sig, ts: tsString } = signRequest(method, pathWithQuery, bodyString, ts);

  const url = `${SUMSUB_BASE_URL}${pathWithQuery}`;
  const headers: Record<string, string> = {
    'X-App-Token': SUMSUB_APP_TOKEN as string,
    'X-App-Access-Sig': sig,
    'X-App-Access-Ts': tsString,
  };
  if (bodyString) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: bodyString || undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'unknown');
    logger.error('Sumsub API request failed', {
      method,
      path,
      status: response.status,
      bodyPreview: text.slice(0, 200),
    });
    if (response.status === 401) {
      throw new AppError('Sumsub authentication failed', 401, 'PROVIDER_AUTH_ERROR');
    }
    throw new AppError(`Sumsub request failed: ${response.statusText || response.status}`, response.status, 'PROVIDER_API_ERROR');
  }

  return response.json() as Promise<T>;
}

/**
 * Look up an existing applicant by the stable externalUserId (CardXC user id).
 * Falls back to creating a new applicant if one does not yet exist.
 */
export async function getOrCreateApplicant(
  externalUserId: string,
  email?: string,
  phone?: string
): Promise<SumsubApplicant> {
  const encodedId = encodeURIComponent(externalUserId);

  try {
    const check = await sumsubRequest<{ exists: boolean; applicant?: SumsubApplicant }>(
      'GET',
      `/resources/applicants/-/byExternalUserId/${encodedId}`
    );
    if (check.exists && check.applicant) {
      return check.applicant;
    }
  } catch (err) {
    logger.warn('Sumsub applicant lookup by externalUserId failed; will attempt creation', {
      externalUserId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const body: Record<string, unknown> = { externalUserId };
  if (email) body.email = email;
  if (phone) body.phone = phone;

  try {
    const created = await sumsubRequest<SumsubApplicant>(
      'POST',
      '/resources/applicants',
      {
        query: { levelName: SUMSUB_LEVEL_NAME as string },
        body,
      }
    );
    return created;
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 409) {
      // The applicant may have been created by a concurrent request or by the
      // token endpoint. Try to read it back by externalUserId.
      const retry = await sumsubRequest<{ exists: boolean; applicant?: SumsubApplicant }>(
        'GET',
        `/resources/applicants/-/byExternalUserId/${encodedId}`
      );
      if (retry.exists && retry.applicant) {
        return retry.applicant;
      }
    }
    throw err;
  }
}

/**
 * Mint a short-lived WebSDK/MobileSDK access token scoped to a single user.
 * The token TTL should be short (600s); the SDK will call the refresh
 * callback when it needs a fresh one.
 */
export async function generateAccessToken(
  externalUserId: string,
  email?: string,
  phone?: string
): Promise<SumsubAccessToken> {
  const applicantIdentifiers: Record<string, string> = {};
  if (email) applicantIdentifiers.email = email;
  if (phone) applicantIdentifiers.phone = phone;

  const body: Record<string, unknown> = {
    userId: externalUserId,
    levelName: SUMSUB_LEVEL_NAME as string,
    ttlInSecs: 600,
  };
  if (Object.keys(applicantIdentifiers).length > 0) {
    body.applicantIdentifiers = applicantIdentifiers;
  }

  return sumsubRequest<SumsubAccessToken>('POST', '/resources/accessTokens/sdk', { body });
}

/**
 * Fetch the full applicant view by applicantId.
 * Useful as a synchronous fallback when a webhook is delayed or missing.
 */
export async function getApplicant(applicantId: string): Promise<SumsubApplicant> {
  return sumsubRequest<SumsubApplicant>('GET', `/resources/applicants/${encodeURIComponent(applicantId)}/one`);
}

/**
 * Verify a Sumsub webhook signature against the raw request body.
 * The digest algorithm is read from x-payload-digest-alg and defaults to
 * HMAC-SHA256 hex. Returns false if verification fails for any reason.
 */
export function verifyWebhookSignature(rawBody: Buffer, headers: Record<string, string | undefined>): boolean {
  if (!SUMSUB_WEBHOOK_SECRET) {
    return false;
  }

  const algName = headers['x-payload-digest-alg'] || 'HMAC_SHA256_HEX';
  const alg = WEBHOOK_ALGORITHMS[algName];
  if (!alg) {
    logger.warn('Sumsub webhook: unsupported digest algorithm', { algName });
    return false;
  }

  const expectedHex = headers['x-payload-digest'];
  if (!expectedHex) {
    logger.warn('Sumsub webhook: missing x-payload-digest header');
    return false;
  }

  const actualHex = crypto.createHmac(alg, SUMSUB_WEBHOOK_SECRET).update(rawBody).digest('hex');
  const actualBuf = Buffer.from(actualHex, 'hex');
  const expectedBuf = Buffer.from(expectedHex, 'hex');

  if (actualBuf.length !== expectedBuf.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(actualBuf, expectedBuf);
  } catch {
    return false;
  }
}

/**
 * Map Sumsub webhook event types and review answers to the local KYC status
 * enum. Returns null for events that should not move the user's status.
 */
export function mapSumsubStatus(eventType: string, reviewAnswer?: 'GREEN' | 'RED'): string | null {
  switch (eventType) {
    case 'applicantCreated':
    case 'applicantPending':
    case 'applicantPrechecked':
    case 'applicantOnHold':
    case 'applicantPersonalInfoChanged':
      return 'pending';
    case 'applicantReviewed':
    case 'applicantWorkflowCompleted':
      if (reviewAnswer === 'GREEN') return 'approved';
      if (reviewAnswer === 'RED') return 'rejected';
      return 'pending';
    default:
      return null;
  }
}
