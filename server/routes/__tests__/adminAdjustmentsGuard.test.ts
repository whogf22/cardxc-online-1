/**
 * @vitest-environment node
 *
 * Regression tests for admin adjustment approve/reject race protection.
 *
 * Invariant: approving or rejecting an admin_adjustments row must be an
 * atomically-claimed UPDATE (... WHERE status = 'PENDING') so two concurrent
 * approve calls (or an approve racing a reject) cannot both credit/debit the
 * user's wallet - a plain read-then-write here would double-process the
 * same adjustment.
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
vi.mock('../../services/auditService', () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
  getAuditLogs: vi.fn(),
  exportAuditLogsToCSV: vi.fn(),
}));
vi.mock('../../services/fraudService', () => ({ getFraudFlags: vi.fn() }));
vi.mock('../../services/stripeService', () => ({
  isStripeConfigured: vi.fn(() => false),
  createPaymentIntent: vi.fn(),
  getPaymentIntent: vi.fn(),
}));
vi.mock('../../services/fluzClient', () => ({ isFluzConfigured: vi.fn(() => false) }));
vi.mock('../../middleware/securityLogger', () => ({
  getSecurityEvents: vi.fn(),
  getSecurityEventsByType: vi.fn(),
  getSecurityEventsByIP: vi.fn(),
}));
vi.mock('../../middleware/rateLimit', () => ({
  getRateLimitViolations: vi.fn(),
  clearRateLimitViolations: vi.fn(),
}));
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: express.Request & { user?: unknown }, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { user: { id: string; role: string } }).user = { id: 'admin-1', role: 'SUPER_ADMIN' };
    next();
  },
  requireRole: (..._roles: string[]) => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  AuthenticatedRequest: {},
}));

let app: express.Express;

beforeAll(async () => {
  vi.resetModules();
  const admin = await import('../admin');
  app = express();
  app.use(express.json());
  app.use('/api/admin', admin.adminRouter);
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

describe('POST /api/admin/adjustments/:adjustmentId/approve guarded claim', () => {
  beforeEach(() => {
    mockQueryOne.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM admin_adjustments')) {
        return { id: 'adj-1', user_id: 'user-1', type: 'credit', amount_cents: 5000, currency: 'USD', reason: 'test', status: 'PENDING' };
      }
      return null;
    });
  });

  it('claims via UPDATE ... WHERE status = PENDING before touching the wallet', async () => {
    const executedSql: string[] = [];
    mockTransaction.mockImplementation(async (fn: (client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }> }) => Promise<unknown>) => {
      const client = {
        query: vi.fn(async (sql: string) => {
          executedSql.push(sql);
          return { rows: [], rowCount: 1 };
        }),
      };
      return fn(client);
    });

    const res = await request(app).post('/api/admin/adjustments/adj-1/approve').send({});
    expect(res.status).toBe(200);

    const claimSql = executedSql.find((s) => s.includes('UPDATE admin_adjustments') && s.includes("SET status = 'APPROVED'"));
    expect(claimSql).toBeDefined();
    expect(claimSql).toContain("AND status = 'PENDING'");
  });

  it('rejects with 400 when the claim affects 0 rows (already processed by a concurrent request)', async () => {
    mockTransaction.mockImplementation(async (fn: (client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }> }) => Promise<unknown>) => {
      const client = {
        query: vi.fn(async (sql: string) => {
          if (sql.includes('UPDATE admin_adjustments') && sql.includes("SET status = 'APPROVED'")) {
            return { rows: [], rowCount: 0 };
          }
          return { rows: [], rowCount: 1 };
        }),
      };
      return fn(client);
    });

    const res = await request(app).post('/api/admin/adjustments/adj-1/approve').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already processed/i);
  });
});

describe('POST /api/admin/adjustments/:adjustmentId/reject guarded claim', () => {
  it('rejects with 400 when the claim affects 0 rows (already processed)', async () => {
    mockTransaction.mockImplementation(async (fn: (client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }> }) => Promise<unknown>) => {
      const client = {
        query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
      };
      return fn(client);
    });

    const res = await request(app).post('/api/admin/adjustments/adj-1/reject').send({ reason: 'not needed anymore' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already processed/i);
  });
});
