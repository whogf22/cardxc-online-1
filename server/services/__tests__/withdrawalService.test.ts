/**
 * @vitest-environment node
 *
 * Regression tests for the crypto withdrawal money-movement flow.
 *
 * Two invariants under test:
 *
 *  1. CRITICAL-2 — ambiguous-broadcast refund safety. A crypto payout can only
 *     be refunded when we KNOW the funds never left custody (outcome
 *     'not_sent'). If the provider response is ambiguous ('unknown' — e.g. the
 *     broadcast may have gone out but the confirmation was lost) OR the payout
 *     call throws after the risky send, the balance must NOT be auto-refunded;
 *     the withdrawal is held for manual reconciliation instead. Refunding an
 *     ambiguous outcome is exactly the double-payout bug (send on-chain + give
 *     the money back).
 *
 *  2. Once an external crypto payout has CONFIRMED (funds left custody), a later
 *     bookkeeping failure must NEVER refund the balance.
 *
 * NOTE: the send path is gated behind CRYPTO_AUTO_PAYOUT_ENABLED (HIGH-3, tested
 * separately in withdrawalCryptoControls.test.ts). These tests enable it so the
 * refund-safety logic downstream of the send is exercised directly.
 */
import { beforeEach, afterEach, vi, describe, it, expect } from 'vitest';

const mockTransaction = vi.fn();
const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockSendCryptoToWallet = vi.fn();
const mockCreateAuditLog = vi.fn().mockResolvedValue(undefined);
const mockRunFraudChecks = vi.fn();

