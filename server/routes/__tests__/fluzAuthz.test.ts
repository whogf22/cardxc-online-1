/**
 * @vitest-environment node
 *
 * Regression tests for Fluz provider authorization.
 *
 * Invariant: the Fluz provider is a SINGLE shared platform account. Endpoints
 * that read/mutate money, card PANs, or redeemable gift-card codes on that
 * shared account MUST be restricted to SUPER_ADMIN. A normal USER must never be
 * able to enumerate cards, reveal a PAN/CVV, mint a card funded from the shared
 * FLUZ_BALANCE, purchase/deposit, or reveal/list shared gift-card codes.
 *
 * We mount the real fluz router. `authenticate` is mocked so we can flip the
 * caller's role, but `requireSuperAdmin` / `requireRole` are the REAL
 * implementations, so this test exercises the actual gate wiring on the router.
 */
import express from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';

// Mutable role for the mocked authenticate middleware.
let currentRole: 'USER' | 'SUPER_ADMIN' = 'USER';

vi.mock('../../middleware/auth', async () => {
  const actual = await vi.importActual<typeof import('../../middleware/auth')>('../../middleware/auth');
  return {
    ...actual,
    // Keep the REAL requireSuperAdmin / requireRole; only stub authenticate.
    authenticate: (req: express.Request & { user?: unknown }, _res: express.Response, next: express.NextFunction) => {
      (req as express.Request & { user: unknown }).user = {
        id: 'user-1',
        email: 'user@test.com',
        role: currentRole,
        sessionId: 'sess-1',
      };
      next();
    },
  };
});

vi.mock('../../middleware/rateLimit', () => ({
  sensitiveOpLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  financialOpLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../services/auditService', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

// fluzApi is fully mocked: isConfigured() is true so we reach the handler body
// only AFTER the auth gate. Every provider call is a spy that, if ever invoked
// by a non-admin, would fail the test's "must not reach provider" assertions.
const providerCall = vi.fn().mockResolvedValue({});
vi.mock('../../services/fluzApi', () => ({
  isConfigured: () => true,
  getWallet: (...a: unknown[]) => providerCall('getWallet', ...a),
  listVirtualCards: (...a: unknown[]) => providerCall('listVirtualCards', ...a).then(() => []),
  createVirtualCard: (...a: unknown[]) => providerCall('createVirtualCard', ...a).then(() => ({ virtualCardId: 'x' })),
  getVirtualCardDetails: (...a: unknown[]) => providerCall('getVirtualCardDetails', ...a).then(() => ({ virtualCardId: 'x' })),
  revealVirtualCard: (...a: unknown[]) => providerCall('revealVirtualCard', ...a).then(() => ({ cardNumber: '4111111111111111', cvv: '123' })),
  getGiftCards: (...a: unknown[]) => providerCall('getGiftCards', ...a).then(() => []),
  getTransactions: (...a: unknown[]) => providerCall('getTransactions', ...a).then(() => []),
  revealGiftCard: (...a: unknown[]) => providerCall('revealGiftCard', ...a).then(() => ({ code: 'SECRET' })),
  purchaseGiftCard: (...a: unknown[]) => providerCall('purchaseGiftCard', ...a).then(() => ({ giftCard: { giftCardId: 'g', offer: { name: 'n' } } })),
  depositCashBalance: (...a: unknown[]) => providerCall('depositCashBalance', ...a).then(() => ({ cashBalanceDeposits: [], balances: [] })),
  getVirtualCardBalance: (...a: unknown[]) => providerCall('getVirtualCardBalance', ...a).then(() => []),
  getUserAddresses: (...a: unknown[]) => providerCall('getUserAddresses', ...a).then(() => []),
  saveAddress: (...a: unknown[]) => providerCall('saveAddress', ...a).then(() => ({ addressId: 'a' })),
  // Low-sensitivity reads that should remain open to any authenticated user.
  getMerchants: (...a: unknown[]) => providerCall('getMerchants', ...a).then(() => []),
  getBusinessCategories: (...a: unknown[]) => providerCall('getBusinessCategories', ...a).then(() => []),
}));

let app: express.Express;

beforeAll(async () => {
  vi.resetModules();
  const fluz = await import('../fluz');
  app = express();
  app.use(express.json());
  app.use('/api/fluz', fluz.fluzRouter);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.statusCode || 500).json({ success: false, error: err.message, code: err.code });
  });
});

