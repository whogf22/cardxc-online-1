/**
 * @vitest-environment node
 *
 * R3-8 (MEDIUM), admin side — the USDT resolvers must actually finalise the
 * withdrawal's canonical transaction row, and must know whether they did.
 *
 * Both resolvers end with:
 *
 *   UPDATE transactions SET status = ... , updated_at = NOW()
 *   WHERE reference = $1 AND type = 'withdrawal'
 *
 * and both discarded the result. Combined with the crypto path never having
 * created that row, settle and refund silently finalised NOTHING: the withdrawal
 * reached 'completed'/'rejected' while its user-visible ledger entry stayed
 * PENDING (or, before the service-side fix, did not exist at all). Nothing in the
 * system could notice, because a 0-row UPDATE is not an error.
 *
 * INVARIANTS PINNED HERE:
 *  - the finalise is scoped to the withdrawal's canonical row and its PENDING
 *    state, so it cannot overwrite an already-resolved ledger entry
 *  - it runs inside the SAME transaction as the status claim, after it
 *  - a 0-row finalise is REPORTED, never swallowed
 *  - a 0-row finalise does NOT abort the operation: settling funds that already
 *    left custody, and returning a refund the user is owed, must not be blocked
 *    by a missing bookkeeping row (that is how NEW-1 stranded withdrawals)
 *  - neither resolver touches a fiat balance column
 *
 * Socket-free: driven in-process via invokeRouter (the sandbox forbids listen()).
 */
import { afterEach, vi, describe, it, expect } from 'vitest';
import { invokeRouter } from './_invoke';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockTransaction = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('../../db/pool', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  transaction: (fn: unknown) => mockTransaction(fn),
}));
vi.mock('../../services/auditService', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  getAuditLogs: vi.fn(), exportAuditLogsToCSV: vi.fn(),
}));
vi.mock('../../services/fraudService', () => ({ getFraudFlags: vi.fn() }));
vi.mock('../../services/stripeService', () => ({
  isStripeConfigured: () => false, createPaymentIntent: vi.fn(), getPaymentIntent: vi.fn(),
}));
vi.mock('../../services/fluzClient', () => ({ isFluzConfigured: () => false }));
vi.mock('../../middleware/securityLogger', () => ({
  getSecurityEvents: vi.fn(), getSecurityEventsByType: vi.fn(), getSecurityEventsByIP: vi.fn(),
}));
vi.mock('../../middleware/rateLimit', () => ({
  getRateLimitViolations: vi.fn(), clearRateLimitViolations: vi.fn(),
  apiLimiter: (_q: any, _s: any, n: any) => n(),
  sensitiveOpLimiter: (_q: any, _s: any, n: any) => n(),
  financialOpLimiter: (_q: any, _s: any, n: any) => n(),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: (...a: unknown[]) => mockLoggerError(...a), debug: vi.fn() },
}));
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _r: any, n: any) => {
    req.user = { id: 'admin-1', email: 'admin@test.com', role: 'SUPER_ADMIN' };
    n();
  },
  requireRole: () => (_q: any, _s: any, n: any) => n(),
  AuthenticatedRequest: {},
}));

const WD_ID = 'wd-crypto-1';
const HELD_CRYPTO = {
  id: WD_ID,
  user_id: 'user-1',
  amount_cents: 5000,
  currency: 'USD',
  withdrawal_type: 'crypto',
  asset_type: 'usdt',
  status: 'held',
};

type Stmt = { sql: string; params: unknown[]; txn: number };

/**
 * `finaliseRowCount` models whether the canonical `transactions` row was there
 * to finalise: 1 = the row this withdrawal created, 0 = a legacy crypto
 * withdrawal from before R3-8 that never got one.
 */
