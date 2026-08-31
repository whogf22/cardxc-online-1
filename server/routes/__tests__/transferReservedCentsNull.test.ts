/**
 * @vitest-environment node
 *
 * LOW — a wallet with reserved_cents IS NULL must still be able to transfer.
 *
 * The guarded transfer debit used a raw predicate:
 *
 *   WHERE user_id = $2 AND currency = $3 AND balance_cents - reserved_cents >= $1
 *
 * In Postgres `balance_cents - NULL` is NULL and `NULL >= $1` is NULL (not
 * true), so the UPDATE matches 0 rows and the transfer is wrongly rejected as
 * INSUFFICIENT_BALANCE — even though the JS pre-check passes (Number(null) is
 * 0). The fix is COALESCE(reserved_cents, 0) in the predicate.
 *
 * Socket-free: driven in-process via invokeRouter (the sandbox forbids listen()).
 * The transaction client below emulates Postgres NULL arithmetic so the test is
 * behavioural: it reproduces the wrong rejection without the fix and the correct
 * success with it.
 */
import { afterEach, vi, describe, it, expect } from 'vitest';
import { invokeRouter } from './_invoke';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockTransaction = vi.fn();
const mockRunFraudChecks = vi.fn();

vi.mock('../../db/pool', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  transaction: (fn: unknown) => mockTransaction(fn),
}));
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _r: any, n: any) => {
    req.user = { id: 'user-1', email: 'sender@test.com', role: 'USER' };
    n();
  },
  requireAdmin: (_q: any, _s: any, n: any) => n(),
  AuthenticatedRequest: {},
}));
vi.mock('../../middleware/rateLimit', () => ({
  sensitiveOpLimiter: (_q: any, _s: any, n: any) => n(),
  financialOpLimiter: (_q: any, _s: any, n: any) => n(),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../services/auditService', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../services/fraudService', () => ({ runFraudChecks: (...a: unknown[]) => mockRunFraudChecks(...a) }));
vi.mock('../../services/transactionHistoryService', () => ({
  getUnifiedHistory: vi.fn(), decodeCursor: vi.fn(), VALID_TYPES: [], VALID_STATUSES: [],
}));

interface WireOpts {
  balanceCents: number;
  reservedCents: number | null;
}

function wire(opts: WireOpts): Array<{ sql: string; params: unknown[] }> {
  const executed: Array<{ sql: string; params: unknown[] }> = [];

  mockRunFraudChecks.mockResolvedValue({ passed: true, flags: [], score: 0 });
  mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  mockQueryOne.mockImplementation(async (sql: string) => {
    if (sql.includes('idempotency_key')) return null;              // no duplicate
    if (sql.includes('FROM users')) return { id: 'user-2' };       // recipient exists
    if (sql.includes('FROM wallets')) return { balance_cents: opts.balanceCents, reserved_cents: opts.reservedCents };
    return null;
  });

  mockTransaction.mockImplementation(async (fn: any) => {
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        const flat = String(sql).replace(/\s+/g, ' ');
        executed.push({ sql: flat, params: params ?? [] });
        if (flat.includes('INSERT INTO transactions')) return { rows: [{ id: 'tx-1' }], rowCount: 1 };
        // Guarded transfer debit — emulate Postgres NULL arithmetic.
        if (flat.includes('UPDATE wallets') && flat.includes('SET balance_cents = balance_cents - $1')) {
          const amt = Number(params?.[0] ?? 0);
          const usesCoalesce = /COALESCE\(\s*reserved_cents\s*,\s*0\s*\)/i.test(flat);
          const reserved = usesCoalesce ? (opts.reservedCents ?? 0) : opts.reservedCents;
          // balance - NULL is NULL in SQL, and NULL >= amt is never true.
          const effective = reserved === null ? null : opts.balanceCents - reserved;
          const matches = effective !== null && effective >= amt;
          return { rows: [], rowCount: matches ? 1 : 0 };
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
  const mod = await import('../transactions');
  return (mod as any).transactionRouter;
}

function transfer(router: any, amount: number) {
  return invokeRouter(router, 'POST', '/transfer', {
    body: { recipientEmail: 'recipient@test.com', amount, currency: 'USD', description: 'test' },
  });
}

const guardedDebit = (ex: Array<{ sql: string }>) =>
  ex.find(e => e.sql.includes('UPDATE wallets') && e.sql.includes('SET balance_cents = balance_cents - $1'));

afterEach(() => {
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
  mockRunFraudChecks.mockReset();
});

describe('POST /transfer — reserved_cents NULL', () => {
  it('lets a wallet with reserved_cents = NULL transfer when the balance is sufficient', async () => {
    const ex = wire({ balanceCents: 100_000, reservedCents: null });
    const res = await transfer(await loadRouter(), 50); // $50 = 5000c, balance $1000

    expect(res.status).toBe(201);
    expect(res.body?.success).toBe(true);
    // The guard must COALESCE the reserve so NULL is treated as 0.
    expect(guardedDebit(ex)?.sql).toMatch(/COALESCE\(\s*reserved_cents\s*,\s*0\s*\)/i);
  });

  it('still enforces a non-null reserve (cannot spend reserved funds)', async () => {
    // balance 1000, reserved 900 -> available 100; a 200 transfer must fail.
    wire({ balanceCents: 100_000, reservedCents: 90_000 });
    const res = await transfer(await loadRouter(), 200);

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('INSUFFICIENT_BALANCE');
  });

  it('allows spending only up to the available (balance minus reserve)', async () => {
    wire({ balanceCents: 100_000, reservedCents: 90_000 });
    const res = await transfer(await loadRouter(), 50); // 5000c <= available 10000c

    expect(res.status).toBe(201);
    expect(res.body?.success).toBe(true);
  });
});
