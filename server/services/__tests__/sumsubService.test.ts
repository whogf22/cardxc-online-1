/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import crypto from 'crypto';

const mockFetch = vi.fn();
let sumsub: typeof import('../sumsubService');

beforeAll(() => {
  process.env.SUMSUB_APP_TOKEN = 'test-app-token';
  process.env.SUMSUB_SECRET_KEY = 'test-secret-key';
  process.env.SUMSUB_LEVEL_NAME = 'basic-kyc-level';
  process.env.SUMSUB_WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.SUMSUB_ENABLED = 'true';

  vi.stubGlobal('fetch', mockFetch);
  vi.resetModules();
  return import('../sumsubService').then((mod) => {
    sumsub = mod;
  });
});

afterEach(() => {
  mockFetch.mockReset();
});

function findCallOptions(): RequestInit & { headers: Record<string, string> } {
  const call = mockFetch.mock.calls[0];
  if (!call) throw new Error('fetch was not called');
  return call[1] as RequestInit & { headers: Record<string, string> };
}

function expectedHmac(method: string, path: string, body: string, timestamp: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}${method}${path}${body}`).digest('hex');
}

describe('sumsubService', () => {
  describe('configuration', () => {
    it('isConfigured returns true when all credentials are set', () => {
      expect(sumsub.isConfigured()).toBe(true);
    });

    it('isEnabled returns true only when configured and SUMSUB_ENABLED is true', () => {
      expect(sumsub.isEnabled()).toBe(true);
    });

    it('isEnabled returns false when SUMSUB_ENABLED is false', async () => {
      const original = process.env.SUMSUB_ENABLED;
      process.env.SUMSUB_ENABLED = 'false';
      vi.resetModules();
      const mod = await import('../sumsubService');
      try {
        expect(mod.isEnabled()).toBe(false);
      } finally {
        process.env.SUMSUB_ENABLED = original;
      }
    });
  });

  describe('getOrCreateApplicant', () => {
    it('reuses an existing applicant when one exists', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify({ exists: true, applicant: { id: 'app-1', inspectionId: 'insp-1', externalUserId: 'user-1' } }), { status: 200 }));

      const applicant = await sumsub.getOrCreateApplicant('user-1', 'u@example.com');

      expect(applicant.id).toBe('app-1');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/resources/applicants/-/byExternalUserId/user-1');
    });

    it('creates a new applicant when none exists', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify({ exists: false }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'app-2', inspectionId: 'insp-2', externalUserId: 'user-2' }), { status: 200 }));

      const applicant = await sumsub.getOrCreateApplicant('user-2', 'u2@example.com');

      expect(applicant.id).toBe('app-2');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateAccessToken', () => {
    it('signs the request and sends the correct JSON body', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'test-jwt', userId: 'user-3' }), { status: 200 })
      );

      const result = await sumsub.generateAccessToken('user-3', 'u3@example.com', '+15551112222');

      expect(result.token).toBe('test-jwt');
      expect(result.userId).toBe('user-3');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.sumsub.com/resources/accessTokens/sdk');
      expect(options?.method).toBe('POST');

      const typed = findCallOptions();
      expect(typed.headers['X-App-Token']).toBe('test-app-token');
      expect(typed.headers['X-App-Access-Ts']).toMatch(/^\d+$/);

      const body = JSON.stringify({
        userId: 'user-3',
        levelName: 'basic-kyc-level',
        ttlInSecs: 600,
        applicantIdentifiers: { email: 'u3@example.com', phone: '+15551112222' },
      });
      expect(typed.body).toBe(body);

      const expected = expectedHmac('POST', '/resources/accessTokens/sdk', body, typed.headers['X-App-Access-Ts'], 'test-secret-key');
      expect(typed.headers['X-App-Access-Sig']).toBe(expected);
    });

    it('omits empty applicantIdentifiers', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'test-jwt', userId: 'user-4' }), { status: 200 })
      );

      await sumsub.generateAccessToken('user-4');

      const typed = findCallOptions();
      const parsed = JSON.parse(typed.body as string);
      expect(parsed).not.toHaveProperty('applicantIdentifiers');
    });
  });

  describe('verifyWebhookSignature', () => {
    const payload = JSON.stringify({ type: 'applicantReviewed', applicantId: 'app-1', externalUserId: 'user-1' });
    const raw = Buffer.from(payload, 'utf8');

    it('accepts a valid HMAC-SHA256 hex signature', () => {
      const expected = crypto.createHmac('sha256', 'test-webhook-secret').update(raw).digest('hex');
      const headers = {
        'x-payload-digest': expected,
        'x-payload-digest-alg': 'HMAC_SHA256_HEX',
      };
      expect(sumsub.verifyWebhookSignature(raw, headers)).toBe(true);
    });

    it('rejects an invalid signature', () => {
      const headers = {
        'x-payload-digest': 'deadbeef',
        'x-payload-digest-alg': 'HMAC_SHA256_HEX',
      };
      expect(sumsub.verifyWebhookSignature(raw, headers)).toBe(false);
    });

    it('rejects a missing signature', () => {
      const headers = {
        'x-payload-digest-alg': 'HMAC_SHA256_HEX',
      };
      expect(sumsub.verifyWebhookSignature(raw, headers as Record<string, string>)).toBe(false);
    });

    it('rejects an unsupported digest algorithm', () => {
      const headers = {
        'x-payload-digest': 'abc',
        'x-payload-digest-alg': 'HMAC_MD5_HEX',
      };
      expect(sumsub.verifyWebhookSignature(raw, headers as Record<string, string>)).toBe(false);
    });

    it('rejects a signature with the wrong length', () => {
      const headers = {
        'x-payload-digest': '00',
        'x-payload-digest-alg': 'HMAC_SHA256_HEX',
      };
      expect(sumsub.verifyWebhookSignature(raw, headers)).toBe(false);
    });
  });

  describe('mapSumsubStatus', () => {
    it('maps reviewAnswer GREEN to approved', () => {
      expect(sumsub.mapSumsubStatus('applicantReviewed', 'GREEN')).toBe('approved');
      expect(sumsub.mapSumsubStatus('applicantWorkflowCompleted', 'GREEN')).toBe('approved');
    });

    it('maps reviewAnswer RED to rejected', () => {
      expect(sumsub.mapSumsubStatus('applicantReviewed', 'RED')).toBe('rejected');
    });

    it('maps review-submission events to pending', () => {
      for (const event of ['applicantPending', 'applicantPrechecked', 'applicantOnHold']) {
        expect(sumsub.mapSumsubStatus(event)).toBe('pending');
      }
    });

    it('does not treat applicantCreated or applicantPersonalInfoChanged as a status change', () => {
      expect(sumsub.mapSumsubStatus('applicantCreated')).toBeNull();
      expect(sumsub.mapSumsubStatus('applicantPersonalInfoChanged')).toBeNull();
    });

    it('returns null for unknown event types', () => {
      expect(sumsub.mapSumsubStatus('applicantDeleted')).toBeNull();
    });
  });
});