vi.mock('../../db/pool', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  transaction: (fn: (client: { query: typeof mockQuery }) => Promise<unknown>) => mockTransaction(fn),
}));
vi.mock('../auditService', () => ({ createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args) }));
vi.mock('../cryptoProviderService', () => ({
  sendCryptoToWallet: (...args: unknown[]) => mockSendCryptoToWallet(...args),
}));
vi.mock('../fraudService', () => ({
  runFraudChecks: (...args: unknown[]) => mockRunFraudChecks(...args),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

let processWithdrawal: typeof import('../withdrawalService')['processWithdrawal'];

beforeEach(async () => {
  vi.resetModules();
  // Enable auto-payout so the refund-safety logic (post-send) is reachable.
  process.env.CRYPTO_AUTO_PAYOUT_ENABLED = 'true';
  process.env.CRYPTO_AUTO_PAYOUT_MAX_USD = '1000000';
  mockRunFraudChecks.mockResolvedValue({ passed: true, flags: [], score: 0 });
  ({ processWithdrawal } = await import('../withdrawalService'));
});

afterEach(() => {
  delete process.env.CRYPTO_AUTO_PAYOUT_ENABLED;
  delete process.env.CRYPTO_AUTO_PAYOUT_MAX_USD;
  mockTransaction.mockReset();
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockSendCryptoToWallet.mockReset();
  mockCreateAuditLog.mockReset();
  mockRunFraudChecks.mockReset();
});

/**
 * Build a fake transaction() implementation. Each invocation gets a fresh
 * client whose query() is driven by `handler`. We record every SQL string that
 * runs so tests can assert whether a refund UPDATE happened.
 */
function installTransaction(executedSql: string[], opts: {
  balanceCents?: number;
  failBookkeeping?: boolean;
} = {}) {
  const { balanceCents = 100_00, failBookkeeping = false } = opts;
  mockTransaction.mockImplementation(async (fn: (client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }) => Promise<unknown>) => {
    const client = {
      query: vi.fn(async (sql: string) => {
        executedSql.push(sql);
        if (sql.includes('SELECT usdt_balance_cents')) {
          return { rows: [{ usdt_balance_cents: balanceCents }] };
        }
        if (sql.includes('INSERT INTO withdrawal_requests')) {
          return { rows: [{ id: 'wd-1' }] };
        }
        if (failBookkeeping && sql.includes('INSERT INTO crypto_ledger_entries')) {
          throw new Error('ledger insert failed');
        }
        return { rows: [] };
      }),
    };
    return fn(client);
  });
}

const baseReq = {
  type: 'crypto' as const,
  userId: 'user-1',
  amount: 50,
  walletAddress: 'TxxxxxxxxxxxxxxxxxxxxxxxxxxxxxYYYY',
  network: 'TRC20',
};

describe('processCryptoWithdrawal — refund safety (CRITICAL-2)', () => {
  it('does NOT refund when payout CONFIRMED but bookkeeping (ledger) failed', async () => {
    const executedSql: string[] = [];
    installTransaction(executedSql, { failBookkeeping: true });
    mockSendCryptoToWallet.mockResolvedValue({
      success: true,
      outcome: 'confirmed_sent',
      payoutId: 'payout-123',
      txHash: '0xabc',
      status: 'completed',
    });

    const result = await processWithdrawal(baseReq);

    expect(result.success).toBe(true);
    expect(mockSendCryptoToWallet).toHaveBeenCalledTimes(1);

    const refundHappened = executedSql.some(
      (sql) => sql.includes('usdt_balance_cents = usdt_balance_cents + $1'),
    );
    expect(refundHappened).toBe(false);
    const markedRejected = executedSql.some((sql) => sql.includes("status = 'rejected'"));
    expect(markedRejected).toBe(false);
  });

  it('DOES refund when payout is CONFIRMED-not-sent (failed before broadcast)', async () => {
    const executedSql: string[] = [];
    installTransaction(executedSql);
    mockSendCryptoToWallet.mockResolvedValue({
      success: false,
      outcome: 'not_sent',
      status: 'failed',
      error: 'provider rejected before broadcast',
    });

    await expect(processWithdrawal(baseReq)).rejects.toThrow(/Crypto withdrawal failed/);

    const refundHappened = executedSql.some(
      (sql) => sql.includes('usdt_balance_cents = usdt_balance_cents + $1'),
    );
    expect(refundHappened).toBe(true);
    const markedRejected = executedSql.some((sql) => sql.includes("status = 'rejected'"));
    expect(markedRejected).toBe(true);
  });

  it('does NOT refund on an AMBIGUOUS provider response (outcome unknown) — holds for reconciliation', async () => {
    const executedSql: string[] = [];
    installTransaction(executedSql);
    mockSendCryptoToWallet.mockResolvedValue({
      success: false,
      outcome: 'unknown',
      status: 'failed',
      error: 'No transaction ID returned',
    });

    // Must not throw a failure that implies the money is safe: it resolves to a
    // pending/manual-review result, and critically does not refund.
    const result = await processWithdrawal(baseReq);

    const refundHappened = executedSql.some(
      (sql) => sql.includes('usdt_balance_cents = usdt_balance_cents + $1'),
    );
    expect(refundHappened).toBe(false);
    const markedRejected = executedSql.some((sql) => sql.includes("status = 'rejected'"));
    expect(markedRejected).toBe(false);
    // A reconciliation hold must be recorded.
    const heldForReview = executedSql.some((sql) => sql.includes('admin_notes') && sql.includes('UPDATE withdrawal_requests'));
    expect(heldForReview).toBe(true);
    expect(result.requiresReconciliation).toBe(true);
    expect(result.status).toBe('held');
  });

  it('does NOT refund when the payout call THROWS after the send (ambiguous) — holds for reconciliation', async () => {
    const executedSql: string[] = [];
    installTransaction(executedSql);
    mockSendCryptoToWallet.mockRejectedValue(new Error('network timeout'));

    const result = await processWithdrawal(baseReq);

    const refundHappened = executedSql.some(
      (sql) => sql.includes('usdt_balance_cents = usdt_balance_cents + $1'),
    );
    expect(refundHappened).toBe(false);
    expect(result.requiresReconciliation).toBe(true);
    expect(result.status).toBe('held');
  });

  it('rejects before payout when USDT balance is insufficient', async () => {
    const executedSql: string[] = [];
    installTransaction(executedSql, { balanceCents: 10_00 }); // only $10, need $50

    await expect(processWithdrawal(baseReq)).rejects.toThrow(/Insufficient USDT balance/);
    expect(mockSendCryptoToWallet).not.toHaveBeenCalled();
  });
});
