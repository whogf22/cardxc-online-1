/**
 * @vitest-environment node
 *
 * FIN-4 — admin withdrawal approval must not settle an un-debited withdrawal.
 *
 * The approval flow atomically claims the withdrawal row, then debits the wallet
 * with a guarded UPDATE. If that debit matches 0 rows (insufficient balance —
 * e.g. after the balance was drained elsewhere) the money was never taken, yet
 * the withdrawal was previously still flipped to 'approved' and its transaction
 * to 'SUCCESS'. The operator would then pay out funds that were never debited.
 *
 * Invariant: a 0-row debit must roll back the ENTIRE approval.
 */
import express from 'express';
import request from 'supertest';
import { beforeAll, afterEach, vi, describe, it, expect } from 'vitest';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockTransaction = vi.fn();

vi.mock('../../db/pool', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  transaction: (fn: (client: { query: typeof mockQuery }) => Promise<unknown>) => mockTransaction(fn),
}));
vi.mock('../../services/auditService', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  getAuditLogs: vi.fn(), exportAuditLogsToCSV: vi.fn(),
}));
vi.mock('../../services/fraudService', () => ({ getFraudFlags: vi.fn() }));
vi.mock('../../services/stripeService', () => ({ isStripeConfigured: () => false, createPaymentIntent: vi.fn(), getPaymentIntent: vi.fn() }));
vi.mock('../../services/fluzClient', () => ({ isFluzConfigured: () => false }));
vi.mock('../../middleware/securityLogger', () => ({ getSecurityEvents: vi.fn(), getSecurityEventsByType: vi.fn(), getSecurityEventsByIP: vi.fn() }));
vi.mock('../../middleware/rateLimit', () => ({
  getRateLimitViolations: vi.fn(), clearRateLimitViolations: vi.fn(),
  sensitiveOpLimiter: (_q: express.Request, _s: express.Response, n: express.NextFunction) => n(),
  financialOpLimiter: (_q: express.Request, _s: express.Response, n: express.NextFunction) => n(),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: express.Request & { user?: unknown }, _r: express.Response, n: express.NextFunction) => {
    (req as any).user = { id: 'admin-1', email: 'admin@test.com', role: 'SUPER_ADMIN' };
    n();
  },
  requireRole: () => (_q: express.Request, _s: express.Response, n: express.NextFunction) => n(),
  AuthenticatedRequest: {},
}));

let app: express.Express;

beforeAll(async () => {
  vi.resetModules();
  const admin = await import('../admin');
  app = express();
  app.use(express.json());
  app.use('/api/admin', (admin as any).adminRouter ?? (admin as any).default);
  app.use((err: any, _q: express.Request, res: express.Response, _n: express.NextFunction) => {
    res.status(err.statusCode || 500).json({ success: false, error: err.message, code: err.code });
  });
});

afterEach(() => {
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
});

const WITHDRAWAL_ID = '11111111-1111-4111-8111-111111111111';

/**
 * Wire a pending withdrawal and a transaction client whose guarded wallet debit
 * reports `debitRowCount` affected rows.
 */
function setup(debitRowCount: number) {
  const executed: Array<{ sql: string; params: unknown[] }> = [];
  mockQueryOne.mockResolvedValue({
    id: WITHDRAWAL_ID, user_id: 'user-1', amount_cents: 50_000, currency: 'USD', status: 'pending',
  });
  mockTransaction.mockImplementation(async (fn: (c: unknown) => Promise<unknown>) =>
    fn({
      query: vi.fn(async (sql: string, params: unknown[]) => {
        executed.push({ sql: String(sql).replace(/\s+/g, ' '), params });
        if (String(sql).includes('UPDATE withdrawal_requests')) return { rows: [], rowCount: 1 };
        if (String(sql).includes('UPDATE wallets')) return { rows: [], rowCount: debitRowCount };
        return { rows: [], rowCount: 1 };
      }),
    }));
  return executed;
}

describe('FIN-4: POST /api/admin/withdrawals/:id/approve', () => {
  it('ROLLS BACK and does not mark SUCCESS when the guarded debit affects 0 rows', async () => {
    const executed = setup(0);

    const res = await request(app)
      .post(`/api/admin/withdrawals/${WITHDRAWAL_ID}/approve`)
      .send({ notes: 'ok' });

    // The approval must fail loudly rather than settling an un-debited payout.
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INSUFFICIENT_BALANCE');

    // Critically: the transaction must NOT have been marked SUCCESS after the
    // failed debit. (The throw aborts before that statement runs.)
    const markedSuccess = executed.some(e =>
      e.sql.includes('UPDATE transactions') && e.sql.includes("status = 'SUCCESS'"));
    expect(markedSuccess).toBe(false);
  });

  it('completes the approval when the guarded debit affects exactly 1 row', async () => {
    const executed = setup(1);

    const res = await request(app)
      .post(`/api/admin/withdrawals/${WITHDRAWAL_ID}/approve`)
      .send({ notes: 'ok' });

    expect(res.status).toBe(200);
    const markedSuccess = executed.some(e =>
      e.sql.includes('UPDATE transactions') && e.sql.includes("status = 'SUCCESS'"));
    expect(markedSuccess).toBe(true);
  });

  it('debits the wallet and releases the reserve in the same guarded statement', async () => {
    const executed = setup(1);
    await request(app).post(`/api/admin/withdrawals/${WITHDRAWAL_ID}/approve`).send({});

    const debit = executed.find(e => e.sql.includes('UPDATE wallets'));
    expect(debit).toBeDefined();
    expect(debit!.sql).toContain('balance_cents = balance_cents - $1');
    expect(debit!.sql).toContain('reserved_cents = reserved_cents - $1');
    expect(debit!.sql).toContain('balance_cents >= $1'); // guard present
  });

  it('claims the withdrawal atomically before touching money', async () => {
    const executed = setup(1);
    await request(app).post(`/api/admin/withdrawals/${WITHDRAWAL_ID}/approve`).send({});

    const claimIdx = executed.findIndex(e => e.sql.includes('UPDATE withdrawal_requests'));
    const debitIdx = executed.findIndex(e => e.sql.includes('UPDATE wallets'));
    expect(claimIdx).toBeGreaterThanOrEqual(0);
    expect(claimIdx).toBeLessThan(debitIdx);
    expect(executed[claimIdx]!.sql).toContain("status = 'pending'"); // race guard
  });
});
