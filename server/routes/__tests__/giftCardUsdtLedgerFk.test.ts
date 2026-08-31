/**
 * @vitest-environment node
 *
 * NEW-R4-1 — the USDT gift-card purchase anchors its crypto ledger entry to a
 * `gift_card_requests.id`, so on a real PostgreSQL server EVERY USDT gift-card
 * purchase aborts.
 *
 * `crypto_ledger_entries.source_transaction_id` is
 *   `UUID REFERENCES transactions(id) ON DELETE SET NULL`
 * (server/db/init.ts). The buy branch passed `rId` — the id returned by
 * `INSERT INTO gift_card_requests ... RETURNING id` — into that column.
 *
 * Two independent defects at the same site:
 *
 *  1. WRONG ID SPACE. `rId` is not a `transactions.id`, so the insert raises
 *     SQLSTATE 23503 and the whole `transaction()` rolls back. The customer sees
 *     a 500 and can never buy with USDT.
 *  2. WRONG ORDER. Even with the right id, the ledger insert ran BEFORE step 4's
 *     `INSERT INTO transactions`, and that insert had no `RETURNING id` — so the
 *     FK parent did not exist yet and its id was never captured. The child was
 *     written before the parent.
 *
 * Failing closed means no money is minted, but this is still a money defect: the
 * feature is unusable, and any future migration that drops the constraint would
 * silently start writing ledger rows keyed into the wrong table — corrupting
 * every crypto reconciliation that joins on `source_transaction_id`.
 *
 * WHY THE EXISTING SUITE MISSES IT: giftCardPricingRouteInvariant.test.ts returns
 * a bare `{rows: [], rowCount: 1}` for unrecognised INSERTs, which cannot express
 * a foreign key. `installFkAwarePool` below MODELS the constraint — it records the
 * ids `INSERT INTO transactions ... RETURNING id` actually produced and rejects a
 * ledger insert naming anything else, with `code = '23503'` as node-postgres does.
 *
 * INVARIANT PINNED HERE: a crypto ledger entry is anchored to the id of the
 * `transactions` row created for the SAME money movement, in the SAME atomic
 * unit, created BEFORE it — never to an id borrowed from another table.
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
vi.mock('../../services/fluzCatalogLoader', () => ({
  loadFluzCatalogFromCSV: (...a: unknown[]) => mockLoadCatalog(...a),
  catalogToGiftCards: () => [],
  getLogoDomain: () => undefined,
}));

/** A realistic catalog row: Fluz `rate` is the DISCOUNT, so cost = 100 - rate. */
const catalogRow = (name: string, discount: number) => ({
  name, slug: name.toLowerCase().replace(/\s+/g, '-'), rate: discount,
});

/** The `gift_card_requests.id` — NOT a legal FK target. */
const REQUEST_ID = 'gcr-11111111';
/** The id the `transactions` INSERT hands back — a DIFFERENT id space. */
const TRANSACTIONS_ID = 'txn-99999999';

type Stmt = { sql: string; params: unknown[] };

/** A transaction client that enforces the real FK on the ledger table. */
function installFkAwarePool(executed: Stmt[], balanceCents = 1_000_000) {
  /** Ids that genuinely exist in `transactions` — the only legal FK targets. */
  const transactionIds = new Set<string>();
  const ledgerRows: string[] = [];

  mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  mockQueryOne.mockResolvedValue(null);
  mockTransaction.mockImplementation(async (fn: any) => {
    const client = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        const flat = String(sql).replace(/\s+/g, ' ').trim();
        executed.push({ sql: flat, params });

        if (flat.includes('available_cents')) {
          return { rows: [{ available_cents: balanceCents }], rowCount: 1 };
        }
        if (flat.includes('SELECT usdt_balance_cents')) {
          return { rows: [{ usdt_balance_cents: balanceCents }], rowCount: 1 };
        }
        if (flat.includes('INSERT INTO gift_card_requests')) {
          return { rows: [{ id: REQUEST_ID }], rowCount: 1 };
        }
        if (flat.includes('INSERT INTO transactions')) {
          transactionIds.add(TRANSACTIONS_ID);
          return { rows: [{ id: TRANSACTIONS_ID }], rowCount: 1 };
        }
        if (flat.includes('INSERT INTO crypto_ledger_entries')) {
          const fk = params[1] === null || params[1] === undefined ? null : String(params[1]);
          if (fk !== null && !transactionIds.has(fk)) {
            const err: any = new Error(
              'insert or update on table "crypto_ledger_entries" violates foreign key constraint "crypto_ledger_entries_source_transaction_id_fkey"',
            );
            err.code = '23503';
            err.constraint = 'crypto_ledger_entries_source_transaction_id_fkey';
            throw err;
          }
          if (fk !== null && ledgerRows.includes(fk)) {
            // uniq_crypto_ledger_source_transaction (R3-8).
            if (/ON CONFLICT\s*\(\s*source_transaction_id\s*\)\s*DO NOTHING/i.test(flat)) {
              return { rows: [], rowCount: 0 };
            }
            const err: any = new Error('duplicate key value violates unique constraint "uniq_crypto_ledger_source_transaction"');
            err.code = '23505';
            err.constraint = 'uniq_crypto_ledger_source_transaction';
            throw err;
          }
          if (fk !== null) ledgerRows.push(fk);
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
    };
    return fn(client);
  });
}

async function loadRouter() {
  vi.resetModules();
  const mod = await import('../giftCards');
  return (mod as any).giftCardsRouter ?? (mod as any).default;
}

const buyUsdt = (router: any) =>
  invokeRouter(router, 'POST', '/requests', {
    body: { type: 'buy', currency: 'USD', brand: 'Amazon', amount: 100, paymentMethod: 'usdt' },
  });
