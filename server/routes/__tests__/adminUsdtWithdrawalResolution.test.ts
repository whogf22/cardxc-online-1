/**
 * @vitest-environment node
 *
 * NEW-1 (HIGH) — held USDT/crypto withdrawals must be resolvable.
 *
 * REPRODUCTION (pre-fix): a crypto withdrawal debits `usdt_balance_cents` and is
 * written with status 'processing'. `holdForManualReview` also writes
 * 'processing'. The only admin resolvers are
 * `POST /withdrawals/:id/approve` and `.../reject`, and BOTH require
 * `status = 'pending'` — so a crypto row can never be reached by either. No cron
 * or worker touches `withdrawal_requests`. With `CRYPTO_AUTO_PAYOUT_ENABLED`
 * unset (the advertised fail-closed default) EVERY crypto withdrawal therefore
 * debits the user and enters a state no code path can settle or refund.
 *
 * Worse, the fiat handlers mutate the WRONG asset: approve debits
 * `balance_cents`/`reserved_cents`, and reject decrements `reserved_cents` that a
 * USDT withdrawal never incremented (driving it negative).
 *
 * INVARIANTS PINNED HERE:
 *  - a USDT-asset withdrawal is created in the explicit 'held' state
 *  - fiat handlers REFUSE a USDT-asset row (never touch fiat columns for it)
 *  - USDT settle/refund accept ONLY the 'held' state
 *  - refund restores `usdt_balance_cents` atomically with the status change
 *  - repeated / concurrent resolution produces exactly ONE balance effect
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
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _r: any, n: any) => {
    req.user = { id: 'admin-1', email: 'admin@test.com', role: 'SUPER_ADMIN' };
    n();
  },
  requireRole: () => (_q: any, _s: any, n: any) => n(),
  AuthenticatedRequest: {},
}));

interface Row {
  id: string;
  user_id: string;
  amount_cents: number;
  currency: string;
  withdrawal_type: string;
  asset_type: string;
  status: string;
}

const HELD_CRYPTO: Row = {
  id: 'wd-crypto-1',
  user_id: 'user-1',
  amount_cents: 5000,
  currency: 'USD',
  withdrawal_type: 'crypto',
  asset_type: 'usdt',
  status: 'held',
};

/**
 * Wire the DB mocks. `claimRowCount` models the atomic status claim: 1 = this
 * caller won, 0 = a concurrent caller already resolved the row.
 */
