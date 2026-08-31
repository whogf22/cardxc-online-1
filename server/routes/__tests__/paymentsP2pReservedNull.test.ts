/**
 * @vitest-environment node
 *
 * CONSISTENCY — the reserved_cents-NULL transfer-blocking bug (fixed in
 * transactions.ts) also existed in the payments P2P debit. This pins the
 * COALESCE fix at payments.ts and guards against regression.
 *
 * Socket-free: driven in-process via invokeRouter (the sandbox forbids listen()).
 * The transaction client emulates Postgres NULL arithmetic so the assertion is
 * behavioural, not just a source grep.
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
  authenticate: (req: any, _r: any, n: any) => { req.user = { id: 'user-1', email: 'sender@test.com', role: 'USER' }; n(); },
  AuthenticatedRequest: {},
}));
vi.mock('../../middleware/rateLimit', () => ({
  sensitiveOpLimiter: (_q: any, _s: any, n: any) => n(),
  financialOpLimiter: (_q: any, _s: any, n: any) => n(),
}));
vi.mock('../../middleware/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../services/auditService', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../services/fraudService', () => ({ runFraudChecks: (...a: unknown[]) => mockRunFraudChecks(...a) }));

function wire(balanceCents: number, reservedCents: number | null) {
  const executed: Array<{ sql: string; params: unknown[] }> = [];
  mockRunFraudChecks.mockResolvedValue({ passed: true, flags: [], score: 0 });
  mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  mockQueryOne.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM users')) return { id: 'user-2', email: 'r@test.com', full_name: 'Recipient' };
    if (sql.includes('FROM wallets')) return { balance_cents: balanceCents, reserved_cents: reservedCents };
    return null;
  });
  mockTransaction.mockImplementation(async (fn: any) => {
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        const flat = String(sql).replace(/\s+/g, ' ');
        executed.push({ sql: flat, params: params ?? [] });
        if (flat.includes('INSERT INTO transactions')) return { rows: [{ id: 'tx-1' }], rowCount: 1 };
        if (flat.includes('UPDATE wallets') && flat.includes('SET balance_cents = balance_cents - $1')) {
          const amt = Number(params?.[0] ?? 0);
          const usesCoalesce = /COALESCE\(\s*reserved_cents\s*,\s*0\s*\)/i.test(flat);
          const reserved = usesCoalesce ? (reservedCents ?? 0) : reservedCents;
          const effective = reserved === null ? null : balanceCents - reserved;
          return { rows: [], rowCount: effective !== null && effective >= amt ? 1 : 0 };
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
  const mod = await import('../payments');
  return (mod as any).default ?? (mod as any).paymentsRouter ?? (mod as any).router;
}

function p2p(router: any, amount: number) {
  return invokeRouter(router, 'POST', '/p2p/transfer', {
    body: { recipient: 'r@test.com', recipientType: 'email', amount, currency: 'USD' },
  });
}

const guardedDebit = (ex: Array<{ sql: string }>) =>
  ex.find(e => e.sql.includes('UPDATE wallets') && e.sql.includes('SET balance_cents = balance_cents - $1'));

afterEach(() => { mockQuery.mockReset(); mockQueryOne.mockReset(); mockTransaction.mockReset(); mockRunFraudChecks.mockReset(); });

describe('POST /p2p/transfer — reserved_cents NULL', () => {
  it('lets a NULL-reserve wallet transfer and uses COALESCE in the guard', async () => {
    const ex = wire(100_000, null);
    const res = await p2p(await loadRouter(), 50);
    expect(res.status).toBe(201);
    expect(res.body?.success).toBe(true);
    expect(guardedDebit(ex)?.sql).toMatch(/COALESCE\(\s*reserved_cents\s*,\s*0\s*\)/i);
  });

  it('still enforces a non-null reserve', async () => {
    wire(100_000, 90_000); // available 10000c
    const res = await p2p(await loadRouter(), 200); // 20000c > available
    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('INSUFFICIENT_BALANCE');
  });
});
