/**
 * @vitest-environment node
 *
 * Regression tests for savings vault balance movement.
 *
 * Invariant: the wallet -> vault debit (and vault -> wallet debit) must be an
 * atomic, guarded UPDATE (balance_cents >= amount) inside the transaction, so
 * concurrent requests cannot drive a balance negative (TOCTOU overdraw).
 */
import express from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, afterEach, vi, describe, it, expect } from 'vitest';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockTransaction = vi.fn();
const mockCreateAuditLog = vi.fn().mockResolvedValue(undefined);

vi.mock('../../db/pool', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  transaction: (fn: (client: { query: typeof mockQuery }) => Promise<unknown>) => mockTransaction(fn),
}));
vi.mock('../../services/auditService', () => ({ createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args) }));
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: express.Request & { user?: unknown }, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { user: { id: string } }).user = { id: 'user-1' };
    next();
  },
  AuthenticatedRequest: {},
}));
vi.mock('../../middleware/rateLimit', () => ({
  sensitiveOpLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

let app: express.Express;

beforeAll(async () => {
  vi.resetModules();
  const savings = await import('../savings');
  app = express();
  app.use(express.json());
  app.use('/api/savings', savings.savingsRouter);
  // Minimal error handler mirroring the app's AppError shape.
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  });
});

afterEach(() => {
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
  mockCreateAuditLog.mockReset();
});

describe('POST /api/savings/vaults/:id/deposit atomic debit', () => {
  const vaultId = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    mockQueryOne.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM savings_vaults WHERE id = $1 AND user_id')) {
        return { id: vaultId, currency: 'USD' };
      }
      if (sql.includes('FROM wallets WHERE user_id = $1 AND currency')) {
        return { balance_cents: 100_00 }; // $100 available at pre-check time
      }
      // final "updated vault" fetch
      return { id: vaultId, name: 'Trip', target_cents: 0, balance_cents: 50_00, currency: 'USD' };
    });
  });

  it('uses a guarded UPDATE (balance_cents >= amount) for the wallet debit', async () => {
    const executedSql: string[] = [];
    mockTransaction.mockImplementation(async (fn: (client: { query: (sql: string, params?: unknown[]) => Promise<{ rowCount: number }> }) => Promise<unknown>) => {
      const client = {
        query: vi.fn(async (sql: string) => {
          executedSql.push(sql);
          return { rowCount: 1, rows: [] };
        }),
      };
      return fn(client);
    });

    const res = await request(app).post(`/api/savings/vaults/${vaultId}/deposit`).send({ amount: 50 });
    expect(res.status).toBe(200);

    const debitSql = executedSql.find((s) => s.includes('balance_cents = balance_cents - $1') && s.includes('FROM wallets') === false && s.includes('UPDATE wallets'));
    expect(debitSql).toBeDefined();
    // The critical guard: the debit must be conditional on sufficient balance.
    expect(debitSql).toContain('balance_cents >= $1');
  });

  it('rejects with 400 when the guarded debit affects 0 rows (lost the race)', async () => {
    mockTransaction.mockImplementation(async (fn: (client: { query: (sql: string, params?: unknown[]) => Promise<{ rowCount: number }> }) => Promise<unknown>) => {
      const client = {
        query: vi.fn(async (sql: string) => {
          // Simulate: another concurrent request already drained the wallet, so
          // the guarded debit matches no rows.
          if (sql.includes('UPDATE wallets') && sql.includes('balance_cents >= $1')) {
            return { rowCount: 0, rows: [] };
          }
          return { rowCount: 1, rows: [] };
        }),
      };
      return fn(client);
    });

    const res = await request(app).post(`/api/savings/vaults/${vaultId}/deposit`).send({ amount: 50 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Insufficient balance/);
  });
});