function wire(row: Row, opts: { claimRowCount?: number } = {}) {
  const { claimRowCount = 1 } = opts;
  const executed: Array<{ sql: string; params: unknown[] }> = [];

  mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  mockQueryOne.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM withdrawal_requests')) return { ...row };
    return null;
  });
  mockTransaction.mockImplementation(async (fn: any) => {
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        const flat = String(sql).replace(/\s+/g, ' ');
        executed.push({ sql: flat, params: params ?? [] });
        if (flat.includes('UPDATE withdrawal_requests')) {
          return { rows: [], rowCount: claimRowCount };
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

const find = (ex: Array<{ sql: string }>, needle: string) =>
  ex.filter(e => e.sql.includes(needle));

const touchesFiat = (ex: Array<{ sql: string }>) =>
  ex.some(e =>
    e.sql.includes('UPDATE wallets') &&
    (e.sql.includes('balance_cents = balance_cents') || e.sql.includes('reserved_cents = reserved_cents')),
  );

/**
 * Any statement that INCREASES the USDT balance, i.e. a refund. Matched
 * structurally (not against one literal spelling) so the assertion holds whether
 * the implementation writes `usdt_balance_cents + $1` or the NULL-safe
 * `COALESCE(usdt_balance_cents, 0) + $1`.
 */
const usdtRestores = (ex: Array<{ sql: string; params: unknown[] }>) =>
  ex.filter(e =>
    e.sql.includes('UPDATE wallets') &&
    /usdt_balance_cents\s*=\s*(COALESCE\(\s*usdt_balance_cents\s*,\s*0\s*\)|usdt_balance_cents)\s*\+/i.test(e.sql),
  );

afterEach(() => {
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
});

describe('NEW-1: fiat admin handlers refuse a USDT-asset withdrawal', () => {
  it('POST /withdrawals/:id/approve rejects a crypto row and touches no wallet column', async () => {
    const ex = wire(HELD_CRYPTO);
    const res = await invokeRouter(await loadRouter(), 'POST', `/withdrawals/${HELD_CRYPTO.id}/approve`, {
      body: { notes: 'ok' },
    });

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('WRONG_ASSET_TYPE');
    expect(touchesFiat(ex)).toBe(false);
    expect(usdtRestores(ex).length).toBe(0);
  });

  it('POST /withdrawals/:id/reject rejects a crypto row and never decrements fiat reserved_cents', async () => {
    const ex = wire(HELD_CRYPTO);
    const res = await invokeRouter(await loadRouter(), 'POST', `/withdrawals/${HELD_CRYPTO.id}/reject`, {
      body: { reason: 'no' },
    });

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('WRONG_ASSET_TYPE');
    expect(touchesFiat(ex)).toBe(false);
  });
});

describe('NEW-1: USDT settle (operator confirms the payout went out)', () => {
  it('settles a held row: status claim scoped to held, no balance mutation, no fiat columns', async () => {
    const ex = wire(HELD_CRYPTO);
    const res = await invokeRouter(await loadRouter(), 'POST', `/withdrawals/${HELD_CRYPTO.id}/usdt/settle`, {
      body: { txHash: 'a'.repeat(64), notes: 'paid manually' },
    });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);

    const claim = find(ex, 'UPDATE withdrawal_requests')[0];
    expect(claim).toBeDefined();
    // Only a row in a resolvable USDT state may be settled — the predicate is the
    // real guard. R3-11 widened that set from 'held' alone to the three states the
    // payout path can leave a row in: 'held' (never sent), 'sent' (provider
    // confirmed the broadcast) and 'reconcile' (ambiguous, may be on-chain).
    // Without the widening, 'sent'/'reconcile' rows would be unresolvable — the
    // same stranding defect NEW-1 fixed for 'held'. It is still a closed list:
    // 'pending', 'processing', 'completed' and 'rejected' remain refused.
    expect(claim.sql).toMatch(/status\s+IN\s*\(\s*'held'\s*,\s*'sent'\s*,\s*'reconcile'\s*\)/i);
    expect(claim.sql).toMatch(/asset_type\s*=\s*'usdt'/i);
    // Funds already left the user's balance at request time: settling must not
    // debit again, and must never touch fiat columns.
    expect(usdtRestores(ex).length).toBe(0);
    expect(touchesFiat(ex)).toBe(false);
  });

  it('a concurrent resolver already won (claim matches 0 rows): no balance effect, 400', async () => {
    const ex = wire(HELD_CRYPTO, { claimRowCount: 0 });
    const res = await invokeRouter(await loadRouter(), 'POST', `/withdrawals/${HELD_CRYPTO.id}/usdt/settle`, {
      body: { txHash: 'b'.repeat(64) },
    });

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('ALREADY_RESOLVED');
    expect(usdtRestores(ex).length).toBe(0);
    expect(touchesFiat(ex)).toBe(false);
  });

  it('refuses a row that is not held (already broadcast / processing)', async () => {
    const ex = wire({ ...HELD_CRYPTO, status: 'processing' });
    const res = await invokeRouter(await loadRouter(), 'POST', `/withdrawals/${HELD_CRYPTO.id}/usdt/settle`, {
      body: { txHash: 'c'.repeat(64) },
    });

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('NOT_HELD');
    expect(usdtRestores(ex).length).toBe(0);
  });

  it('rejects a malformed tx hash', async () => {
    wire(HELD_CRYPTO);
    const res = await invokeRouter(await loadRouter(), 'POST', `/withdrawals/${HELD_CRYPTO.id}/usdt/settle`, {
      body: { txHash: 'not-a-hash' },
    });

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('VALIDATION_ERROR');
  });
});

describe('NEW-1: USDT refund (operator declines — funds must come back)', () => {
  it('refunds atomically: restores usdt_balance_cents exactly once, in the same transaction as the claim', async () => {
    const ex = wire(HELD_CRYPTO);
    const res = await invokeRouter(await loadRouter(), 'POST', `/withdrawals/${HELD_CRYPTO.id}/usdt/refund`, {
      body: { reason: 'operator declined' },
    });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);

    const restores = usdtRestores(ex);
    expect(restores.length).toBe(1);
    expect(restores[0].params[0]).toBe(HELD_CRYPTO.amount_cents);
    // Never the fiat columns.
    expect(touchesFiat(ex)).toBe(false);

    // The claim must precede the refund inside one transaction, so a lost claim
    // cannot restore funds.
    const claimIdx = ex.findIndex(e => e.sql.includes('UPDATE withdrawal_requests'));
    const refundIdx = ex.findIndex(e => usdtRestores([e]).length === 1);
    expect(claimIdx).toBeGreaterThanOrEqual(0);
    expect(refundIdx).toBeGreaterThan(claimIdx);
  });

  it('duplicate refund: the second call restores nothing', async () => {
    const ex = wire(HELD_CRYPTO, { claimRowCount: 0 });
    const res = await invokeRouter(await loadRouter(), 'POST', `/withdrawals/${HELD_CRYPTO.id}/usdt/refund`, {
      body: { reason: 'again' },
    });

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('ALREADY_RESOLVED');
    expect(usdtRestores(ex).length).toBe(0);
  });

  it('refuses to refund a row that is not held', async () => {
    const ex = wire({ ...HELD_CRYPTO, status: 'completed' });
    const res = await invokeRouter(await loadRouter(), 'POST', `/withdrawals/${HELD_CRYPTO.id}/usdt/refund`, {
      body: { reason: 'nope' },
    });

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('NOT_HELD');
    expect(usdtRestores(ex).length).toBe(0);
  });

  it('refuses to refund a fiat-asset row through the USDT path', async () => {
    const ex = wire({ ...HELD_CRYPTO, asset_type: 'fiat', withdrawal_type: 'bank' });
    const res = await invokeRouter(await loadRouter(), 'POST', `/withdrawals/${HELD_CRYPTO.id}/usdt/refund`, {
      body: { reason: 'wrong asset' },
    });

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('WRONG_ASSET_TYPE');
    expect(usdtRestores(ex).length).toBe(0);
  });
});