const buyFiat = (router: any) =>
  invokeRouter(router, 'POST', '/requests', {
    body: { type: 'buy', currency: 'USD', brand: 'Amazon', amount: 100 },
  });

const ledgerInsert = (ex: Stmt[]) => ex.find((e) => e.sql.includes('INSERT INTO crypto_ledger_entries'));
const usdtDebit = (ex: Stmt[]) =>
  ex.filter((e) => /usdt_balance_cents\s*=\s*usdt_balance_cents\s*-/i.test(e.sql));

afterEach(() => {
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
  mockLoadCatalog.mockReset();
});

describe('NEW-R4-1: a USDT gift-card purchase actually completes', () => {
  it('does not fail on the crypto ledger foreign key', async () => {
    mockLoadCatalog.mockReturnValue([catalogRow('Amazon', 12)]);
    const ex: Stmt[] = [];
    installFkAwarePool(ex);

    // Before the fix the ledger insert raises 23503 and the whole purchase
    // rolls back with a 500.
    const res = await buyUsdt(await loadRouter());

    expect(res.status).toBe(201);
    expect(res.body?.data?.requestId).toBe(REQUEST_ID);
  });

  it('debits USDT exactly once and writes exactly one ledger entry', async () => {
    mockLoadCatalog.mockReturnValue([catalogRow('Amazon', 12)]);
    const ex: Stmt[] = [];
    installFkAwarePool(ex);

    await buyUsdt(await loadRouter());

    expect(usdtDebit(ex)).toHaveLength(1);
    expect(ex.filter((e) => e.sql.includes('INSERT INTO crypto_ledger_entries'))).toHaveLength(1);
  });
});

describe('NEW-R4-1: the ledger entry is anchored to the transactions row', () => {
  it('passes the id returned by the transactions INSERT, not the gift_card_requests id', async () => {
    mockLoadCatalog.mockReturnValue([catalogRow('Amazon', 12)]);
    const ex: Stmt[] = [];
    installFkAwarePool(ex);

    await buyUsdt(await loadRouter());

    const ledger = ledgerInsert(ex);
    expect(ledger).toBeDefined();
    expect(ledger!.params[1]).toBe(TRANSACTIONS_ID);
    expect(ledger!.params[1]).not.toBe(REQUEST_ID);
  });

  it('creates the transactions row BEFORE the ledger entry that references it', async () => {
    mockLoadCatalog.mockReturnValue([catalogRow('Amazon', 12)]);
    const ex: Stmt[] = [];
    installFkAwarePool(ex);

    await buyUsdt(await loadRouter());

    const txIdx = ex.findIndex((e) => e.sql.includes('INSERT INTO transactions'));
    const ledgerIdx = ex.findIndex((e) => e.sql.includes('INSERT INTO crypto_ledger_entries'));
    expect(txIdx).toBeGreaterThanOrEqual(0);
    expect(ledgerIdx).toBeGreaterThan(txIdx);
  });

  it('the transactions INSERT returns its id rather than discarding it', async () => {
    mockLoadCatalog.mockReturnValue([catalogRow('Amazon', 12)]);
    const ex: Stmt[] = [];
    installFkAwarePool(ex);

    await buyUsdt(await loadRouter());

    const txInsert = ex.find((e) => e.sql.includes('INSERT INTO transactions'));
    expect(txInsert!.sql).toMatch(/RETURNING id/i);
  });

  it('records the spend as a NEGATIVE ledger amount for the paying user', async () => {
    mockLoadCatalog.mockReturnValue([catalogRow('Amazon', 12)]);
    const ex: Stmt[] = [];
    installFkAwarePool(ex);

    await buyUsdt(await loadRouter());

    const ledger = ledgerInsert(ex)!;
    const debited = Number(usdtDebit(ex)[0].params[0]);
    expect(ledger.params[0]).toBe('user-1');
    // The ledger amount mirrors the debit, as an outflow.
    expect(ledger.params[2]).toBe(-debited);
    expect(ledger.params[3]).toBe(-debited);
  });

  it('the ledger insert absorbs a duplicate rather than aborting the purchase', async () => {
    mockLoadCatalog.mockReturnValue([catalogRow('Amazon', 12)]);
    const ex: Stmt[] = [];
    installFkAwarePool(ex);

    await buyUsdt(await loadRouter());

    // R3-8 added uniq_crypto_ledger_source_transaction. Every writer must name
    // that arbiter, or a replay is an uncaught 23505 instead of a no-op.
    expect(ledgerInsert(ex)!.sql).toMatch(/ON CONFLICT\s*\(\s*source_transaction_id\s*\)\s*DO NOTHING/i);
  });
});

describe('NEW-R4-1: the fiat path is unchanged', () => {
  it('a fiat purchase still succeeds and writes NO crypto ledger entry', async () => {
    mockLoadCatalog.mockReturnValue([catalogRow('Amazon', 12)]);
    const ex: Stmt[] = [];
    installFkAwarePool(ex);

    const res = await buyFiat(await loadRouter());

    expect(res.status).toBe(201);
    expect(ledgerInsert(ex)).toBeUndefined();
    expect(usdtDebit(ex)).toHaveLength(0);
  });

  it('an insufficient USDT balance is refused with no ledger entry and no transaction row', async () => {
    mockLoadCatalog.mockReturnValue([catalogRow('Amazon', 12)]);
    const ex: Stmt[] = [];
    installFkAwarePool(ex, 1);

    const res = await buyUsdt(await loadRouter());

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('INSUFFICIENT_USDT_BALANCE');
    expect(ledgerInsert(ex)).toBeUndefined();
    expect(ex.some((e) => e.sql.includes('INSERT INTO transactions'))).toBe(false);
  });
});
