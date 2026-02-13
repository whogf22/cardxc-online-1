/**
 * @vitest-environment node
 */
import { beforeEach, afterEach, beforeAll, vi, describe, it, expect } from 'vitest';

const mockFetch = vi.fn();
let fluzClient: typeof import('../fluzClient');

beforeAll(async () => {
  process.env.FLUZ_AUTH_BASIC = 'Basic dGVzdDp0ZXN0';
  process.env.FLUZ_BASE_URL = 'https://test.fluz.example/runa';
  vi.resetModules();
  vi.stubGlobal('fetch', mockFetch);
  fluzClient = await import('../fluzClient');
});

afterEach(() => {
  mockFetch.mockReset();
});

describe('fluzClient', () => {
  describe('sanitizeSecret', () => {
    it('returns empty string for undefined', () => {
      expect(fluzClient.sanitizeSecret(undefined)).toBe('');
    });
    it('trims and normalizes whitespace', () => {
      expect(fluzClient.sanitizeSecret('  a  b  ')).toBe('a b');
    });
    it('removes newlines and tabs', () => {
      expect(fluzClient.sanitizeSecret('a\nb\tc')).toBe('abc');
    });
  });

  describe('validateFluzAuthHeaderFormat', () => {
    const restoreEnv = async () => {
      process.env.FLUZ_AUTH_BASIC = 'Basic dGVzdDp0ZXN0';
      process.env.FLUZ_BASE_URL = 'https://test.fluz.example/runa';
      vi.resetModules();
      fluzClient = await import('../fluzClient');
    };

    it('returns missing when FLUZ_AUTH_BASIC not set', async () => {
      const orig = process.env.FLUZ_AUTH_BASIC;
      delete process.env.FLUZ_AUTH_BASIC;
      vi.resetModules();
      const mod = await import('../fluzClient');
      expect(mod.validateFluzAuthHeaderFormat().format).toBe('missing');
      await restoreEnv();
    });

    it('returns double_prefix for "basic basic ..."', async () => {
      process.env.FLUZ_AUTH_BASIC = 'Basic basic abc123';
      vi.resetModules();
      const mod = await import('../fluzClient');
      expect(mod.validateFluzAuthHeaderFormat().format).toBe('double_prefix');
      await restoreEnv();
    });

    it('returns too_short when base64 part is short', async () => {
      process.env.FLUZ_AUTH_BASIC = 'Basic ab';
      vi.resetModules();
      const mod = await import('../fluzClient');
      expect(mod.validateFluzAuthHeaderFormat().format).toBe('too_short');
      await restoreEnv();
    });

    it('returns ok for valid Basic token', () => {
      expect(fluzClient.validateFluzAuthHeaderFormat().format).toBe('ok');
    });
  });

  describe('isFluzConfigured', () => {
    it('returns true when FLUZ_AUTH_BASIC is set', () => {
      expect(fluzClient.isFluzConfigured()).toBe(true);
    });
  });

  describe('getFluzBaseUrl', () => {
    it('returns configured base URL', () => {
      expect(fluzClient.getFluzBaseUrl()).toBe('https://test.fluz.example/runa');
    });
  });

  describe('getFluzBalance', () => {
    it('returns balance on 200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ balance: 100, currency: 'USD' }),
      });
      const result = await fluzClient.getFluzBalance('USD');
      expect(result.balance).toBe(100);
      expect(result.currency).toBe('USD');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.fluz.example/runa/v2/balance?currency=USD',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('throws AppError on 4xx', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' });
      await expect(fluzClient.getFluzBalance('USD')).rejects.toMatchObject({
        statusCode: 401,
        code: 'PROVIDER_API_ERROR',
      });
    });

    it('throws AppError on 5xx', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'Server Error' });
      await expect(fluzClient.getFluzBalance('USD')).rejects.toMatchObject({
        statusCode: 500,
        code: 'PROVIDER_API_ERROR',
      });
    });
  });

  describe('createFluzOrder', () => {
    it('sends POST with idempotency key and returns response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'ord_1', status: 'IN_PROGRESS', items: [{ payout_link: 'https://pay.example/1' }] }),
      });
      const payload = {
        payment_method: { type: 'ACCOUNT_BALANCE', currency: 'USD' },
        items: [
          {
            face_value: 10,
            external_ref: 'order-uuid',
            distribution_method: { type: 'PAYOUT_LINK' },
            products: { type: 'SINGLE', value: '1800FL-US' },
          },
        ],
      };
      const result = await fluzClient.createFluzOrder(payload, 'order-uuid');
      expect(result.id).toBe('ord_1');
      expect(result.status).toBe('IN_PROGRESS');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.fluz.example/runa/v2/order',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'X-Idempotency-Key': 'order-uuid' }),
          body: JSON.stringify(payload),
        })
      );
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'Bad Request' });
      await expect(
        fluzClient.createFluzOrder(
          { payment_method: { type: 'ACCOUNT_BALANCE', currency: 'USD' }, items: [] },
          'key'
        )
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('testFluzConnection', () => {
    it('returns success when balance returns 200', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      const result = await fluzClient.testFluzConnection();
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns auth_failed on 401', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' });
      const result = await fluzClient.testFluzConnection();
      expect(result.success).toBe(false);
      expect(result.error).toBe('auth_failed');
    });

    it('returns connection_failed on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const result = await fluzClient.testFluzConnection();
      expect(result.success).toBe(false);
      expect(result.error).toBe('connection_failed');
    });
  });
});
