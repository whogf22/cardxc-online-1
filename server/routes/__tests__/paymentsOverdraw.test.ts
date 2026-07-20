/**
 * @vitest-environment node
 *
 * Regression tests for payment endpoint overdraw protection.
 *
 * Invariant: every wallet debit must be a guarded, atomic UPDATE
 * (... AND balance >= amount) inside the transaction so concurrent requests
 * cannot drive a wallet negative (TOCTOU overdraw), and single-use payment
 * intents (QR, split participant) must be atomically claimed so a payer is
 * never double-charged.
 */
import express from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, afterEach, vi, describe, it, expect } from 'vitest';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockTransaction = vi.fn();
const mockCreateAuditLog = vi.fn().mockResolvedValue(undefined);
const mockRunFraudChecks = vi.fn().mockResolvedValue({ flags: [] });

vi.mock('../../db/pool', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  transaction: (fn: (client: { query: typeof mockQuery }) => Promise<unknown>) => mockTransaction(fn),
}));
vi.mock('../../services/auditService', () => ({ createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args) }));
vi.mock('../../services/fraudService', () => ({ runFraudChecks: (...args: unknown[]) => mockRunFraudChecks(...args) }));
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: express.Request & { user?: unknown }, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { user: { id: string; email: string } }).user = { id: 'sender-1', email: 'sender@test.com' };
    next();
  },
  AuthenticatedRequest: {},
}));
vi.mock('../../middleware/rateLimit', () => ({
  sensitiveOpLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  financialOpLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

let app: express.Express;

beforeAll(async () => {
  vi.resetModules();
  const payments = await import('../payments');
  app = express();
  app.use(express.json());
  app.use('/api/payments', payments.paymentsRouter);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  });
});

afterEach(() => {
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
  mockCreateAuditLog.mockReset();
  mockRunFraudChecks.mockReset().mockResolvedValue({ flags: [] });
});

describe('POST /api/payments/p2p/transfer guarded debit', () => {
  beforeEach(() => {
    mockQueryOne.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users WHERE email')) return { id: 'recipient-1', email: 'r@test.com', full_name: 'Recipient' };
      if (sql.includes('FROM wallets')) return { balance_cents: 100_00, reserved_cents: 0 };
      return null;
    });
  });

  it('debits with a balance guard (balance - reserved >= amount)', async () => {
    const executedSql: string[] = [];
    mockTransaction.mockImplementation(async (fn: (client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }> }) => Promise<unknown>) => {
      const client = {
        query: vi.fn(async (sql: string) => {
          executedSql.push(sql);
          if (sql.includes('RETURNING id')) return { rows: [{ id: 'tx-1' }], rowCount: 1 };
          return { rows: [], rowCount: 1 };
        }),
      };
      return fn(client);
    });

    const res = await request(app).post('/api/payments/p2p/transfer').send({
      recipient: 'r@test.com', recipientType: 'email', amount: 50, currency: 'USD',
    });
    expect(res.status).toBe(201);

    const debitSql = executedSql.find((s) => s.includes('UPDATE wallets') && s.includes('balance_cents = balance_cents - $1'));
    expect(debitSql).toBeDefined();
    expect(debitSql).toContain('reserved_cents >= $1');
  });

  it('rejects with 400 when the guarded debit affects 0 rows (lost race)', async () => {
    mockTransaction.mockImplementation(async (fn: (client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }> }) => Promise<unknown>) => {
      const client = {
        query: vi.fn(async (sql: string) => {
          if (sql.includes('RETURNING id')) return { rows: [{ id: 'tx-1' }], rowCount: 1 };
          if (sql.includes('UPDATE wallets') && sql.includes('balance_cents = balance_cents - $1')) return { rows: [], rowCount: 0 };
          return { rows: [], rowCount: 1 };
        }),
      };
      return fn(client);
    });

    const res = await request(app).post('/api/payments/p2p/transfer').send({
      recipient: 'r@test.com', recipientType: 'email', amount: 50, currency: 'USD',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Insufficient balance/);
  });
});
