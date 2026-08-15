/**
 * @vitest-environment node
 *
 * Regression tests for the crypto withdrawal money-movement flow.
 *
 * The critical invariant under test: once an external crypto payout has
 * SUCCEEDED (funds have left custody), a later bookkeeping failure must NEVER
 * refund the user's balance. Refunds are only allowed when the payout itself
 * failed before any funds moved.
 */
import { beforeEach, afterEach, vi, describe, it, expect } from 'vitest';

const mockTransaction = vi.fn();
const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockSendCryptoToWallet = vi.fn();
const mockAutomatedConfigured = vi.fn();
const mockCreateAuditLog = vi.fn().mockResolvedValue(undefined);

vi.mock('../../db/pool', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  transaction: (fn: (client: { query: typeof mockQuery }) => Promise<unknown>) => mockTransaction(fn),
}));
vi.mock('../auditService', () => ({ createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args) }));
vi.mock('../cryptoProviderService', () => ({
  sendCryptoToWallet: (...args: unknown[]) => mockSendCryptoToWallet(...args),
  isAutomatedCryptoPayoutConfigured: (...args: unknown[]) => mockAutomatedConfigured(...args),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

let processWithdrawal: typeof import('../withdrawalService')['processWithdrawal'];

beforeEach(async () => {
  vi.resetModules();
  // Default: an automated payout provider IS configured, so the existing
  // money-movement tests exercise the send path. The manual-mode test overrides.
  mockAutomatedConfigured.mockReturnValue(true);
  ({ processWithdrawal } = await import('../withdrawalService'));
});

afterEach(() => {
  mockTransaction.mockReset();
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockSendCryptoToWallet.mockReset();
  mockAutomatedConfigured.mockReset();
  mockCreateAuditLog.mockReset();
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

describe('processCryptoWithdrawal double-spend protection', () => {
  const baseReq = {
    type: 'crypto' as const,
    userId: 'user-1',
    amount: 50,
    walletAddress: 'TxxxxxxxxxxxxxxxxxxxxxxxxxxxxxYYYY',
    network: 'TRC20',
  };

  it('does NOT refund when payout succeeded but bookkeeping (ledger) failed', async () => {
    const executedSql: string[] = [];
    installTransaction(executedSql, { failBookkeeping: true });
    mockSendCryptoToWallet.mockResolvedValue({
      success: true,
      payoutId: 'payout-123',
      txHash: '0xabc',
      status: 'completed',
    });

    const result = await processWithdrawal(baseReq);

    // Withdrawal still reported as success (funds already sent on-chain).
    expect(result.success).toBe(true);
    expect(mockSendCryptoToWallet).toHaveBeenCalledTimes(1);

    // The refund path must NOT have run: no wallet credit-back UPDATE.
    const refundHappened = executedSql.some(
      (sql) => sql.includes('usdt_balance_cents = usdt_balance_cents + $1'),
    );
    expect(refundHappened).toBe(false);

    // And it must NOT have been marked rejected.
    const markedRejected = executedSql.some((sql) => sql.includes("status = 'rejected'"));
    expect(markedRejected).toBe(false);
  });

  it('DOES refund when the external payout fails', async () => {
    const executedSql: string[] = [];
    installTransaction(executedSql);
    mockSendCryptoToWallet.mockResolvedValue({
      success: false,
      status: 'failed',
      error: 'provider down',
    });

    await expect(processWithdrawal(baseReq)).rejects.toThrow(/Crypto withdrawal failed/);

    // Refund UPDATE must have run exactly once.
    const refundHappened = executedSql.some(
      (sql) => sql.includes('usdt_balance_cents = usdt_balance_cents + $1'),
    );
    expect(refundHappened).toBe(true);

    const markedRejected = executedSql.some((sql) => sql.includes("status = 'rejected'"));
    expect(markedRejected).toBe(true);
  });

  it('rejects and refunds when payout throws unexpectedly', async () => {
    const executedSql: string[] = [];
    installTransaction(executedSql);
    mockSendCryptoToWallet.mockRejectedValue(new Error('network timeout'));

    await expect(processWithdrawal(baseReq)).rejects.toThrow(/Crypto withdrawal failed/);

    const refundHappened = executedSql.some(
      (sql) => sql.includes('usdt_balance_cents = usdt_balance_cents + $1'),
    );
    expect(refundHappened).toBe(true);
  });

  it('rejects before payout when USDT balance is insufficient', async () => {
    const executedSql: string[] = [];
    installTransaction(executedSql, { balanceCents: 10_00 }); // only $10, need $50

    await expect(processWithdrawal(baseReq)).rejects.toThrow(/Insufficient USDT balance/);

    // Payout must never be attempted when balance is insufficient.
    expect(mockSendCryptoToWallet).not.toHaveBeenCalled();
  });

  it('fails closed WITHOUT debiting when no automated crypto provider is configured', async () => {
    // Manual mode (the default) has no automated dispatch. A crypto withdrawal
    // here would debit the balance and leave a withdrawal_request in
    // 'processing', which the admin approve/reject endpoints (they require
    // status = 'pending') can neither complete nor reverse — stranding funds.
    const executedSql: string[] = [];
    installTransaction(executedSql);
    mockAutomatedConfigured.mockReturnValue(false);

    await expect(processWithdrawal(baseReq)).rejects.toThrow(/not available|unavailable|not configured/i);

    // The gate is consulted with the request network before any debit.
    expect(mockAutomatedConfigured).toHaveBeenCalledWith('TRC20');
    // No external payout attempted and, crucially, no balance deducted.
    expect(mockSendCryptoToWallet).not.toHaveBeenCalled();
    const debited = executedSql.some((sql) => sql.includes('usdt_balance_cents = usdt_balance_cents - $1'));
    expect(debited).toBe(false);
  });

  it('fails closed for a non-TRC20 TronGrid network WITHOUT debiting', async () => {
    // TronGrid dispatches only TRC20; an ERC20 request would otherwise fall to
    // the stranding manual path. The network-aware gate must reject it first.
    const executedSql: string[] = [];
    installTransaction(executedSql);
    // Simulate the network-aware predicate returning false for ERC20.
    mockAutomatedConfigured.mockReturnValue(false);

    await expect(
      processWithdrawal({ ...baseReq, network: 'ERC20' }),
    ).rejects.toThrow(/not available|unavailable|not configured/i);

    expect(mockAutomatedConfigured).toHaveBeenCalledWith('ERC20');
    expect(mockSendCryptoToWallet).not.toHaveBeenCalled();
    const debited = executedSql.some((sql) => sql.includes('usdt_balance_cents = usdt_balance_cents - $1'));
    expect(debited).toBe(false);
  });
});
