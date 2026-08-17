/**
 * @vitest-environment node
 *
 * Regression: gift-card buy pricing must be server-authoritative. A client
 * cannot set its own `rate` to underpay (e.g. rate=1 → ~1% of face value).
 */
import express from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, vi, describe, it, expect } from 'vitest';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockTransaction = vi.fn();
const mockCreateAuditLog = vi.fn().mockResolvedValue(undefined);

vi.mock('../../db/pool', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  transaction: (fn: (c: unknown) => Promise<unknown>) => mockTransaction(fn),
  isDatabaseConnectionError: () => false,
}));
vi.mock('../../services/auditService', () => ({ createAuditLog: (...a: unknown[]) => mockCreateAuditLog(...a) }));
vi.mock('../../services/giftCardPricingService', () => ({
  fetchAllGiftCardsWithPricing: vi.fn(),
  // `sellAvailable` is part of the pricing contract now: the route fails closed
  // when a quote cannot be produced. A viable quote is modelled here so this
  // test keeps exercising what it is actually about — server-authoritative rate.
  calculatePricing: () => ({ brand: 'Amazon', ourBuyRate: 80, ourSellRate: 90, sellAvailable: true, costCents: 10000, profitMarginPercent: 8, marketRate: 87 }),
  calculateTransactionProfit: () => ({ costCents: 10000, profitCents: 500, profitPercent: 5 }),
}));
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as any).user = { id: 'user-1', role: 'USER' };
    next();
  },
  AuthenticatedRequest: {},
}));
vi.mock('../../middleware/rateLimit', () => ({
  sensitiveOpLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

let app: express.Express;
let clientCalls: Array<{ sql: string; params: unknown[] }> = [];

beforeAll(async () => {
  vi.resetModules();
  const gc = await import('../giftCards');
  const errMiddleware = await import('../../middleware/errorHandler');
  app = express();
  app.use(express.json());
  app.use('/api/gift-cards', gc.giftCardsRouter);
  app.use(errMiddleware.errorHandler);
});

beforeEach(() => {
  clientCalls = [];
  mockQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 1 });
  mockQueryOne.mockReset().mockResolvedValue({ id: 'req-1' });
  mockCreateAuditLog.mockReset().mockResolvedValue(undefined);
  mockTransaction.mockReset().mockImplementation(async (fn: (c: { query: (sql: string, params?: unknown[]) => Promise<any> }) => Promise<unknown>) => {
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        clientCalls.push({ sql, params: params ?? [] });
        if (sql.includes('available_cents')) return { rows: [{ available_cents: 1_000_000 }] };
        if (sql.includes('SELECT balance_cents')) return { rows: [{ balance_cents: 1_000_000 }] };
        if (sql.includes('INSERT INTO gift_card_requests')) return { rows: [{ id: 'req-1' }] };
        return { rows: [], rowCount: 1 };
      }),
    };
    return fn(client);
  });
});

describe('POST /api/gift-cards/requests (buy) — server-authoritative pricing', () => {
  it('ignores a malicious client rate and charges the server sell rate', async () => {
    // amount $100 → 10000 cents. Server ourSellRate = 90% → charge 9000 cents.
    // A trusted client rate of 1 would (in the bug) charge only 100 cents.
    const res = await request(app)
      .post('/api/gift-cards/requests')
      .set('Content-Type', 'application/json')
      .send({ type: 'buy', brand: 'Amazon', amount: 100, currency: 'USD', rate: 1, paymentMethod: 'fiat' });

    expect(res.status).toBe(201);

    const deduction = clientCalls.find(c => c.sql.includes('UPDATE wallets') && c.sql.includes('balance_cents = balance_cents - $1'));
    expect(deduction).toBeTruthy();
    expect(deduction!.params[0]).toBe(9000); // server rate applied, NOT 100

    const insert = clientCalls.find(c => c.sql.includes('INSERT INTO gift_card_requests'));
    // stored currency=USD then rate; ensure the stored rate is the server rate (90), not the client 1
    expect(insert!.params).toContain(90);
    expect(insert!.params).not.toContain(1);
  });
});
