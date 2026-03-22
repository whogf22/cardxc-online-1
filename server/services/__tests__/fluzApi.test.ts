/**
 * @vitest-environment node
 */
import { beforeEach, afterEach, vi, describe, it, expect } from 'vitest';

const mockFetch = vi.fn();

beforeEach(() => {
  process.env.FLUZ_API_KEY = 'Basic dGVzdDp0ZXN0';
  process.env.FLUZ_USER_ID = 'user-123';
  process.env.FLUZ_BUSINESS_ACCOUNT_ID = 'acct-456';
  vi.stubGlobal('fetch', mockFetch);
  vi.resetModules();
});

afterEach(() => {
  mockFetch.mockReset();
  vi.unstubAllGlobals();
});

describe('fluzApi', () => {
  describe('isConfigured', () => {
    it('returns true when all env vars are set', async () => {
      const { isConfigured } = await import('../fluzApi');
      expect(isConfigured()).toBe(true);
    });

    it('returns false when FLUZ_API_KEY is missing', async () => {
      delete process.env.FLUZ_API_KEY;
      vi.resetModules();
      const { isConfigured } = await import('../fluzApi');
      expect(isConfigured()).toBe(false);
    });
  });

  describe('testConnection', () => {
    it('returns success when token generation works', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              generateUserAccessToken: {
                accessToken: 'tok_123',
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
              },
            },
          }),
        });
      const { testConnection } = await import('../fluzApi');
      const result = await testConnection();
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns auth_failed on 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });
      const { testConnection } = await import('../fluzApi');
      const result = await testConnection();
      expect(result.success).toBe(false);
      expect(result.error).toBe('auth_failed');
    });

    it('returns error when not configured', async () => {
      delete process.env.FLUZ_API_KEY;
      vi.resetModules();
      const { testConnection } = await import('../fluzApi');
      const result = await testConnection();
      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });
  });
});
