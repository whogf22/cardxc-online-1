/**
 * @vitest-environment node
 *
 * PHASE 6 — the deliberately-deferred savings vault deposit finding.
 *
 * `POST /vaults/:id/deposit` was the one vault route left without path-id
 * validation after withdraw and delete were hardened. It passes `req.params.id`
 * straight into `WHERE id = $1` on a `uuid` column, so a malformed value makes
 * Postgres raise
 *
 *     22P02  invalid input syntax for type uuid: "not-a-uuid"
 *
 * which surfaces as an unhandled 500 rather than a controlled 4xx, and can leak
 * the Postgres message (including the rejected value) through the error handler.
 *
 * Second, smaller issue on the same route: the vault credit
 *
 *     UPDATE savings_vaults SET balance_cents = balance_cents + $1 WHERE id = $2
 *
 * carries no `user_id`, so ownership rests solely on the out-of-transaction
 * pre-read — the same JS-vs-SQL ownership pattern that was fixed on the withdraw
 * and delete paths. Lower impact than the withdraw case (it credits rather than
 * debits a vault), but it is the same class and the same file.
 *
 * Socket-free: driven in-process via invokeRouter (the sandbox forbids listen(),
 * for TCP and Unix sockets alike).
 */
import { afterEach, vi, describe, it, expect } from 'vitest';
import { invokeRouter } from './_invoke';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockTransaction = vi.fn();

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

const VAULT_ID = '55555555-5555-4555-8555-555555555555';

/**
 * Emulate Postgres rejecting a malformed uuid literal. This is what makes the
 * test behavioural rather than a source grep: without validation the route
 * reaches the query and the driver error escapes as a 500.
 */
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
function pgUuidCheck(value: unknown) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    const err: any = new Error(`invalid input syntax for type uuid: "${String(value)}"`);
    err.code = '22P02';
    throw err;
  }
}

function wire(opts: { debitRowCount?: number } = {}) {
  const { debitRowCount = 1 } = opts;
  const executed: Array<{ sql: string; params: unknown[] }> = [];

  mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  mockQueryOne.mockImplementation(async (sql: string, params?: unknown[]) => {
    const s = String(sql);
    if (s.includes('FROM savings_vaults')) {
      // The uuid column rejects a malformed literal before any row is returned.
      pgUuidCheck(params?.[0]);
      return { id: VAULT_ID, currency: 'USD', name: 'V', target_cents: 100_000, balance_cents: 0 };
    }
    if (s.includes('FROM wallets')) return { balance_cents: 1_000_000 };
    return null;
  });
  mockTransaction.mockImplementation(async (fn: any) => {
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        const flat = String(sql).replace(/\s+/g, ' ');
        executed.push({ sql: flat, params: params ?? [] });
        if (flat.includes('UPDATE wallets')) {
          return { rows: [], rowCount: debitRowCount };
        }
        if (flat.includes('UPDATE savings_vaults')) {
          pgUuidCheck(params?.[1]);
          return { rows: [], rowCount: 1 };
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
  const mod = await import('../savings');
  return (mod as any).savingsRouter ?? (mod as any).default;
}

const deposit = (router: any, id: string, amount = 100) =>
  invokeRouter(router, 'POST', `/vaults/${id}/deposit`, { body: { amount } });

const vaultCredit = (ex: Array<{ sql: string; params: unknown[] }>) =>
  ex.find(e => e.sql.includes('UPDATE savings_vaults') && e.sql.includes('balance_cents = balance_cents + $1'));

afterEach(() => {
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
});

describe('PHASE 6: POST /vaults/:id/deposit validates the path id', () => {
  it('a well-formed uuid still works', async () => {
    wire();
    const res = await deposit(await loadRouter(), VAULT_ID);
    expect(res.status).toBe(200);
  });

  it('a malformed id returns a controlled 400, not a Postgres 500', async () => {
    wire();
    const res = await deposit(await loadRouter(), 'not-a-uuid');

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('VALIDATION_ERROR');
  });

  it('the rejection happens BEFORE any database call, so 22P02 is never raised', async () => {
    const ex = wire();
    const res = await deposit(await loadRouter(), 'not-a-uuid');

    expect(res.status).toBe(400);
    // No transaction was opened and no vault credit was attempted.
    expect(ex.length).toBe(0);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('no Postgres error text leaks into the response', async () => {
    wire();
    const res = await deposit(await loadRouter(), 'not-a-uuid');

    const body = JSON.stringify(res.body ?? {});
    expect(body).not.toMatch(/invalid input syntax/i);
    expect(body).not.toMatch(/22P02/);
    expect(body).not.toMatch(/uuid:/i);
  });

  it('rejects a SQL-ish id', async () => {
    const res = await deposit(await loadRouter(), "1' OR '1'='1");
    expect(res.status).toBe(400);
  });

  it('rejects a UUID-shaped but non-RFC-4122 id consistently with the sibling routes', async () => {
    // Variant nibble '2' — not a valid RFC-4122 UUID. The withdraw and delete
    // routes already reject this; deposit must agree.
    const res = await deposit(await loadRouter(), '22222222-2222-2222-2222-222222222222');
    expect(res.status).toBe(400);
  });
});

describe('PHASE 6: the vault credit enforces ownership in SQL', () => {
  it('the credit predicate includes user_id, not just the JS pre-read', async () => {
    const ex = wire();
    const res = await deposit(await loadRouter(), VAULT_ID);

    expect(res.status).toBe(200);
    const credit = vaultCredit(ex);
    expect(credit).toBeDefined();
    expect(credit!.sql).toMatch(/user_id\s*=\s*\$\d/);
    expect(credit!.params).toContain('user-1');
  });

  it('a 0-row wallet debit aborts before the vault is credited', async () => {
    const ex = wire({ debitRowCount: 0 });
    const res = await deposit(await loadRouter(), VAULT_ID);

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('INSUFFICIENT_BALANCE');
    expect(vaultCredit(ex)).toBeUndefined();
  });
});
