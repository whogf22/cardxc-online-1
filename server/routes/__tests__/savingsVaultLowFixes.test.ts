/**
 * @vitest-environment node
 *
 * CONFIRMED LOW items on the savings vault routes.
 *
 * 1. Ownership was enforced only in JS on the withdraw path. The guarded debit
 *    read:
 *
 *      UPDATE savings_vaults SET balance_cents = balance_cents - $1
 *       WHERE id = $2 AND balance_cents >= $1        -- no user_id
 *
 *    Reachability was gated by the out-of-transaction pre-read, so it was not
 *    directly exploitable — but it is the same JS-vs-SQL ownership pattern that
 *    CRITICAL-1 was filed for, sitting 30 lines above the hardened DELETE. The
 *    credit also used `vault.currency` from that stale pre-read.
 *
 * 2. `DELETE /vaults/:id` passed `req.params.id` straight into a uuid column with
 *    no validation, so a malformed id raised Postgres 22P02 and surfaced as a 500
 *    (and potentially leaked a PG message) instead of a clean 400/404.
 *
 * Socket-free: driven in-process via invokeRouter (the sandbox forbids listen()).
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

const VAULT_ID = '44444444-4444-4444-8444-444444444444';

function wire(opts: { debitRowCount?: number } = {}) {
  const { debitRowCount = 1 } = opts;
  const executed: Array<{ sql: string; params: unknown[] }> = [];

  mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  mockQueryOne.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM savings_vaults')) {
      return { id: VAULT_ID, balance_cents: 50_000, currency: 'USD', name: 'V', target_cents: 100_000 };
    }
    return null;
  });
  mockTransaction.mockImplementation(async (fn: any) => {
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        const flat = String(sql).replace(/\s+/g, ' ');
        executed.push({ sql: flat, params: params ?? [] });
        if (flat.includes('UPDATE savings_vaults')) {
          return { rows: debitRowCount ? [{ currency: 'USD' }] : [], rowCount: debitRowCount };
        }
        if (flat.includes('DELETE FROM savings_vaults')) {
          return { rows: [{ balance_cents: 50_000, currency: 'USD' }], rowCount: 1 };
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

const vaultDebit = (ex: Array<{ sql: string; params: unknown[] }>) =>
  ex.find(e => e.sql.includes('UPDATE savings_vaults') && e.sql.includes('balance_cents = balance_cents - $1'));

afterEach(() => {
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
});

describe('LOW: vault withdrawal enforces ownership in SQL', () => {
  it('the guarded debit predicate includes user_id, not just the JS pre-check', async () => {
    const ex = wire();
    const res = await invokeRouter(await loadRouter(), 'POST', `/vaults/${VAULT_ID}/withdraw`, {
      body: { amount: 100 },
    });

    expect(res.status).toBe(200);
    const debit = vaultDebit(ex);
    expect(debit).toBeDefined();
    expect(debit!.sql).toMatch(/user_id\s*=\s*\$\d/);
    expect(debit!.params).toContain('user-1');
  });

  it('a 0-row debit (not owned, or drained concurrently) aborts with no wallet credit', async () => {
    const ex = wire({ debitRowCount: 0 });
    const res = await invokeRouter(await loadRouter(), 'POST', `/vaults/${VAULT_ID}/withdraw`, {
      body: { amount: 100 },
    });

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('INSUFFICIENT_BALANCE');
    expect(ex.some(e => e.sql.includes('INSERT INTO wallets'))).toBe(false);
  });

  it('credits the currency RETURNED by the guarded debit, not the stale pre-read', async () => {
    const ex = wire();
    await invokeRouter(await loadRouter(), 'POST', `/vaults/${VAULT_ID}/withdraw`, {
      body: { amount: 100 },
    });

    const debit = vaultDebit(ex);
    expect(debit!.sql).toMatch(/RETURNING/i);
  });

  it('rejects a malformed vault id with 400, not a Postgres 500', async () => {
    wire();
    const res = await invokeRouter(await loadRouter(), 'POST', '/vaults/not-a-uuid/withdraw', {
      body: { amount: 100 },
    });

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('VALIDATION_ERROR');
  });
});

describe('LOW: DELETE /vaults/:id validates the id', () => {
  it('accepts a well-formed uuid', async () => {
    wire();
    const res = await invokeRouter(await loadRouter(), 'DELETE', `/vaults/${VAULT_ID}`);
    expect(res.status).toBe(200);
  });

  it('rejects a malformed id with 400 before touching the database', async () => {
    const ex = wire();
    const res = await invokeRouter(await loadRouter(), 'DELETE', '/vaults/not-a-uuid');

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('VALIDATION_ERROR');
    // No DELETE was attempted, so Postgres never raised 22P02.
    expect(ex.some(e => e.sql.includes('DELETE FROM savings_vaults'))).toBe(false);
  });

  it('rejects a SQL-ish id with 400', async () => {
    const res = await invokeRouter(await loadRouter(), 'DELETE', "/vaults/1' OR '1'='1");
    expect(res.status).toBe(400);
  });
});
