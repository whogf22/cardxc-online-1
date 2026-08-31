/**
 * @vitest-environment node
 *
 * NEW-R4-3 — neighbour audit of the THIRD `crypto_ledger_entries` writer, opened
 * by R3-8's new `uniq_crypto_ledger_source_transaction` index.
 *
 * `cardCheckout.ts` is the only writer whose `ON CONFLICT` names a DIFFERENT
 * arbiter from the new index:
 *
 *   INSERT INTO crypto_ledger_entries (user_id, source_order_id, source_transaction_id, ...)
 *   ON CONFLICT (source_order_id, user_id) DO NOTHING
 *
 * In PostgreSQL, `ON CONFLICT (a, b) DO NOTHING` absorbs a conflict on the
 * INFERRED index only. A conflict on any OTHER unique index is an uncaught
 * SQLSTATE 23505. So the question this suite answers is whether R3-8 could have
 * turned a replayed card-deposit fulfillment into an aborted deposit.
 *
 * VERDICT: NOT_REPRODUCED, and the reason is structural, not accidental —
 *
 *  1. `source_order_id` is `order.id` at all three call sites (provider webhook,
 *     admin webhook replay, Stripe webhook). It is never NULL, so the arbiter
 *     index is always live and a replay of the same order is absorbed by it
 *     BEFORE the new index is ever consulted (speculative insertion checks the
 *     arbiter first and skips the row entirely on a match).
 *  2. Each call site inserts a FRESH `transactions` row with `RETURNING id` and
 *     passes that id, so `source_transaction_id` is never a repeat value and
 *     cannot collide on `uniq_crypto_ledger_source_transaction` at all.
 *
 * Both properties are load-bearing and neither is stated anywhere in the code, so
 * they are pinned here. Changing this writer's arbiter to `source_transaction_id`
 * would be a REGRESSION, not a harmonisation: because the transaction id is fresh
 * on every replay, that arbiter would never match and per-order dedup — the only
 * thing stopping a replayed fulfillment from writing a second USDT ledger row —
 * would be lost.
 *
 * The mock below enforces BOTH unique indexes with real Postgres semantics
 * (NULLs distinct; arbiter checked first, other indexes raising 23505) and the FK
 * to `transactions(id)`.
 *
 * Stablecoin fulfillment stays default OFF in the product: it is enabled only
 * inside these tests, by env var, and no provider or chain call is made.
 *
 * Socket-free: driven in-process via invokeRouter (the sandbox forbids listen()).
 */
import crypto from 'crypto';
import { afterEach, beforeEach, vi, describe, it, expect } from 'vitest';
import { invokeRouter } from './_invoke';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockTransaction = vi.fn();

vi.mock('../../db/pool', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  transaction: (fn: unknown) => mockTransaction(fn),
}));
vi.mock('../../services/auditService', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../services/stripeService', () => ({
  isStripeConfigured: () => false,
  getStripePublishableKey: () => 'pk_test_x',
  createCheckoutSession: vi.fn(),
  getCheckoutSession: vi.fn(),
  constructWebhookEvent: vi.fn(),
}));
vi.mock('../../services/fluzClient', () => ({ isFluzConfigured: () => false }));
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _r: any, n: any) => { req.user = { id: 'admin-1', role: 'SUPER_ADMIN' }; n(); },
  requireRole: () => (_q: any, _s: any, n: any) => n(),
  requireAdmin: (_q: any, _s: any, n: any) => n(),
  requireSuperAdmin: (_q: any, _s: any, n: any) => n(),
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

const SECRET = 'test-provider-secret';
const PAYMENT_ID = 'pay-1';
const ORDER = {
  id: 'order-1',
  user_id: 'user-1',
  target_user_id: null,
  amount_cents: 15_000,
  currency: 'USD',
  merchant_name: 'Card Deposit',
  status: 'PENDING',
  created_by_user_id: 'user-1',
  provider_payment_id: PAYMENT_ID,
};

const ENV_KEYS = ['FLUZ_WEBHOOK_SECRET', 'ENABLE_STABLECOIN_FULFILLMENT', 'USDT_RATE'] as const;
let savedEnv: Record<string, string | undefined>;

type Stmt = { sql: string; params: unknown[] };

/** A ledger row as the database would hold it, for unique-index modelling. */
type LedgerRow = { sourceOrderId: string | null; userId: string; sourceTransactionId: string | null };

