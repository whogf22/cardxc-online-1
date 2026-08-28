/**
 * @vitest-environment node
 *
 * PRIOR OPEN GIFT-CARD BLOCKERS — behavioural (route-level) verification.
 *
 * A. Catalog pricing must never permit
 *      salePriceCents < authoritative provider acquisition cost.
 * B. Missing or STALE provider pricing must fail closed; an untrusted fallback
 *    rate must never be substituted for a purchasable catalog item.
 *
 * REPRODUCTION RESULT AGAINST THIS CANDIDATE: both invariants already hold.
 * `quoteBuyRate` clamps the customer rate UP to `cost + MIN_PROFIT_MARGIN` and
 * fails closed above face value, and `getProviderCostRate` returns null (never an
 * invented default) when the catalog is absent or the brand is unknown. The
 * arithmetic is already covered by giftCardPricingFloor.test.ts, which predates
 * this branch.
 *
 * What was NOT covered, and is added here, is the BEHAVIOURAL half:
 *  - the HTTP buy path actually refuses (503 PRICING_UNAVAILABLE) instead of
 *    charging, and debits NOTHING, when provider pricing is unavailable or stale
 *  - the amount actually DEBITED for a successful purchase is >= the provider
 *    acquisition cost recorded on the same request row
 *  - a client-supplied `rate` cannot lower the charge
 *
 * Gift-card purchasing is NOT enabled by these tests: no provider call is made
 * (the catalog loader and the Fluz client are stubbed) and no live request is
 * issued.
 *
 * Socket-free: driven in-process via invokeRouter (the sandbox forbids listen()).
 */
import { afterEach, vi, describe, it, expect } from 'vitest';
import { invokeRouter } from './_invoke';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockTransaction = vi.fn();
const mockLoadCatalog = vi.fn();

