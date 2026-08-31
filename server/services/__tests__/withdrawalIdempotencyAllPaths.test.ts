/**
 * @vitest-environment node
 *
 * NEW-8 (MEDIUM) — idempotency was claimed platform-wide but delivered for
 * crypto only.
 *
 * `idempotencyKey?: string` was added to ALL THREE withdrawal request interfaces
 * (bank, crypto, platform), and `extractIdempotencyKey()` reads the standard
 * `Idempotency-Key` header — but the key was only ever passed by, and only ever
 * read inside, the crypto path:
 *
 *   withdrawal.ts:/bank      -> processWithdrawal({...})  // key never passed
 *   withdrawal.ts:/platform  -> processWithdrawal({...})  // key never passed
 *   processBankWithdrawal    -> never references idempotencyKey
 *   processPlatformTransfer  -> never references idempotencyKey
 *
 * A client sending `Idempotency-Key` to /api/withdraw/bank therefore got a
 * silently NON-idempotent request: a double submit created two reserves and two
 * withdrawal rows. The dead interface fields made the API look protected when it
 * was not, which is worse than having no key at all.
 *
 * INVARIANTS PINNED HERE:
 *  - bank and platform accept and honour the key
 *  - a repeat submit returns the PRIOR record, creating no second reserve/row
 *  - the DB unique index (not a SELECT) is the authoritative claim: a concurrent
 *    duplicate that loses on 23505 is translated to idempotent success, not a 500
 *  - reserve + withdrawal row are one transaction (the loser's reserve rolls back)
 *  - the SAME key with a CONFLICTING payload is rejected, never silently
 *    returning someone else's record
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
vi.mock('../cryptoProviderService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../cryptoProviderService')>()),
  sendCryptoToWallet: vi.fn(),
}));
vi.mock('../fraudService', () => ({
  runFraudChecks: vi.fn().mockResolvedValue({ passed: true, flags: [], score: 0 }),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

let processWithdrawal: typeof import('../withdrawalService')['processWithdrawal'];

beforeEach(async () => {
  vi.resetModules();
  ({ processWithdrawal } = await import('../withdrawalService'));
});

afterEach(() => {
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
});

interface WireOpts {
  /** A prior row found by (user_id, idempotency_key) on the pre-check. */
  prior?: Record<string, unknown> | null;
  /** Make the withdrawal INSERT raise a unique violation (concurrent duplicate). */
  insertThrowsDuplicate?: boolean;
  balanceCents?: number;
  usdtBalanceCents?: number;
}