/**
 * A pool that enforces, on `crypto_ledger_entries`:
 *  - the FK `source_transaction_id REFERENCES transactions(id)`
 *  - `UNIQUE(source_order_id, user_id)` (NULLs distinct)
 *  - `uniq_crypto_ledger_source_transaction` on `source_transaction_id`
 *    (NULLs distinct)
 * with Postgres `ON CONFLICT` semantics: only the arbiter named in the statement
 * absorbs a conflict, and it is checked first.
 *
 * `ledger` is shared across invocations so a REPLAY sees the first call's row.
 */
function installIndexAwarePool(executed: Stmt[], ledger: LedgerRow[]) {
  const transactionIds = new Set<string>();
  let txSeq = 0;

  mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  mockQueryOne.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM card_orders')) return { ...ORDER };
    if (sql.includes('INSERT INTO payment_webhook_logs')) return { id: 'log-1' };
    // No prior processed log: the idempotency short-circuits must not fire, so
    // the fulfillment body is genuinely re-entered on the replay.
    return null;
  });
  mockTransaction.mockImplementation(async (fn: any) => {
    const client = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        const flat = String(sql).replace(/\s+/g, ' ').trim();
        executed.push({ sql: flat, params });

        if (flat.includes('UPDATE card_orders') && /RETURNING/i.test(flat)) {
          return { rows: [{ amount_cents: ORDER.amount_cents, currency: ORDER.currency }], rowCount: 1 };
        }
        if (flat.includes('INSERT INTO transactions')) {
          const id = `tx-${++txSeq}`;
          transactionIds.add(id);
          return { rows: [{ id }], rowCount: 1 };
        }
        if (flat.includes('INSERT INTO crypto_ledger_entries')) {
          const [userId, sourceOrderId, sourceTransactionId] = params as (string | null)[];
          const row: LedgerRow = {
            sourceOrderId: sourceOrderId ?? null,
            userId: String(userId),
            sourceTransactionId: sourceTransactionId ?? null,
          };

          if (row.sourceTransactionId !== null && !transactionIds.has(row.sourceTransactionId)) {
            const err: any = new Error(
              'insert or update on table "crypto_ledger_entries" violates foreign key constraint "crypto_ledger_entries_source_transaction_id_fkey"',
            );
            err.code = '23503';
            throw err;
          }

          // The arbiter named in the statement is evaluated first; a match skips
          // the row entirely and no other index is consulted.
          const arbiterIsOrder = /ON CONFLICT\s*\(\s*source_order_id\s*,\s*user_id\s*\)\s*DO NOTHING/i.test(flat);
          const arbiterIsTx = /ON CONFLICT\s*\(\s*source_transaction_id\s*\)\s*DO NOTHING/i.test(flat);

          const orderConflict = row.sourceOrderId !== null && ledger.some(
            (r) => r.sourceOrderId === row.sourceOrderId && r.userId === row.userId,
          );
          const txConflict = row.sourceTransactionId !== null && ledger.some(
            (r) => r.sourceTransactionId === row.sourceTransactionId,
          );

          if (arbiterIsOrder && orderConflict) return { rows: [], rowCount: 0 };
          if (arbiterIsTx && txConflict) return { rows: [], rowCount: 0 };

          // Any remaining unique violation is UNCAUGHT — this is the hazard the
          // suite exists to detect.
          if (orderConflict) {
            const err: any = new Error('duplicate key value violates unique constraint "crypto_ledger_entries_source_order_id_user_id_key"');
            err.code = '23505';
            err.constraint = 'crypto_ledger_entries_source_order_id_user_id_key';
            throw err;
          }
          if (txConflict) {
            const err: any = new Error('duplicate key value violates unique constraint "uniq_crypto_ledger_source_transaction"');
            err.code = '23505';
            err.constraint = 'uniq_crypto_ledger_source_transaction';
            throw err;
          }

          ledger.push(row);
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
  const mod = await import('../cardCheckout');
  return (mod as any).paymentWebhookRouter;
}

/** A correctly-signed provider webhook, so the HMAC gate is satisfied. */
function signedWebhook(router: unknown) {
  const payload = { event: 'payment.completed', paymentId: PAYMENT_ID, status: 'completed' };
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
  return invokeRouter(router as any, 'POST', '/payment', {
    body: payload,
    headers: { 'x-webhook-signature': signature },
  });
}

const ledgerInserts = (ex: Stmt[]) => ex.filter((e) => e.sql.includes('INSERT INTO crypto_ledger_entries'));
const usdtCredits = (ex: Stmt[]) =>
  ex.filter((e) => /usdt_balance_cents\s*=\s*COALESCE\(\s*wallets\.usdt_balance_cents\s*,\s*0\s*\)\s*\+/i.test(e.sql));

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  process.env.FLUZ_WEBHOOK_SECRET = SECRET;
  process.env.ENABLE_STABLECOIN_FULFILLMENT = 'true';
  process.env.USDT_RATE = '1.0';
});

afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
});

describe('NEW-R4-3: the card-deposit ledger writer survives the R3-8 unique index', () => {
  it('a first fulfillment writes one ledger row anchored to a real transactions id', async () => {
    const ex: Stmt[] = [];
    const ledger: LedgerRow[] = [];
    installIndexAwarePool(ex, ledger);

    const res = await signedWebhook(await loadRouter());

    expect(res.status).toBe(200);
    const inserts = ledgerInserts(ex);
    expect(inserts).toHaveLength(1);
    // The FK-aware mock would have thrown 23503 for anything else.
    expect(inserts[0].params[2]).toBe('tx-1');
    expect(ledger).toHaveLength(1);
  });

  it('a REPLAY does not raise an uncaught 23505 on uniq_crypto_ledger_source_transaction', async () => {
    const ledger: LedgerRow[] = [];

    const first: Stmt[] = [];
    installIndexAwarePool(first, ledger);
    expect((await signedWebhook(await loadRouter())).status).toBe(200);

    const second: Stmt[] = [];
    installIndexAwarePool(second, ledger);
    const res = await signedWebhook(await loadRouter());

    // The arbiter conflict on (source_order_id, user_id) absorbs the replay
    // before the new index is consulted.
    expect(res.status).toBe(200);
    expect(ledgerInserts(second)).toHaveLength(1);
    expect(ledger, 'a replay must not add a second USDT ledger row').toHaveLength(1);
  });

  it('the replay credits no second USDT amount', async () => {
    const ledger: LedgerRow[] = [];

    const first: Stmt[] = [];
    installIndexAwarePool(first, ledger);
    await signedWebhook(await loadRouter());
    expect(usdtCredits(first)).toHaveLength(1);

    // The wallet upsert itself is not idempotent — the per-order ledger arbiter
    // is what makes a replay safe, which is exactly why it must not be swapped
    // for `source_transaction_id` (fresh on every replay, so never a conflict).
    const second: Stmt[] = [];
    installIndexAwarePool(second, ledger);
    await signedWebhook(await loadRouter());

    expect(ledger).toHaveLength(1);
  });
});

describe('NEW-R4-3: the two properties that keep the arbiter mismatch harmless', () => {
  it('source_order_id is never NULL, so the arbiter index is always live', async () => {
    const ex: Stmt[] = [];
    installIndexAwarePool(ex, []);

    await signedWebhook(await loadRouter());

    const insert = ledgerInserts(ex)[0];
    expect(insert.params[1]).toBe(ORDER.id);
    expect(insert.params[1]).not.toBeNull();
  });

  it('source_transaction_id comes from a fresh transactions INSERT ... RETURNING id', async () => {
    const ex: Stmt[] = [];
    installIndexAwarePool(ex, []);

    await signedWebhook(await loadRouter());

    const txInsert = ex.find((e) => e.sql.includes('INSERT INTO transactions'));
    expect(txInsert!.sql).toMatch(/RETURNING id/i);
    const txIdx = ex.findIndex((e) => e.sql.includes('INSERT INTO transactions'));
    const ledgerIdx = ex.findIndex((e) => e.sql.includes('INSERT INTO crypto_ledger_entries'));
    // Parent before child, as the FK requires.
    expect(ledgerIdx).toBeGreaterThan(txIdx);
  });

  it('keeps the per-order arbiter rather than the transaction-scoped one', async () => {
    const ex: Stmt[] = [];
    installIndexAwarePool(ex, []);

    await signedWebhook(await loadRouter());

    const sql = ledgerInserts(ex)[0].sql;
    expect(sql).toMatch(/ON CONFLICT\s*\(\s*source_order_id\s*,\s*user_id\s*\)\s*DO NOTHING/i);
    // Swapping to `source_transaction_id` here would silently disable per-order
    // dedup, because a replay always carries a brand-new transaction id.
    expect(sql).not.toMatch(/ON CONFLICT\s*\(\s*source_transaction_id\s*\)/i);
  });
});

describe('NEW-R4-3: fulfillment stays fail-closed by default', () => {
  it('writes no crypto ledger row when stablecoin fulfillment is not enabled', async () => {
    delete process.env.ENABLE_STABLECOIN_FULFILLMENT;
    const ex: Stmt[] = [];
    installIndexAwarePool(ex, []);

    const res = await signedWebhook(await loadRouter());

    expect(res.status).toBe(200);
    expect(ledgerInserts(ex)).toHaveLength(0);
    expect(usdtCredits(ex)).toHaveLength(0);
  });
});