vi.mock('../../db/pool', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  transaction: (fn: unknown) => mockTransaction(fn),
}));
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _r: any, n: any) => { req.user = { id: 'user-1' }; n(); },
  AuthenticatedRequest: {},
}));
vi.mock('../../middleware/rateLimit', () => ({
  apiLimiter: (_q: any, _s: any, n: any) => n(),
  sensitiveOpLimiter: (_q: any, _s: any, n: any) => n(),
  financialOpLimiter: (_q: any, _s: any, n: any) => n(),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../services/auditService', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../services/fluzClient', () => ({
  isFluzConfigured: () => false,
  getFluzProducts: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../services/fluzApi', () => ({
  isConfigured: () => false,
  listOffers: vi.fn().mockResolvedValue([]),
}));
// The provider catalog is the authoritative acquisition-cost source. Stubbing it
// is how the stale/missing-provider case is driven; no network call is made.
vi.mock('../../services/fluzCatalogLoader', () => ({
  loadFluzCatalogFromCSV: (...a: unknown[]) => mockLoadCatalog(...a),
  catalogToGiftCards: () => [],
  getLogoDomain: () => undefined,
}));

/** A realistic catalog row: Fluz `rate` is the DISCOUNT, so cost = 100 - rate. */
const catalogRow = (name: string, discount: number) => ({
  name, slug: name.toLowerCase().replace(/\s+/g, '-'), rate: discount,
});

function wire(balanceCents = 1_000_000) {
  const executed: Array<{ sql: string; params: unknown[] }> = [];

  mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  mockQueryOne.mockResolvedValue(null);
  mockTransaction.mockImplementation(async (fn: any) => {
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        const flat = String(sql).replace(/\s+/g, ' ');
        executed.push({ sql: flat, params: params ?? [] });
        if (flat.includes('available_cents')) {
          return { rows: [{ available_cents: balanceCents }], rowCount: 1 };
        }
        if (flat.includes('SELECT usdt_balance_cents')) {
          return { rows: [{ usdt_balance_cents: balanceCents }], rowCount: 1 };
        }
        if (flat.includes('INSERT INTO gift_card_requests')) {
          return { rows: [{ id: 'gcr-1' }], rowCount: 1 };
        }
        // `INSERT INTO transactions ... RETURNING id` returns the row whose id
        // anchors the crypto ledger entry's FK (NEW-R4-1).
        if (flat.includes('INSERT INTO transactions')) {
          return { rows: [{ id: 'txn-1' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
    };
    return fn(client);
  });
  return executed;
}

async function loadRouter() {
  vi.resetModules();
  const mod = await import('../giftCards');
  return (mod as any).giftCardsRouter ?? (mod as any).default;
}

const buy = (router: any, body: Record<string, unknown>) =>
  invokeRouter(router, 'POST', '/requests', { body: { type: 'buy', currency: 'USD', ...body } });

const anyWalletDebit = (ex: Array<{ sql: string }>) =>
  ex.some(e => e.sql.includes('UPDATE wallets') || e.sql.includes('INSERT INTO wallets'));
const requestInsert = (ex: Array<{ sql: string; params: unknown[] }>) =>
  ex.find(e => e.sql.includes('INSERT INTO gift_card_requests'));

afterEach(() => {
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
  mockLoadCatalog.mockReset();
});

describe('B: missing or stale provider pricing fails closed at the ROUTE', () => {
  it('an EMPTY provider catalog refuses the purchase and debits nothing', async () => {
    mockLoadCatalog.mockReturnValue([]);
    const ex = wire();

    const res = await buy(await loadRouter(), { brand: 'Amazon', amount: 100 });

    expect(res.status).toBe(503);
    expect(res.body?.error?.code).toBe('PRICING_UNAVAILABLE');
    expect(anyWalletDebit(ex)).toBe(false);
    expect(requestInsert(ex)).toBeUndefined();
  });

  it('a provider catalog that FAILS TO LOAD refuses the purchase', async () => {
    mockLoadCatalog.mockImplementation(() => { throw new Error('catalog unavailable'); });
    const ex = wire();

    const res = await buy(await loadRouter(), { brand: 'Amazon', amount: 100 });

    expect(res.status).toBe(503);
    expect(res.body?.error?.code).toBe('PRICING_UNAVAILABLE');
    expect(anyWalletDebit(ex)).toBe(false);
  });

  it('a brand ABSENT from the provider catalog is refused — no fallback rate is substituted', async () => {
    // The catalog has other brands, just not this one. The hardcoded display
    // fallback list (sellRate: 93 etc.) must not become a purchasable price.
    mockLoadCatalog.mockReturnValue([catalogRow('Steam', 12)]);
    const ex = wire();

    const res = await buy(await loadRouter(), { brand: 'Amazon', amount: 100 });

    expect(res.status).toBe(503);
    expect(res.body?.error?.code).toBe('PRICING_UNAVAILABLE');
    expect(anyWalletDebit(ex)).toBe(false);
  });

  it('a MALFORMED provider discount is refused rather than costed as zero', async () => {
    mockLoadCatalog.mockReturnValue([{ name: 'Amazon', slug: 'amazon', rate: 'not-a-number' }]);
    const ex = wire();

    const res = await buy(await loadRouter(), { brand: 'Amazon', amount: 100 });

    expect(res.status).toBe(503);
    expect(anyWalletDebit(ex)).toBe(false);
  });

  it('an unsupported brand is refused even when the catalog names it', async () => {
    mockLoadCatalog.mockReturnValue([catalogRow('Totally Made Up Brand', 20)]);
    const ex = wire();

    const res = await buy(await loadRouter(), { brand: 'Totally Made Up Brand', amount: 100 });

    expect(res.status).toBe(503);
    expect(anyWalletDebit(ex)).toBe(false);
  });
});

describe('A: the charge never falls below the provider acquisition cost', () => {
  it('a realistic 12% discount yields a purchase whose charge exceeds recorded cost', async () => {
    // discount 12 -> provider cost = 88% of face value.
    mockLoadCatalog.mockReturnValue([catalogRow('Amazon', 12)]);
    const ex = wire();

    const res = await buy(await loadRouter(), { brand: 'Amazon', amount: 100 });

    expect(res.status).toBe(201);
    const insert = requestInsert(ex);
    expect(insert).toBeDefined();

    // gift_card_requests(..., rate, status, cost_cents, profit_cents, ...)
    // params: [userId, type, brand, amountCents, currency, rate, cost, profit, ...]
    const amountCents = Number(insert!.params[3]);
    const rate = Number(insert!.params[5]);
    const costCents = Number(insert!.params[6]);
    const profitCents = Number(insert!.params[7]);
    const chargedCents = Math.round(amountCents * (rate / 100));

    expect(amountCents).toBe(10_000);
    // The customer is charged at least what the card costs us.
    expect(chargedCents).toBeGreaterThanOrEqual(costCents);
    // And the recorded profit is not negative.
    expect(profitCents).toBeGreaterThanOrEqual(0);
  });

  it('a client-supplied rate cannot lower the charge below cost', async () => {
    mockLoadCatalog.mockReturnValue([catalogRow('Amazon', 12)]);
    const ex = wire();

    // Attempt to buy a $100 card for ~1% of face value.
    const res = await buy(await loadRouter(), { brand: 'Amazon', amount: 100, rate: 1 });

    expect(res.status).toBe(201);
    const insert = requestInsert(ex)!;
    const rate = Number(insert.params[5]);
    const costCents = Number(insert.params[6]);
    const chargedCents = Math.round(Number(insert.params[3]) * (rate / 100));

    expect(rate).not.toBe(1);
    expect(chargedCents).toBeGreaterThanOrEqual(costCents);
  });

  it('a thin provider discount that leaves no margin is refused rather than sold at a loss', async () => {
    // discount 1 -> cost 99. Floor = 99 + MIN_PROFIT_MARGIN > 100 (face value),
    // so there is no viable quote at or below face value.
    mockLoadCatalog.mockReturnValue([catalogRow('Amazon', 1)]);
    const ex = wire();

    const res = await buy(await loadRouter(), { brand: 'Amazon', amount: 100 });

    expect(res.status).toBe(503);
    expect(res.body?.error?.code).toBe('PRICING_UNAVAILABLE');
    expect(anyWalletDebit(ex)).toBe(false);
  });

  it('the WORST (highest-cost) catalog variant governs the price', async () => {
    // Two variants: 20% and 12% discount. Costing must use 88 (the worse one),
    // never 80, so the quote can never assume a better rate than guaranteed.
    mockLoadCatalog.mockReturnValue([catalogRow('Amazon', 20), catalogRow('Amazon', 12)]);
    const ex = wire();

    const res = await buy(await loadRouter(), { brand: 'Amazon', amount: 100 });

    expect(res.status).toBe(201);
    const insert = requestInsert(ex)!;
    const costCents = Number(insert.params[6]);
    // 88% of $100 = 8800c, not 8000c.
    expect(costCents).toBe(8_800);
  });
});