beforeEach(() => {
  providerCall.mockClear();
  currentRole = 'USER';
});

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

// Endpoints that operate on the shared platform account and must be admin-only.
const gatedRoutes: Array<{ method: 'get' | 'post' | 'put'; path: string; body?: object }> = [
  { method: 'get', path: '/api/fluz/wallet' },
  { method: 'get', path: '/api/fluz/balance' },
  { method: 'get', path: '/api/fluz/virtual-cards' },
  { method: 'post', path: '/api/fluz/virtual-cards', body: { spendLimit: 100, spendLimitDuration: 'MONTHLY' } },
  { method: 'get', path: `/api/fluz/virtual-cards/${VALID_UUID}` },
  { method: 'get', path: `/api/fluz/virtual-cards/${VALID_UUID}/reveal` },
  { method: 'post', path: `/api/fluz/virtual-cards/${VALID_UUID}/lock` },
  { method: 'post', path: `/api/fluz/virtual-cards/${VALID_UUID}/unlock` },
  { method: 'put', path: `/api/fluz/virtual-cards/${VALID_UUID}`, body: { spendLimit: 5 } },
  { method: 'post', path: '/api/fluz/deposit', body: { amount: 10, bankCardId: 'bc-1' } },
  { method: 'get', path: '/api/fluz/gift-cards' },
  { method: 'get', path: '/api/fluz/transactions' },
  { method: 'post', path: `/api/fluz/gift-cards/${VALID_UUID}/reveal` },
  { method: 'post', path: '/api/fluz/gift-cards/purchase', body: { offerId: VALID_UUID, amount: 10 } },
  { method: 'post', path: '/api/fluz/virtual-cards/balance', body: { cardIds: ['c1'] } },
  { method: 'get', path: '/api/fluz/addresses' },
  { method: 'post', path: '/api/fluz/addresses', body: { streetAddress: '1 A St', city: 'X', state: 'CA', postalCode: '90001', country: 'US' } },
];

describe('Fluz shared-account authorization', () => {
  it('rejects a normal USER on every shared-account endpoint with 403 and never reaches the provider', async () => {
    currentRole = 'USER';
    for (const route of gatedRoutes) {
      providerCall.mockClear();
      const res = await request(app)[route.method](route.path).send(route.body || {});
      expect(res.status, `${route.method.toUpperCase()} ${route.path} should be 403 for USER`).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      // Critically: the provider must never be called for a forbidden user.
      expect(providerCall, `provider must not be invoked for USER on ${route.path}`).not.toHaveBeenCalled();
    }
  });

  it('allows a SUPER_ADMIN to pass the gate and reach the provider', async () => {
    currentRole = 'SUPER_ADMIN';
    // Reveal (the most sensitive) should now reach the provider and return the PAN.
    const res = await request(app).get(`/api/fluz/virtual-cards/${VALID_UUID}/reveal`);
    expect(res.status).toBe(200);
    expect(providerCall).toHaveBeenCalledWith('revealVirtualCard', VALID_UUID);
  });

  it('leaves low-sensitivity catalog reads open to a normal USER', async () => {
    currentRole = 'USER';
    const categories = await request(app).get('/api/fluz/categories');
    expect(categories.status).toBe(200);

    const merchants = await request(app).get('/api/fluz/merchants/search?search=coffee');
    expect(merchants.status).toBe(200);
  });
});
