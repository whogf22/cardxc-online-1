/**
 * @vitest-environment node
 *
 * NEW-7 (MEDIUM) — a persistence-free operation must not report success.
 *
 * `createManualPayoutRequest` returned:
 *
 *   { success: true, payoutId: `manual_${Date.now()}`, status: 'pending',
 *     outcome: 'not_sent', estimatedCompletionTime: 'Pending admin approval' }
 *
 * with the comment "Store in pending_crypto_payouts table (admin will process)".
 * That table does not exist anywhere in server/ and there is no INSERT — nothing
 * is persisted, so no admin can ever process it.
 *
 * Two consequences:
 *  (a) today: `success: true` / `status: 'pending'` contradicts
 *      `outcome: 'not_sent'`. The withdrawal service correctly reads the outcome
 *      and refunds, so no money is lost — but the provider layer is reporting a
 *      queued payout that does not exist.
 *  (b) latently: the moment anyone implements the promised persistence while
 *      leaving `outcome: 'not_sent'`, an admin processes a manual payout for a
 *      withdrawal that was ALREADY refunded and rejected — a double payout.
 *
 * It is reached when auto-payout is explicitly enabled AND the provider is
 * 'manual' (the default CRYPTO_PROVIDER) or TRON_HOT_WALLET_PRIVATE_KEY is unset.
 *
 * INVARIANTS PINNED HERE:
 *  - the manual path reports failure, not success
 *  - its response shape is internally consistent (no success+failed mix)
 *  - it never claims a pending/queued payout it did not persist
 *  - the withdrawal service refunds it (safe: nothing was sent, nothing queued)
 *    and never leaves the user debited with no record
 */
import { beforeEach, afterEach, vi, describe, it, expect } from 'vitest';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockTransaction = vi.fn();

vi.mock('../../db/pool', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  transaction: (fn: unknown) => mockTransaction(fn),
}));
vi.mock('../auditService', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../fraudService', () => ({
  runFraudChecks: vi.fn().mockResolvedValue({ passed: true, flags: [], score: 0 }),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const ENV_KEYS = [
  'CRYPTO_PROVIDER', 'TRON_HOT_WALLET_PRIVATE_KEY',
  'CRYPTO_AUTO_PAYOUT_ENABLED', 'CRYPTO_AUTO_PAYOUT_MAX_USD',
] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
  vi.resetModules();
});

afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
});

const payoutReq = {
  userId: 'user-1',
  amount: 50,
  amountCents: 5000,
  walletAddress: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',
  network: 'TRC20' as const,
  transactionId: 'wd-1',
};

async function loadProvider() {
  vi.resetModules();
  return await import('../cryptoProviderService');
}

describe('NEW-7: the manual payout path reports failure, not success', () => {
  it('CRYPTO_PROVIDER=manual returns success:false with a not_sent outcome', async () => {
    process.env.CRYPTO_PROVIDER = 'manual';
    const { sendCryptoToWallet } = await loadProvider();

    const res = await sendCryptoToWallet(payoutReq);

    // A persistence-free operation must not claim success.
    expect(res.success).toBe(false);
    // Nothing was broadcast, so refunding upstream is safe and correct.
    expect(res.outcome).toBe('not_sent');
  });

  it('does not claim a pending/queued payout it never persisted', async () => {
    process.env.CRYPTO_PROVIDER = 'manual';
    const { sendCryptoToWallet } = await loadProvider();

    const res = await sendCryptoToWallet(payoutReq);

    expect(res.status).not.toBe('pending');
    expect(res.status).toBe('failed');
    // No fabricated payout id / ETA for work that was never queued.
    expect(res.payoutId).toBeUndefined();
    expect(res.estimatedCompletionTime).toBeUndefined();
    expect(res.error).toBeTruthy();
  });

  it('writes nothing to the database (no phantom queue row)', async () => {
    process.env.CRYPTO_PROVIDER = 'manual';
    const { sendCryptoToWallet } = await loadProvider();

    await sendCryptoToWallet(payoutReq);

    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('a trongrid provider with no hot-wallet key falls back to the same fail-closed result', async () => {
    process.env.CRYPTO_PROVIDER = 'trongrid';
    delete process.env.TRON_HOT_WALLET_PRIVATE_KEY;
    const { sendCryptoToWallet } = await loadProvider();

    const res = await sendCryptoToWallet(payoutReq);

    expect(res.success).toBe(false);
    expect(res.status).toBe('failed');
    expect(res.outcome).toBe('not_sent');
  });

  it('the response shape is internally consistent (never success with a failed status)', async () => {
    process.env.CRYPTO_PROVIDER = 'manual';
    const { sendCryptoToWallet } = await loadProvider();

    const res = await sendCryptoToWallet(payoutReq);

    expect(res.success === (res.status !== 'failed')).toBe(true);
  });
});

describe('NEW-7: the withdrawal service resolves it safely (user is not left debited)', () => {
  it('refunds the USDT and rejects the withdrawal — no silent hold, no double payout window', async () => {
    process.env.CRYPTO_PROVIDER = 'manual';
    process.env.CRYPTO_AUTO_PAYOUT_ENABLED = 'true';
    process.env.CRYPTO_AUTO_PAYOUT_MAX_USD = '1000000';

    const executed: string[] = [];
    mockQueryOne.mockResolvedValue(null);
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    mockTransaction.mockImplementation(async (fn: any) => {
      const client = {
        query: vi.fn(async (sql: string) => {
          executed.push(String(sql).replace(/\s+/g, ' '));
          if (sql.includes('SELECT usdt_balance_cents')) return { rows: [{ usdt_balance_cents: 100_00 }], rowCount: 1 };
          if (sql.includes('INSERT INTO withdrawal_requests')) return { rows: [{ id: 'wd-1' }], rowCount: 1 };
          return { rows: [], rowCount: 1 };
        }),
      };
      return fn(client);
    });

    const { processWithdrawal } = await import('../withdrawalService');

    await expect(processWithdrawal({
      type: 'crypto', userId: 'user-1', amount: 50,
      walletAddress: payoutReq.walletAddress, network: 'TRC20',
    })).rejects.toThrow();

    // The user's USDT came back — nothing was sent and nothing was queued.
    const refunded = executed.some(s => /usdt_balance_cents\s*=\s*(COALESCE\(\s*usdt_balance_cents\s*,\s*0\s*\)|usdt_balance_cents)\s*\+/i.test(s));
    expect(refunded).toBe(true);
    // And the row is terminal, not left 'held' awaiting a payout nobody queued.
    const rejected = executed.some(s => s.includes('UPDATE withdrawal_requests') && s.includes("'rejected'"));
    expect(rejected).toBe(true);
  });
});
