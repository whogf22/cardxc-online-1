/**
 * @vitest-environment node
 *
 * Regression tests for CRITICAL-1: savings vault DELETE money-mint.
 *
 * Closing a vault returns its balance to the wallet. The vulnerable code read
 * balance_cents OUTSIDE the transaction, then credited that stale value and
 * deleted by id — so two concurrent deletes each read the same balance and each
 * credit it (money mint). The fix claims the row atomically inside the
 * transaction with a conditional DELETE ... RETURNING scoped by (id, user_id)
 * and credits only the balance the winning transaction actually deleted.
 *
 * Socket-free: driven in-process via invokeRouter (sandbox forbids listen()).
 */
import { beforeEach, afterEach, vi, describe, it, expect } from 'vitest';
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
}));
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1' };
    next();
  },
  AuthenticatedRequest: {},
}));
vi.mock('../../middleware/rateLimit', () => ({
  sensitiveOpLimiter: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

let savingsRouter: any;

beforeEach(async () => {
  vi.resetModules();
  ({ savingsRouter } = await import('../savings'));
});

afterEach(() => {
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
});

// Must be a real RFC-4122 UUID: the route now validates the path id with
// isUUID(), and validator.js requires a valid version nibble ([1-8]) and
// variant ([89ab]). The previous literal had variant '2' and is not a valid UUID.
const vaultId = '22222222-2222-4222-8222-222222222222';

describe('DELETE /vaults/:id — atomic claim (no money mint)', () => {
  it('claims via DELETE ... RETURNING scoped by user_id and credits only the claimed balance', async () => {
    // A stale pre-read (if used) would report a DIFFERENT balance than the row
    // the transaction actually deletes; asserting the credit uses the RETURNING
    // value (70_00) catches any reliance on an out-of-transaction read.
    mockQueryOne.mockResolvedValue({ id: vaultId, balance_cents: 50_00, currency: 'USD' });

    const executed: { sql: string; params?: unknown[] }[] = [];
    mockTransaction.mockImplementation(async (fn: any) => {
      const client = {
        query: vi.fn(async (sql: string, params?: unknown[]) => {
          executed.push({ sql, params });
          if (sql.includes('DELETE FROM savings_vaults')) {
            return { rowCount: 1, rows: [{ balance_cents: 70_00, currency: 'USD' }] };
          }
          return { rowCount: 1, rows: [] };
        }),
      };
      return fn(client);
    });

    const res = await invokeRouter(savingsRouter, 'DELETE', `/vaults/${vaultId}`);
    expect(res.status).toBe(200);

    const del = executed.find((e) => e.sql.includes('DELETE FROM savings_vaults'));
    expect(del, 'claim must run inside the transaction').toBeDefined();
    expect(del!.sql).toContain('user_id'); // ownership enforced in the claim itself
    expect(del!.sql).toContain('RETURNING'); // balance sourced from the claimed row

    const credit = executed.find((e) => e.sql.includes('wallets') && e.sql.includes('balance_cents'));
    expect(credit, 'wallet must be credited from the claimed balance').toBeDefined();
    expect(credit!.params).toContain(70_00); // from RETURNING, not the 50_00 pre-read

    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('does NOT credit the wallet when the claim matches 0 rows (concurrent loser) and returns 404', async () => {
    // The pre-read still "sees" a vault; the authoritative claim inside the
    // transaction loses the race and must move no money.
    mockQueryOne.mockResolvedValue({ id: vaultId, balance_cents: 50_00, currency: 'USD' });

    const executed: string[] = [];
    mockTransaction.mockImplementation(async (fn: any) => {
      const client = {
        query: vi.fn(async (sql: string) => {
          executed.push(sql);
          if (sql.includes('DELETE FROM savings_vaults')) {
            return { rowCount: 0, rows: [] }; // another transaction already claimed it
          }
          return { rowCount: 1, rows: [] };
        }),
      };
      return fn(client);
    });

    const res = await invokeRouter(savingsRouter, 'DELETE', `/vaults/${vaultId}`);
    expect(res.status).toBe(404);
    const creditRan = executed.some((s) => s.includes('wallets') && s.includes('balance_cents'));
    expect(creditRan).toBe(false);
  });

  it('deletes a zero-balance vault without crediting the wallet', async () => {
    mockQueryOne.mockResolvedValue({ id: vaultId, balance_cents: 0, currency: 'USD' });

    const executed: string[] = [];
    mockTransaction.mockImplementation(async (fn: any) => {
      const client = {
        query: vi.fn(async (sql: string) => {
          executed.push(sql);
          if (sql.includes('DELETE FROM savings_vaults')) {
            return { rowCount: 1, rows: [{ balance_cents: 0, currency: 'USD' }] };
          }
          return { rowCount: 1, rows: [] };
        }),
      };
      return fn(client);
    });

    const res = await invokeRouter(savingsRouter, 'DELETE', `/vaults/${vaultId}`);
    expect(res.status).toBe(200);
    const creditRan = executed.some((s) => s.includes('wallets') && s.includes('balance_cents'));
    expect(creditRan).toBe(false);
  });
});
