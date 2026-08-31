/**
 * @vitest-environment node
 *
 * MEDIUM — admin balance adjustments must not drive a wallet below zero.
 *
 * Both the auto-approve path (POST /api/admin/adjustments as SUPER_ADMIN) and
 * the two-step approval (POST /api/admin/adjustments/:id/approve) applied a
 * debit as an unconditional upsert:
 *
 *   INSERT INTO wallets (...) VALUES (...,$3)
 *   ON CONFLICT DO UPDATE SET balance_cents = wallets.balance_cents + $3
 *
 * with $3 = -amountCents. Nothing stopped the balance from going negative, and
 * the INSERT branch could even seed a brand-new wallet at a negative balance.
 *
 * Invariant: a debit may only ever reduce an existing, sufficient balance. An
 * over-debit must fail with INSUFFICIENT_BALANCE and write nothing.
 *
 * Socket-free: driven in-process via invokeRouter (the sandbox forbids listen()).
 */
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
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _r: any, n: any) => {
    req.user = { id: 'admin-1', email: 'admin@test.com', role: 'SUPER_ADMIN' };
    n();
  },
  requireRole: () => (_q: any, _s: any, n: any) => n(),
  AuthenticatedRequest: {},
}));
vi.mock('../../middleware/rateLimit', () => ({
  getRateLimitViolations: vi.fn(), clearRateLimitViolations: vi.fn(),
  sensitiveOpLimiter: (_q: any, _s: any, n: any) => n(),
  financialOpLimiter: (_q: any, _s: any, n: any) => n(),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../services/auditService', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  getAuditLogs: vi.fn(), exportAuditLogsToCSV: vi.fn(),
}));
vi.mock('../../services/fraudService', () => ({ getFraudFlags: vi.fn() }));
vi.mock('../../services/stripeService', () => ({ isStripeConfigured: () => false, createPaymentIntent: vi.fn(), getPaymentIntent: vi.fn() }));
vi.mock('../../services/fluzClient', () => ({ isFluzConfigured: () => false }));
vi.mock('../../middleware/securityLogger', () => ({ getSecurityEvents: vi.fn(), getSecurityEventsByType: vi.fn(), getSecurityEventsByIP: vi.fn() }));

const USER_ID = '22222222-2222-4222-8222-222222222222';
const ADJ_ID = '33333333-3333-4333-8333-333333333333';

interface WireOpts {
  /** Available USD balance in cents that the guarded debit checks against. */
  availableCents: number;
  /** For the approve route: the pending adjustment to return. */
  adjustment?: { type: 'credit' | 'debit'; amount_cents: number };
}

/** The adjustment row this fixture describes, as the DB would hold it. */
const adjustmentRow = (opts: WireOpts) => ({
  id: ADJ_ID, user_id: USER_ID, currency: 'USD', status: 'PENDING',
  reason: 'test reason long enough',
  ...(opts.adjustment ?? { type: 'debit' as const, amount_cents: 0 }),
});

/**
 * Wire db mocks. The transaction client models the guarded debit
 * (`UPDATE wallets ... WHERE balance_cents >= $1`) by matching 1 row only when
 * `availableCents >= debitAmount`, and 0 rows otherwise — exactly what Postgres
 * would do under the fixed predicate.
 */
function wire(opts: WireOpts): Array<{ sql: string; params: unknown[] }> {
  const executed: Array<{ sql: string; params: unknown[] }> = [];

  mockQueryOne.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM users')) return { id: USER_ID };
    if (sql.includes('FROM admin_adjustments')) return adjustmentRow(opts);
    return null;
  });
  mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });

  mockTransaction.mockImplementation(async (fn: any) => {
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        const flat = String(sql).replace(/\s+/g, ' ');
        executed.push({ sql: flat, params: params ?? [] });
        if (flat.includes('INSERT INTO admin_adjustments')) return { rows: [{ id: ADJ_ID }], rowCount: 1 };
        // R3-7: the approve path now claims the adjustment atomically with
        // `UPDATE admin_adjustments ... WHERE status = 'PENDING' RETURNING ...` and
        // drives every money statement from the RETURNED row. Model the claim as
        // won so the debit-floor assertions below still see this fixture's amount.
        if (flat.includes('UPDATE admin_adjustments')) {
          return { rows: [{ ...adjustmentRow(opts), status: 'APPROVED' }], rowCount: 1 };
        }
        // Guarded debit: only affects a row when the AVAILABLE balance is
        // sufficient. Matched structurally so the mock keeps working with either
        // the gross floor (`balance_cents >= $1`) or the stricter available-funds
        // floor (`balance_cents - COALESCE(reserved_cents, 0) >= $1`) that
        // NEW-4 introduced. `opts.availableCents` is already the available figure.
        if (flat.includes('UPDATE wallets') && /balance_cents[^;]*>=\s*\$1/.test(flat)) {
          const amt = Number(params?.[0] ?? 0);
          return { rows: [], rowCount: opts.availableCents >= amt ? 1 : 0 };
        }
        if (flat.includes('INSERT INTO wallets')) return { rows: [], rowCount: 1 };
        if (flat.includes('INSERT INTO transactions')) return { rows: [{ id: 'tx-1' }], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      }),
    };
    return fn(client);
  });
  return executed;
}

