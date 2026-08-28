/**
 * @vitest-environment node
 *
 * NEW-4 (MEDIUM) — an admin debit adjustment must not spend RESERVED funds.
 *
 * The debit floor added for the earlier negative-balance finding guards only the
 * gross balance:
 *
 *   WHERE user_id = $2 AND currency = $3 AND balance_cents >= $1
 *
 * That permits an admin debit to consume funds already reserved for a pending
 * withdrawal. `balance_cents` stays non-negative, so the earlier fix still holds,
 * but AVAILABLE balance (balance - reserved) goes negative — which then either
 * starves the pending withdrawal at approval time or, combined with the reserve
 * release, corrupts the wallet.
 *
 * Every other guarded debit in the tree already uses the available-balance form
 * (payments.ts, transactions.ts, savings.ts, giftCards.ts), so this is also an
 * internal-consistency defect.
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

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ADJ_ID = '22222222-2222-4222-8222-222222222222';

/**
 * Model the wallet as Postgres would evaluate the guarded debit: the predicate
 * embedded in the SQL decides whether the row matches, so a test that changes
 * the reserve changes the OUTCOME rather than just the SQL text.
 */
function wire(balanceCents: number, reservedCents: number | null, pendingAdjustment = false) {
  const executed: Array<{ sql: string; params: unknown[] }> = [];
  const adjustmentRow = {
    id: ADJ_ID, user_id: USER_ID, type: 'debit', amount_cents: 20_000,
    currency: 'USD', status: 'PENDING', reason: 'test debit adjustment',
  };

  mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  mockQueryOne.mockImplementation(async (sql: string) => {
    const s = String(sql);
    if (s.includes('FROM admin_adjustments')) {
      return pendingAdjustment ? { ...adjustmentRow } : null;
    }
    if (s.includes('FROM users')) return { id: USER_ID, email: 'u@test.com', role: 'USER' };
    if (s.includes('FROM wallets')) return { balance_cents: balanceCents, reserved_cents: reservedCents };
    return null;
  });

  mockTransaction.mockImplementation(async (fn: any) => {
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        const flat = String(sql).replace(/\s+/g, ' ');
        executed.push({ sql: flat, params: params ?? [] });

        // The guarded debit.
        if (flat.includes('UPDATE wallets') && flat.includes('balance_cents = balance_cents - $1')) {
          const amt = Number(params?.[0] ?? 0);
          const respectsReserve =
            /balance_cents\s*-\s*COALESCE\(\s*reserved_cents\s*,\s*0\s*\)\s*>=\s*\$1/i.test(flat);
          const reserved = reservedCents ?? 0;
          const usable = respectsReserve ? balanceCents - reserved : balanceCents;
          return { rows: [], rowCount: usable >= amt ? 1 : 0 };
        }
        if (flat.includes('INSERT INTO admin_adjustments')) return { rows: [{ id: ADJ_ID }], rowCount: 1 };
        // R3-7: the approve path claims the adjustment atomically
        // (`UPDATE admin_adjustments ... WHERE status = 'PENDING' RETURNING ...`) and
        // takes the debit amount from the RETURNED row. Model the claim as won when
        // this fixture has a pending adjustment, and as lost when it has none.
        if (flat.includes('UPDATE admin_adjustments')) {
          return pendingAdjustment
            ? { rows: [{ ...adjustmentRow, status: 'APPROVED' }], rowCount: 1 }
            : { rows: [], rowCount: 0 };
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

const guardedDebit = (ex: Array<{ sql: string }>) =>
  ex.find(e => e.sql.includes('UPDATE wallets') && e.sql.includes('balance_cents = balance_cents - $1'));

afterEach(() => {
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
});

describe('NEW-4: POST /adjustments (auto-approve) debit respects reserved funds', () => {
  it('refuses a debit that would eat funds reserved for a pending withdrawal', async () => {
    // balance 1000.00, reserved 900.00 -> available 100.00. A 200.00 debit must fail.
    const ex = wire(100_000, 90_000);
    const res = await invokeRouter(await loadRouter(), 'POST', '/adjustments', {
      body: { userId: USER_ID, type: 'debit', amount: 200, currency: 'USD', reason: 'clawback attempt' },
    });

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('INSUFFICIENT_BALANCE');
    expect(guardedDebit(ex)?.sql).toMatch(
      /balance_cents\s*-\s*COALESCE\(\s*reserved_cents\s*,\s*0\s*\)\s*>=\s*\$1/i,
    );
  });

  it('allows a debit that fits inside the AVAILABLE balance', async () => {
    const ex = wire(100_000, 90_000);
    const res = await invokeRouter(await loadRouter(), 'POST', '/adjustments', {
      body: { userId: USER_ID, type: 'debit', amount: 50, currency: 'USD', reason: 'legitimate clawback' },
    });

    expect(res.status).toBe(201);
    expect(guardedDebit(ex)).toBeDefined();
  });

  it('treats a NULL reserve as zero rather than blocking the debit', async () => {
    const ex = wire(100_000, null);
    const res = await invokeRouter(await loadRouter(), 'POST', '/adjustments', {
      body: { userId: USER_ID, type: 'debit', amount: 200, currency: 'USD', reason: 'null reserve debit' },
    });

    expect(res.status).toBe(201);
    expect(guardedDebit(ex)?.sql).toMatch(/COALESCE\(\s*reserved_cents\s*,\s*0\s*\)/i);
  });
});

describe('NEW-4: POST /adjustments/:id/approve debit respects reserved funds', () => {
  it('refuses to approve a debit that would eat reserved funds', async () => {
    // Pending adjustment is 200.00; available is only 100.00.
    const ex = wire(100_000, 90_000, true);
    const res = await invokeRouter(await loadRouter(), 'POST', `/adjustments/${ADJ_ID}/approve`, {
      body: {},
    });

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('INSUFFICIENT_BALANCE');
    expect(guardedDebit(ex)?.sql).toMatch(
      /balance_cents\s*-\s*COALESCE\(\s*reserved_cents\s*,\s*0\s*\)\s*>=\s*\$1/i,
    );
  });

  it('approves a debit that fits inside the AVAILABLE balance', async () => {
    // Available 1000.00 vs the 200.00 adjustment.
    const ex = wire(100_000, 0, true);
    const res = await invokeRouter(await loadRouter(), 'POST', `/adjustments/${ADJ_ID}/approve`, {
      body: {},
    });

    expect(res.status).toBe(200);
    expect(guardedDebit(ex)).toBeDefined();
  });
});
