/**
 * @vitest-environment node
 *
 * Regression tests for the TRC-20 deposit monitor's double-credit protection.
 *
 * Critical invariant: crediting a pending deposit must atomically claim the row
 * (UPDATE ... WHERE status = 'pending'). If a concurrent monitor pass already
 * claimed it, the losing pass must abort BEFORE crediting the wallet or writing
 * ledger entries, so the same on-chain deposit is never credited twice.
 */
import { beforeEach, afterEach, vi, describe, it, expect } from 'vitest';

const mockTransaction = vi.fn();
const mockQuery = vi.fn();
const mockQueryOne = vi.fn();

vi.mock('../../db/pool', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  transaction: (fn: (client: { query: typeof mockQuery }) => Promise<unknown>) => mockTransaction(fn),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

afterEach(() => {
  mockTransaction.mockReset();
  mockQuery.mockReset();
  mockQueryOne.mockReset();
});

function makeClient(executed: string[], claimRowCount: number) {
  return {
    query: vi.fn(async (sql: string) => {
      executed.push(sql);
      if (sql.includes('UPDATE crypto_transactions') && sql.includes("status = 'completed'")) {
        return { rows: [], rowCount: claimRowCount };
      }
      return { rows: [], rowCount: 1 };
    }),
  };
}

describe('creditUserDeposit atomic claim', () => {
  it('claims the pending row with a status guard before crediting the wallet', async () => {
    const executed: string[] = [];
    mockTransaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) =>
      fn(makeClient(executed, 1)));

    const { creditUserDeposit } = await import('../tronDepositMonitor');
    await creditUserDeposit('user-1', 'pending-tx-1', '0xabc', 5, 'TSender', Date.now());

    const claimSql = executed.find((s) => s.includes('UPDATE crypto_transactions') && s.includes("status = 'completed'"));
    expect(claimSql).toBeDefined();
    expect(claimSql).toContain("status = 'pending'");

    // The claim must precede the wallet credit and ledger writes.
    const claimIdx = executed.findIndex((s) => s.includes("status = 'pending'"));
    const walletIdx = executed.findIndex((s) => s.includes('INSERT INTO wallets'));
    expect(claimIdx).toBeGreaterThanOrEqual(0);
    expect(walletIdx).toBeGreaterThan(claimIdx);
  });

  it('aborts without crediting when the claim affects 0 rows (lost race)', async () => {
    const executed: string[] = [];
    mockTransaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) =>
      fn(makeClient(executed, 0)));

    const { creditUserDeposit } = await import('../tronDepositMonitor');

    // Should resolve (benign no-op), not reject, since the deposit was already
    // credited by a concurrent pass.
    await expect(
      creditUserDeposit('user-1', 'pending-tx-1', '0xabc', 5, 'TSender', Date.now())
    ).resolves.toBeUndefined();

    // No wallet credit, no ledger entry, no user-facing transaction row.
    expect(executed.some((s) => s.includes('INSERT INTO wallets'))).toBe(false);
    expect(executed.some((s) => s.includes('crypto_ledger_entries'))).toBe(false);
    expect(executed.some((s) => s.includes('INSERT INTO transactions'))).toBe(false);
  });
});
