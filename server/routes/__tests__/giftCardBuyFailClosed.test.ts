/**
 * @vitest-environment node
 *
 * Route-level fail-closed behaviour for the gift-card BUY path.
 *
 * The pricing service can now legitimately return "no viable quote" (cost is at
 * or above face value, or the brand is not in our catalog). The route MUST
 * refuse the sale in that case. If it instead carried a null rate through, the
 * charge would be computed as NaN cents and a corrupt row would be written.
 *
 * Nothing here weakens the existing server-authoritative-pricing guarantee: a
 * client-supplied `rate` is still ignored.
 */
import express from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, vi, describe, it, expect } from 'vitest';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockTransaction = vi.fn();

/** Swapped per-test to model an available vs unavailable quote. */
let pricingResult: any;

vi.mock('../../db/pool', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  transaction: (fn: (c: unknown) => Promise<unknown>) => mockTransaction(fn),
  isDatabaseConnectionError: () => false,
}));
vi.mock('../../services/auditService', () => ({ createAuditLog: vi.fn() }));
vi.mock('../../services/giftCardPricingService', () => ({
  fetchAllGiftCardsWithPricing: vi.fn(),
  calculatePricing: () => pricingResult,
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
  sensitiveOpLimiter: (_r: express.Request, _s: express.Response, n: express.NextFunction) => n(),
}));

let app: express.Express;
let clientCalls: Array<{ sql: string; params: unknown[] }> = [];

beforeAll(async () => {
  vi.resetModules();
  const gc = await import('../giftCards');
  const err = await import('../../middleware/errorHandler');
  app = express();
  app.use(express.json());
  app.use('/api/gift-cards', gc.giftCardsRouter);
  app.use(err.errorHandler);
});

beforeEach(() => {
  clientCalls = [];
  pricingResult = {
    brand: 'Amazon', ourBuyRate: 80, ourSellRate: 93, sellAvailable: true,
    costCents: 8500, profitMarginPercent: 8, marketRate: 87,
  };
  mockQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 1 });
  mockQueryOne.mockReset().mockResolvedValue({ id: 'req-1' });
  mockTransaction.mockReset().mockImplementation(async (fn: any) => {
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

function buy(body: Record<string, unknown> = {}) {
  return request(app)
    .post('/api/gift-cards/requests')
    .set('Content-Type', 'application/json')
    .send({ type: 'buy', brand: 'Amazon', amount: 100, currency: 'USD', paymentMethod: 'fiat', ...body });
}

describe('BUY fails closed when no profitable quote exists', () => {
  it('refuses the sale and writes nothing', async () => {
    pricingResult = {
      brand: 'Amazon', ourBuyRate: 80, ourSellRate: null, sellAvailable: false,
      unavailableReason: 'NO_PROFITABLE_QUOTE',
      costCents: 10000, profitMarginPercent: 8, marketRate: 87,
    };

    const res = await buy();

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.body)).toMatch(/PRICING_UNAVAILABLE|unavailable/i);
    const inserts = clientCalls.filter((c) => /INSERT INTO gift_card_requests/i.test(c.sql));
    expect(inserts).toHaveLength(0);
  });

  it('refuses an unsupported brand', async () => {
    pricingResult = {
      brand: 'NotARealBrand', ourBuyRate: null, ourSellRate: null, sellAvailable: false,
      unavailableReason: 'UNSUPPORTED_BRAND',
      costCents: 10000, profitMarginPercent: 8, marketRate: null,
    };

    const res = await buy({ brand: 'NotARealBrand' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(clientCalls.filter((c) => /INSERT INTO gift_card_requests/i.test(c.sql))).toHaveLength(0);
  });

  it('never debits a wallet when the quote is unavailable', async () => {
    pricingResult = {
      brand: 'Amazon', ourBuyRate: 80, ourSellRate: null, sellAvailable: false,
      unavailableReason: 'NO_PROFITABLE_QUOTE',
      costCents: 10000, profitMarginPercent: 8, marketRate: 87,
    };
    await buy();
    const debits = clientCalls.filter((c) => /UPDATE wallets/i.test(c.sql));
    expect(debits).toHaveLength(0);
  });

  it('never writes a NaN amount', async () => {
    pricingResult = {
      brand: 'Amazon', ourBuyRate: 80, ourSellRate: null, sellAvailable: false,
      costCents: 10000, profitMarginPercent: 8, marketRate: 87,
    };
    await buy();
    for (const c of clientCalls) {
      for (const p of c.params as unknown[]) {
        if (typeof p === 'number') expect(Number.isNaN(p)).toBe(false);
      }
    }
  });
});

describe('BUY still succeeds on a viable quote', () => {
  it('charges the server sell rate and ignores a client-supplied rate', async () => {
    const res = await buy({ rate: 1 });
    expect(res.status).toBe(201);
    const insert = clientCalls.find((c) => /INSERT INTO gift_card_requests/i.test(c.sql));
    expect(insert).toBeTruthy();
    // 93% of $100 = 9300 cents, never the client's rate=1 (100 cents).
    expect(insert!.params).toContain(93);
    expect(insert!.params).not.toContain(1);
  });
});