function wire(opts: WireOpts = {}) {
  const {
    prior = null, insertThrowsDuplicate = false,
    balanceCents = 100_000, usdtBalanceCents = 100_000,
  } = opts;
  const executed: Array<{ sql: string; params: unknown[] }> = [];
  let rolledBack = false;

  mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  mockQueryOne.mockImplementation(async (sql: string) => {
    const s = String(sql);
    if (s.includes('FROM withdrawal_requests') && s.includes('idempotency_key')) return prior;
    if (s.includes('FROM transactions') && s.includes('idempotency_key')) return prior;
    return null;
  });

  mockTransaction.mockImplementation(async (fn: any) => {
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        const flat = String(sql).replace(/\s+/g, ' ');
        executed.push({ sql: flat, params: params ?? [] });

        if (flat.includes('SELECT balance_cents')) {
          return {
            rows: [{ balance_cents: balanceCents, usdt_balance_cents: usdtBalanceCents, reserved_cents: 0 }],
            rowCount: 1,
          };
        }
        if (flat.includes('SELECT usdt_balance_cents')) {
          return { rows: [{ usdt_balance_cents: usdtBalanceCents }], rowCount: 1 };
        }
        if (flat.includes('FROM users')) {
          return { rows: [{ id: 'user-2', email: 'r@test.com', full_name: 'Recipient' }], rowCount: 1 };
        }
        if (flat.includes('INSERT INTO withdrawal_requests')) {
          if (insertThrowsDuplicate) {
            const err: any = new Error('duplicate key value violates unique constraint "idx_withdrawal_requests_idempotency_unique"');
            err.code = '23505';
            err.constraint = 'idx_withdrawal_requests_idempotency_unique';
            throw err;
          }
          return { rows: [{ id: 'wd-new' }], rowCount: 1 };
        }
        if (flat.includes('INSERT INTO transactions')) {
          if (insertThrowsDuplicate) {
            const err: any = new Error('duplicate key value violates unique constraint "idx_transactions_idempotency_unique"');
            err.code = '23505';
            err.constraint = 'idx_transactions_idempotency_unique';
            throw err;
          }
          return { rows: [{ id: 'tx-new' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
    };
    try {
      return await fn(client);
    } catch (e) {
      rolledBack = true;
      throw e;
    }
  });

  return { executed, didRollBack: () => rolledBack };
}

const bankReq = (over: Record<string, unknown> = {}) => ({
  type: 'bank' as const,
  userId: 'user-1',
  amount: 50,
  currency: 'USD',
  walletType: 'fiat' as const,
  bankName: 'Test Bank',
  accountNumber: '123456',
  accountName: 'A Name',
  idempotencyKey: 'key-abc',
  ...over,
});

const platformReq = (over: Record<string, unknown> = {}) => ({
  type: 'platform' as const,
  userId: 'user-1',
  recipientEmail: 'r@test.com',
  amount: 50,
  walletType: 'fiat' as const,
  idempotencyKey: 'key-abc',
  ...over,
});

const reserveWrites = (ex: Array<{ sql: string; params: unknown[] }>) =>
  ex.filter(e => e.sql.includes('UPDATE wallets') && e.sql.includes('reserved_cents ='));
const withdrawalInserts = (ex: Array<{ sql: string; params: unknown[] }>) =>
  ex.filter(e => e.sql.includes('INSERT INTO withdrawal_requests'));
const debitWrites = (ex: Array<{ sql: string; params: unknown[] }>) =>
  ex.filter(e => e.sql.includes('UPDATE wallets') && e.sql.includes('balance_cents = balance_cents - $1'));

describe('NEW-8: bank withdrawal honours the idempotency key', () => {
  it('persists the key so the DB unique index can dedupe', async () => {
    const { executed } = wire();

    await processWithdrawal(bankReq());

    const insert = withdrawalInserts(executed)[0];
    expect(insert).toBeDefined();
    expect(insert.sql).toContain('idempotency_key');
    expect(insert.params).toContain('key-abc');
  });

  it('a repeat submit returns the PRIOR row: no second reserve, no second row', async () => {
    const { executed } = wire({
      prior: {
        id: 'wd-prior', status: 'pending', tx_hash: null,
        amount_cents: 5000, currency: 'USD', withdrawal_type: 'bank', asset_type: 'fiat',
        bank_name: 'Test Bank', account_number: '123456', account_name: 'A Name',
      },
    });

    const result = await processWithdrawal(bankReq());

    expect(result.withdrawalId).toBe('wd-prior');
    expect(result.idempotent).toBe(true);
    expect(reserveWrites(executed).length).toBe(0);
    expect(withdrawalInserts(executed).length).toBe(0);
  });

  it('a concurrent duplicate losing on 23505 returns idempotent success, not a 500', async () => {
    // Pre-check finds nothing (both requests raced past it); the INSERT collides.
    let call = 0;
    mockQueryOne.mockImplementation(async (sql: string) => {
      if (String(sql).includes('idempotency_key')) {
        call += 1;
        // First (pre-check) miss, second (post-23505) lookup finds the winner.
        return call === 1 ? null : {
          id: 'wd-winner', status: 'pending', tx_hash: null,
          amount_cents: 5000, currency: 'USD', withdrawal_type: 'bank', asset_type: 'fiat',
          bank_name: 'Test Bank', account_number: '123456', account_name: 'A Name',
        };
      }
      return null;
    });
    const { executed, didRollBack } = wire({ insertThrowsDuplicate: true });
    // Re-install the two-phase queryOne after wire() overwrote it.
    call = 0;
    mockQueryOne.mockImplementation(async (sql: string) => {
      if (String(sql).includes('idempotency_key')) {
        call += 1;
        return call === 1 ? null : {
          id: 'wd-winner', status: 'pending', tx_hash: null,
          amount_cents: 5000, currency: 'USD', withdrawal_type: 'bank', asset_type: 'fiat',
          bank_name: 'Test Bank', account_number: '123456', account_name: 'A Name',
        };
      }
      return null;
    });

    const result = await processWithdrawal(bankReq());

    expect(result.idempotent).toBe(true);
    expect(result.withdrawalId).toBe('wd-winner');
    // The loser's reserve rolled back with its transaction.
    expect(didRollBack()).toBe(true);
    expect(withdrawalInserts(executed).length).toBe(1); // attempted, then rolled back
  });

  it('the SAME key with a CONFLICTING payload is rejected', async () => {
    const { executed } = wire({
      prior: {
        id: 'wd-prior', status: 'pending', tx_hash: null,
        amount_cents: 5000, currency: 'USD', withdrawal_type: 'bank', asset_type: 'fiat',
        bank_name: 'Test Bank', account_number: '123456', account_name: 'A Name',
      },
    });

    // Same key, different amount.
    await expect(processWithdrawal(bankReq({ amount: 999 }))).rejects.toThrow(/idempotency/i);
    expect(reserveWrites(executed).length).toBe(0);
    expect(withdrawalInserts(executed).length).toBe(0);
  });

  it('a request with NO key stays non-idempotent (unchanged behaviour)', async () => {
    const { executed } = wire();

    await processWithdrawal(bankReq({ idempotencyKey: undefined }));

    const insert = withdrawalInserts(executed)[0];
    expect(insert).toBeDefined();
    expect(insert.params).toContain(null); // NULL key -> partial index ignores it
  });
});

describe('NEW-8: platform transfer honours the idempotency key', () => {
  it('a repeat submit returns the prior transfer and moves no money', async () => {
    const { executed } = wire({
      prior: {
        id: 'tx-prior', amount_cents: 5000, currency: 'USD', description: 'Transfer', status: 'SUCCESS',
      },
    });

    const result = await processWithdrawal(platformReq());

    expect(result.idempotent).toBe(true);
    expect(debitWrites(executed).length).toBe(0);
  });

  it('persists the key on the sender ledger row so the unique index dedupes', async () => {
    const { executed } = wire();

    await processWithdrawal(platformReq());

    const senderInsert = executed.find(
      e => e.sql.includes('INSERT INTO transactions') && e.sql.includes('idempotency_key'),
    );
    expect(senderInsert).toBeDefined();
    expect(senderInsert!.params.some(p => String(p).includes('key-abc'))).toBe(true);
  });

  it('a concurrent duplicate losing on 23505 returns idempotent success, not a 500', async () => {
    const { didRollBack } = wire({ insertThrowsDuplicate: true });
    let call = 0;
    mockQueryOne.mockImplementation(async (sql: string) => {
      if (String(sql).includes('idempotency_key')) {
        call += 1;
        return call === 1 ? null : {
          id: 'tx-winner', amount_cents: 5000, currency: 'USD', description: 'Transfer', status: 'SUCCESS',
        };
      }
      return null;
    });

    const result = await processWithdrawal(platformReq());

    expect(result.idempotent).toBe(true);
    expect(didRollBack()).toBe(true);
  });

  it('the SAME key with a CONFLICTING payload is rejected', async () => {
    const { executed } = wire({
      prior: {
        id: 'tx-prior', amount_cents: 5000, currency: 'USD', description: 'Transfer', status: 'SUCCESS',
      },
    });

    await expect(processWithdrawal(platformReq({ amount: 999 }))).rejects.toThrow(/idempotency/i);
    expect(debitWrites(executed).length).toBe(0);
  });
});