function wire(row: Record<string, unknown>, opts: { finaliseRowCount?: number } = {}) {
  const { finaliseRowCount = 1 } = opts;
  const executed: Stmt[] = [];
  let txn = 0;

  mockQuery.mockResolvedValue([]);
  mockQueryOne.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM withdrawal_requests')) return { ...row };
    return null;
  });
  mockTransaction.mockImplementation(async (fn: any) => {
    const current = ++txn;
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        const flat = String(sql).replace(/\s+/g, ' ').trim();
        executed.push({ sql: flat, params: params ?? [], txn: current });
        if (flat.includes('UPDATE transactions')) {
          return { rows: [], rowCount: finaliseRowCount };
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
  const mod = await import('../admin');
  return (mod as any).adminRouter ?? (mod as any).default;
}

const finalise = (ex: Stmt[]) => ex.filter((e) => e.sql.includes('UPDATE transactions'));
const claim = (ex: Stmt[]) => ex.findIndex((e) => e.sql.includes('UPDATE withdrawal_requests'));
const fiatMutations = (ex: Stmt[]) =>
  ex.filter((e) => /(?:^|[^_])balance_cents\s*=/.test(e.sql) || /reserved_cents\s*=/.test(e.sql));

const settle = (router: unknown, id = WD_ID) =>
  invokeRouter(router as any, 'POST', `/withdrawals/${id}/usdt/settle`, {
    body: { txHash: 'a'.repeat(64), notes: 'paid manually' },
  });
const refund = (router: unknown, id = WD_ID) =>
  invokeRouter(router as any, 'POST', `/withdrawals/${id}/usdt/refund`, {
    body: { reason: 'operator declined' },
  });

afterEach(() => {
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
  mockLoggerError.mockReset();
});

describe('R3-8: settle finalises the withdrawal’s canonical transaction', () => {
  it('updates exactly one row, keyed on the withdrawal reference, scoped to PENDING', async () => {
    const ex = wire(HELD_CRYPTO);
    const res = await settle(await loadRouter());

    expect(res.status).toBe(200);
    const f = finalise(ex);
    expect(f).toHaveLength(1);
    expect(f[0].sql).toContain("'SUCCESS'");
    expect(f[0].sql).toMatch(/WHERE reference = \$\d+ AND type = 'withdrawal'/i);
    // Without a source-state predicate the finalise is a last-writer-wins
    // overwrite: a late settle could stamp SUCCESS over a committed FAILED.
    expect(f[0].sql).toMatch(/AND status = 'PENDING'/i);
    expect(f[0].params).toContain(WD_ID);
  });

  it('runs inside the same transaction as the status claim, after it', async () => {
    const ex = wire(HELD_CRYPTO);
    await settle(await loadRouter());

    const claimIdx = claim(ex);
    const finaliseIdx = ex.findIndex((e) => e.sql.includes('UPDATE transactions'));
    expect(claimIdx).toBeGreaterThanOrEqual(0);
    expect(finaliseIdx).toBeGreaterThan(claimIdx);
    expect(ex[finaliseIdx].txn).toBe(ex[claimIdx].txn);
  });

  it('REPORTS a finalise that matched no row instead of swallowing it', async () => {
    const ex = wire(HELD_CRYPTO, { finaliseRowCount: 0 });
    const res = await settle(await loadRouter());

    // The funds already left custody, so the settle must still succeed — but the
    // divergence has to be visible to an operator.
    expect(res.status).toBe(200);
    expect(finalise(ex)).toHaveLength(1);
    const reported = mockLoggerError.mock.calls.some(([, meta]) =>
      meta && typeof meta === 'object' && (meta as any).withdrawalId === WD_ID,
    );
    expect(reported, 'a 0-row finalise must be logged with the withdrawal id').toBe(true);
  });

  it('never mutates a fiat balance column', async () => {
    const ex = wire(HELD_CRYPTO);
    await settle(await loadRouter());
    expect(fiatMutations(ex)).toHaveLength(0);
  });

  it('finalises nothing when the status claim is lost', async () => {
    const executed: Stmt[] = [];
    mockQuery.mockResolvedValue([]);
    mockQueryOne.mockImplementation(async (sql: string) =>
      sql.includes('FROM withdrawal_requests') ? { ...HELD_CRYPTO } : null,
    );
    mockTransaction.mockImplementation(async (fn: any) => {
      const client = {
        query: vi.fn(async (sql: string, params?: unknown[]) => {
          const flat = String(sql).replace(/\s+/g, ' ').trim();
          executed.push({ sql: flat, params: params ?? [], txn: 1 });
          if (flat.includes('UPDATE withdrawal_requests')) return { rows: [], rowCount: 0 };
          return { rows: [], rowCount: 1 };
        }),
      };
      return fn(client);
    });

    const res = await settle(await loadRouter());

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('ALREADY_RESOLVED');
    expect(finalise(executed)).toHaveLength(0);
  });
});

describe('R3-8: refund finalises the same canonical transaction', () => {
  it('marks it FAILED, keyed on the reference, scoped to PENDING', async () => {
    const ex = wire(HELD_CRYPTO);
    const res = await refund(await loadRouter());

    expect(res.status).toBe(200);
    const f = finalise(ex);
    expect(f).toHaveLength(1);
    expect(f[0].sql).toContain("'FAILED'");
    expect(f[0].sql).toMatch(/WHERE reference = \$\d+ AND type = 'withdrawal'/i);
    expect(f[0].sql).toMatch(/AND status = 'PENDING'/i);
    expect(f[0].params).toContain(WD_ID);
  });

  it('restores the USDT and finalises in one transaction, claim first', async () => {
    const ex = wire(HELD_CRYPTO);
    await refund(await loadRouter());

    const claimIdx = claim(ex);
    const creditIdx = ex.findIndex((e) => /usdt_balance_cents\s*=\s*COALESCE\(\s*usdt_balance_cents\s*,\s*0\s*\)\s*\+/i.test(e.sql));
    const finaliseIdx = ex.findIndex((e) => e.sql.includes('UPDATE transactions'));

    expect(claimIdx).toBeGreaterThanOrEqual(0);
    expect(creditIdx).toBeGreaterThan(claimIdx);
    expect(finaliseIdx).toBeGreaterThan(claimIdx);
    expect(new Set([ex[claimIdx].txn, ex[creditIdx].txn, ex[finaliseIdx].txn]).size).toBe(1);
  });

  it('a 0-row finalise is reported but does NOT block returning the funds', async () => {
    const ex = wire(HELD_CRYPTO, { finaliseRowCount: 0 });
    const res = await refund(await loadRouter());

    expect(res.status).toBe(200);
    const credits = ex.filter((e) => /usdt_balance_cents\s*=\s*COALESCE\(\s*usdt_balance_cents\s*,\s*0\s*\)\s*\+/i.test(e.sql));
    expect(credits, 'the user is owed this money regardless of bookkeeping').toHaveLength(1);
    const reported = mockLoggerError.mock.calls.some(([, meta]) =>
      meta && typeof meta === 'object' && (meta as any).withdrawalId === WD_ID,
    );
    expect(reported).toBe(true);
  });

  it('never mutates a fiat balance column', async () => {
    const ex = wire(HELD_CRYPTO);
    await refund(await loadRouter());
    expect(fiatMutations(ex)).toHaveLength(0);
  });
});
