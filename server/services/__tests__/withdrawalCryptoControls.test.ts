/**
 * @vitest-environment node
 *
 * HIGH-3 — crypto withdrawal auto-execution control gate.
 * HIGH-4 — withdrawal idempotency.
 *
 * HIGH-3: an unattended service must not broadcast an on-chain payout with no
 * cap, no velocity/fraud gate, and no explicit operator opt-in. Auto-payout is
 * DEFAULT-OFF; when off (or over the cap, or when the fraud gate trips) the
 * withdrawal is deducted and HELD for manual review — the external send is never
 * called and the balance is NOT refunded (the funds are held, not lost).
 *
 * HIGH-4: submitting the same logical withdrawal twice (same idempotency key)
 * must produce at most one financial effect. The second submit returns the
 * prior request instead of deducting again or sending again.
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

function installTransaction(executedSql: string[], opts: {
  balanceCents?: number;
  insertThrowsDuplicate?: boolean;
} = {}) {
  const { balanceCents = 100_00, insertThrowsDuplicate = false } = opts;
  mockTransaction.mockImplementation(async (fn: (client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }) => Promise<unknown>) => {
    const client = {
      query: vi.fn(async (sql: string) => {
        executedSql.push(sql);
        if (sql.includes('SELECT usdt_balance_cents')) {
          return { rows: [{ usdt_balance_cents: balanceCents }] };
        }
        if (sql.includes('INSERT INTO withdrawal_requests')) {
          if (insertThrowsDuplicate) {
            const err: any = new Error('duplicate key value violates unique constraint');
            err.code = '23505';
            throw err;
          }
          return { rows: [{ id: 'wd-1' }] };
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

describe('HIGH-3: crypto auto-payout control gate', () => {
  it('DEFAULT-OFF: does not call the external send; holds for manual review; no refund', async () => {
    // No CRYPTO_AUTO_PAYOUT_ENABLED set.
    const executedSql: string[] = [];
    installTransaction(executedSql);

    const result = await processWithdrawal(baseReq);

    expect(mockSendCryptoToWallet).not.toHaveBeenCalled();
    // Funds stay deducted (held), NOT refunded.
    const refundHappened = executedSql.some((sql) => sql.includes('usdt_balance_cents = usdt_balance_cents + $1'));
    expect(refundHappened).toBe(false);
    // Marked for manual review.
    const heldForReview = executedSql.some((sql) => sql.includes('UPDATE withdrawal_requests') && sql.includes('admin_notes'));
    expect(heldForReview).toBe(true);
    // NEW-1: the held state is now EXPLICIT ('held'), not the ambiguous
    // 'processing' this previously matched. 'processing' meant "broadcast in
    // flight" AND "awaiting an operator", and because the admin resolvers only
    // accepted 'pending' the row was unreachable — the user's USDT was debited
    // with no path to settle or refund it. Asserting the exact state (rather than
    // the old /processing|manual/ alternation) pins the lifecycle value the
    // admin USDT resolvers key on.
    expect(result.status).toBe('held');
  });

  it('over the cap: holds for manual review even when enabled', async () => {
    process.env.CRYPTO_AUTO_PAYOUT_ENABLED = 'true';
    process.env.CRYPTO_AUTO_PAYOUT_MAX_USD = '25'; // amount 50 > cap 25
    const executedSql: string[] = [];
    installTransaction(executedSql);

    await processWithdrawal(baseReq);

    expect(mockSendCryptoToWallet).not.toHaveBeenCalled();
  });

  it('fraud gate fails: holds for manual review, does not send', async () => {
    process.env.CRYPTO_AUTO_PAYOUT_ENABLED = 'true';
    process.env.CRYPTO_AUTO_PAYOUT_MAX_USD = '1000000';
    mockRunFraudChecks.mockResolvedValue({ passed: false, flags: ['MULTIPLE_WITHDRAWAL_REQUESTS'], score: 80 });
    const executedSql: string[] = [];
    installTransaction(executedSql);

    await processWithdrawal(baseReq);

    expect(mockSendCryptoToWallet).not.toHaveBeenCalled();
    expect(mockRunFraudChecks).toHaveBeenCalled();
  });

  it('enabled + under cap + fraud passes: DOES call the external send', async () => {
    process.env.CRYPTO_AUTO_PAYOUT_ENABLED = 'true';
    process.env.CRYPTO_AUTO_PAYOUT_MAX_USD = '1000000';
    const executedSql: string[] = [];
    installTransaction(executedSql);
    mockSendCryptoToWallet.mockResolvedValue({
      success: true, outcome: 'confirmed_sent', payoutId: 'p1', txHash: '0xabc', status: 'completed',
    });

    await processWithdrawal(baseReq);

    expect(mockSendCryptoToWallet).toHaveBeenCalledTimes(1);
    // Fraud gate must run with the amount in CENTS (5000), matching fraudService's unit.
    expect(mockRunFraudChecks).toHaveBeenCalledWith(expect.objectContaining({ action: 'WITHDRAWAL', amount: 5000 }));
  });
});

describe('NEW-1: held lifecycle is explicit and asset-tagged', () => {
  it('creates the crypto withdrawal in the held state, tagged asset_type usdt', async () => {
    const executedSql: string[] = [];
    installTransaction(executedSql);

    const result = await processWithdrawal(baseReq);

    const insert = executedSql.find((sql) => sql.includes('INSERT INTO withdrawal_requests'));
    expect(insert).toBeDefined();
    // The row must be resolvable by the admin USDT endpoints, which key on
    // status = 'held' AND asset_type = 'usdt'.
    expect(insert).toMatch(/'held'/);
    expect(insert).toMatch(/asset_type/);
    expect(insert).toMatch(/'usdt'/);
    expect(result.status).toBe('held');
    expect(result.requiresReview).toBe(true);
  });

  it('the hold marker keeps the row held (never reverts it to processing)', async () => {
    const executedSql: string[] = [];
    installTransaction(executedSql);

    await processWithdrawal(baseReq);

    const marker = executedSql.find(
      (sql) => sql.includes('UPDATE withdrawal_requests') && sql.includes('admin_notes'),
    );
    expect(marker).toBeDefined();
    expect(marker).toMatch(/status\s*=\s*'held'/i);
    expect(marker).not.toMatch(/status\s*=\s*'processing'/i);
  });

  it('a USDT-funded BANK withdrawal is also held (funds debited, no fiat reserve)', async () => {
    const executedSql: string[] = [];
    mockTransaction.mockImplementation(async (fn: any) => {
      const client = {
        query: vi.fn(async (sql: string) => {
          executedSql.push(sql);
          if (sql.includes('SELECT balance_cents')) {
            return { rows: [{ balance_cents: 0, usdt_balance_cents: 100_00, reserved_cents: 0 }] };
          }
          if (sql.includes('INSERT INTO withdrawal_requests')) return { rows: [{ id: 'wd-bank-usdt' }], rowCount: 1 };
          return { rows: [], rowCount: 1 };
        }),
      };
      return fn(client);
    });

    await processWithdrawal({
      type: 'bank', userId: 'user-1', amount: 50, currency: 'USD', walletType: 'usdt',
      bankName: 'Test Bank', accountNumber: '123', accountName: 'A Name',
    } as any);

    const insert = executedSql.find((sql) => sql.includes('INSERT INTO withdrawal_requests'));
    expect(insert).toBeDefined();
    // No fiat reserve was taken, so it must not sit in the fiat 'pending' queue.
    const reservedFiat = executedSql.some((sql) => sql.includes('reserved_cents ='));
    expect(reservedFiat).toBe(false);
  });

  it('a FIAT bank withdrawal stays pending and reserves fiat', async () => {
    const executedSql: string[] = [];
    mockTransaction.mockImplementation(async (fn: any) => {
      const client = {
        query: vi.fn(async (sql: string) => {
          executedSql.push(sql);
          if (sql.includes('SELECT balance_cents')) {
            return { rows: [{ balance_cents: 100_00, usdt_balance_cents: 0, reserved_cents: 0 }] };
          }
          if (sql.includes('INSERT INTO withdrawal_requests')) return { rows: [{ id: 'wd-bank-fiat' }], rowCount: 1 };
          return { rows: [], rowCount: 1 };
        }),
      };
      return fn(client);
    });

    await processWithdrawal({
      type: 'bank', userId: 'user-1', amount: 50, currency: 'USD', walletType: 'fiat',
      bankName: 'Test Bank', accountNumber: '123', accountName: 'A Name',
    } as any);

    const reservedFiat = executedSql.some((sql) => sql.includes('reserved_cents ='));
    expect(reservedFiat).toBe(true);
  });
});

describe('HIGH-4: withdrawal idempotency', () => {
  it('duplicate idempotency key: returns the prior request, no second send', async () => {
    process.env.CRYPTO_AUTO_PAYOUT_ENABLED = 'true';
    process.env.CRYPTO_AUTO_PAYOUT_MAX_USD = '1000000';
    const executedSql: string[] = [];
    installTransaction(executedSql, { insertThrowsDuplicate: true });
    // The prior withdrawal (created by the first submit) is found by key.
    mockQueryOne.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM withdrawal_requests') && sql.includes('idempotency_key')) {
        return { id: 'wd-prior', status: 'processing', tx_hash: '0xprior' };
      }
      return null;
    });

    const result = await processWithdrawal({ ...baseReq, idempotencyKey: 'key-123' } as any);

    // No second on-chain send.
    expect(mockSendCryptoToWallet).not.toHaveBeenCalled();
    // Idempotent success referencing the prior request.
    expect(result.success).toBe(true);
    expect(result.withdrawalId).toBe('wd-prior');
  });
});