async function loadAdminRouter() {
  vi.resetModules();
  const mod = await import('../admin');
  return (mod as any).adminRouter;
}

const debitAdd = (ex: Array<{ sql: string }>) =>
  ex.some(e => e.sql.includes('DO UPDATE SET balance_cents = wallets.balance_cents + $3') &&
                e.sql.includes('INSERT INTO wallets'));
const guardedDebit = (ex: Array<{ sql: string }>) =>
  ex.find(e => e.sql.includes('UPDATE wallets') && /balance_cents[^;]*>=\s*\$1/.test(e.sql));
const txInsertRan = (ex: Array<{ sql: string }>) =>
  ex.some(e => e.sql.includes('INSERT INTO transactions'));

afterEach(() => {
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
});

describe('POST /adjustments (auto-approve) — debit floor', () => {
  it('rejects a debit that exceeds the balance with INSUFFICIENT_BALANCE and writes nothing negative', async () => {
    const ex = wire({ availableCents: 10_000 }); // $100 available
    const res = await invokeRouter(await loadAdminRouter(), 'POST', '/adjustments', {
      body: { userId: USER_ID, type: 'debit', amount: 500, currency: 'USD', reason: 'overdraw attempt here' },
    });

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('INSUFFICIENT_BALANCE');
    // The debit must be the guarded form (0 rows), never the unconditional
    // negative upsert.
    expect(debitAdd(ex)).toBe(false);
    expect(txInsertRan(ex)).toBe(false);
  });

  it('applies a debit within the balance and records the ledger entry', async () => {
    const ex = wire({ availableCents: 10_000 });
    const res = await invokeRouter(await loadAdminRouter(), 'POST', '/adjustments', {
      body: { userId: USER_ID, type: 'debit', amount: 50, currency: 'USD', reason: 'valid debit reason' },
    });

    expect(res.status).toBe(201);
    const g = guardedDebit(ex);
    expect(g, 'debit must use the guarded UPDATE with a balance_cents >= $1 predicate').toBeTruthy();
    expect(txInsertRan(ex)).toBe(true);
  });

  it('applies a credit via the additive upsert (no debit guard needed)', async () => {
    const ex = wire({ availableCents: 0 });
    const res = await invokeRouter(await loadAdminRouter(), 'POST', '/adjustments', {
      body: { userId: USER_ID, type: 'credit', amount: 50, currency: 'USD', reason: 'valid credit reason' },
    });

    expect(res.status).toBe(201);
    expect(ex.some(e => e.sql.includes('INSERT INTO wallets') && e.sql.includes('balance_cents = wallets.balance_cents + $3'))).toBe(true);
    expect(guardedDebit(ex)).toBeUndefined();
  });
});

describe('POST /adjustments/:id/approve — debit floor', () => {
  it('rejects approving a debit that exceeds the balance and does not mark it SUCCESS', async () => {
    const ex = wire({ availableCents: 10_000, adjustment: { type: 'debit', amount_cents: 500_00 } });
    const res = await invokeRouter(await loadAdminRouter(), 'POST', `/adjustments/${ADJ_ID}/approve`, { body: {} });

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('INSUFFICIENT_BALANCE');
    expect(debitAdd(ex)).toBe(false);
    expect(txInsertRan(ex)).toBe(false);
  });

  it('approves a debit within the balance', async () => {
    const ex = wire({ availableCents: 100_000, adjustment: { type: 'debit', amount_cents: 50_00 } });
    const res = await invokeRouter(await loadAdminRouter(), 'POST', `/adjustments/${ADJ_ID}/approve`, { body: {} });

    expect(res.status).toBe(200);
    expect(guardedDebit(ex)).toBeTruthy();
    expect(txInsertRan(ex)).toBe(true);
  });
});
