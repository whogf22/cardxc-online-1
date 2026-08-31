/**
 * @vitest-environment node
 *
 * NEW-3 (MEDIUM) — the fiat reserve write must not silently lose the reserve.
 *
 * `processBankWithdrawal` reserved funds with:
 *
 *   UPDATE wallets SET reserved_cents = reserved_cents + $1
 *    WHERE user_id = $2 AND currency = $3
 *
 * Three defects in one statement:
 *  1. no COALESCE — in Postgres `NULL + n` is NULL, so a wallet with
 *     reserved_cents IS NULL has its reserve silently ERASED rather than set.
 *  2. no available-balance predicate — the only sufficiency check was the JS
 *     pre-read, which computes `Number(null) === 0` and so overstates available
 *     funds; a concurrent debit between the read and the write is unguarded.
 *  3. no rowCount guard — rowCount is 1 even when the arithmetic produced NULL,
 *     and it is 0 when the wallet row does not match at all, yet the withdrawal
 *     row was created regardless.
 *
 * The net effect after the reserved_cents COALESCE fix landed on the READ side
 * (transactions/payments/user) is worse than before: previously a NULL reserve
 * froze the wallet, which masked this write. Now the wallet transfers freely, so
 * a lost reserve means the funds backing a pending withdrawal are spendable.
 *
 * The correct sibling implementation already exists at server/routes/user.ts:309.
 */
import { beforeEach, afterEach, vi, describe, it, expect } from 'vitest';

const mockTransaction = vi.fn();
const mockQuery = vi.fn();
const mockQueryOne = vi.fn();

vi.mock('../../db/pool', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  transaction: (fn: unknown) => mockTransaction(fn),
}));
vi.mock('../auditService', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../cryptoProviderService', () => ({ sendCryptoToWallet: vi.fn() }));
vi.mock('../fraudService', () => ({ runFraudChecks: vi.fn().mockResolvedValue({ passed: true, flags: [], score: 0 }) }));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

let processWithdrawal: typeof import('../withdrawalService')['processWithdrawal'];

beforeEach(async () => {
  vi.resetModules();
  ({ processWithdrawal } = await import('../withdrawalService'));
});

afterEach(() => {
  mockTransaction.mockReset();
  mockQuery.mockReset();
  mockQueryOne.mockReset();
});

interface WireOpts {
  balanceCents: number;
  reservedCents: number | null;
  /** Emulate a concurrent debit landing between the pre-read and the reserve. */
  concurrentDrain?: boolean;
}

function wire(opts: WireOpts) {
  const executed: Array<{ sql: string; params: unknown[] }> = [];
  let rolledBack = false;

  mockTransaction.mockImplementation(async (fn: any) => {
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        const flat = String(sql).replace(/\s+/g, ' ');
        executed.push({ sql: flat, params: params ?? [] });

        if (flat.includes('SELECT balance_cents')) {
          return {
            rows: [{
              balance_cents: opts.balanceCents,
              usdt_balance_cents: 0,
              reserved_cents: opts.reservedCents,
            }],
            rowCount: 1,
          };
        }

        // The guarded reserve write — emulate Postgres NULL arithmetic and the
        // availability predicate, so the assertion is behavioural.
        if (flat.includes('UPDATE wallets') && flat.includes('reserved_cents =')) {
          const amt = Number(params?.[0] ?? 0);
          const usesCoalesce = /COALESCE\(\s*reserved_cents\s*,\s*0\s*\)/i.test(flat);
          const hasPredicate = /balance_cents\s*-\s*COALESCE\(\s*reserved_cents\s*,\s*0\s*\)\s*>=\s*\$1/i.test(flat);
          const reserved = usesCoalesce ? (opts.reservedCents ?? 0) : opts.reservedCents;
          // `NULL + n` is NULL: the reserve is erased, and Postgres still
          // reports rowCount 1 because the row matched.
          if (reserved === null) return { rows: [], rowCount: 1, __wroteNull: true } as any;
          const effectiveBalance = opts.concurrentDrain ? 0 : opts.balanceCents;
          if (hasPredicate && effectiveBalance - reserved < amt) return { rows: [], rowCount: 0 };
          return { rows: [], rowCount: 1 };
        }

        if (flat.includes('INSERT INTO withdrawal_requests')) return { rows: [{ id: 'wd-1' }], rowCount: 1 };
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

const bankReq = (amount: number) => ({
  type: 'bank' as const,
  userId: 'user-1',
  amount,
  currency: 'USD',
  walletType: 'fiat' as const,
  bankName: 'Test Bank',
  accountNumber: '123456',
  accountName: 'A Name',
});

const reserveWrite = (ex: Array<{ sql: string }>) =>
  ex.find(e => e.sql.includes('UPDATE wallets') && e.sql.includes('reserved_cents ='));

const withdrawalInsert = (ex: Array<{ sql: string }>) =>
  ex.find(e => e.sql.includes('INSERT INTO withdrawal_requests'));

describe('NEW-3: fiat reserve write is NULL-safe and guarded', () => {
  it('a NULL reserve is COALESCEd, so the reserve is recorded instead of erased', async () => {
    const { executed } = wire({ balanceCents: 100_000, reservedCents: null });

    await processWithdrawal(bankReq(50));

    const write = reserveWrite(executed);
    expect(write).toBeDefined();
    // Without COALESCE, `NULL + 5000` is NULL and the reserve is lost.
    expect(write!.sql).toMatch(/reserved_cents\s*=\s*COALESCE\(\s*reserved_cents\s*,\s*0\s*\)\s*\+\s*\$1/i);
  });

  it('the reserve write carries the available-balance predicate', async () => {
    const { executed } = wire({ balanceCents: 100_000, reservedCents: 0 });

    await processWithdrawal(bankReq(50));

    const write = reserveWrite(executed);
    expect(write!.sql).toMatch(/balance_cents\s*-\s*COALESCE\(\s*reserved_cents\s*,\s*0\s*\)\s*>=\s*\$1/i);
  });

  it('a concurrent drain makes the guarded write match 0 rows: throws and creates NO withdrawal row', async () => {
    // Pre-read sees a funded wallet; by the time the guarded write runs the
    // balance is gone. The predicate must catch it.
    const { executed, didRollBack } = wire({ balanceCents: 100_000, reservedCents: 0, concurrentDrain: true });

    await expect(processWithdrawal(bankReq(50))).rejects.toThrow(/insufficient/i);

    // The withdrawal row must NOT exist — the whole transaction rolls back.
    expect(withdrawalInsert(executed)).toBeUndefined();
    expect(didRollBack()).toBe(true);
  });

  it('the reserve write happens BEFORE the withdrawal row is created', async () => {
    const { executed } = wire({ balanceCents: 100_000, reservedCents: 0 });

    await processWithdrawal(bankReq(50));

    const reserveIdx = executed.findIndex(e => e.sql.includes('UPDATE wallets') && e.sql.includes('reserved_cents ='));
    const insertIdx = executed.findIndex(e => e.sql.includes('INSERT INTO withdrawal_requests'));
    expect(reserveIdx).toBeGreaterThanOrEqual(0);
    expect(insertIdx).toBeGreaterThan(reserveIdx);
  });

  it('still permits a withdrawal that fits inside the available balance', async () => {
    const { executed } = wire({ balanceCents: 100_000, reservedCents: 90_000 });

    // available = 10_000c; a 50.00 withdrawal is 5_000c and must succeed.
    const result = await processWithdrawal(bankReq(50));

    expect(result.success).toBe(true);
    expect(withdrawalInsert(executed)).toBeDefined();
  });

  it('refuses a withdrawal that exceeds the available balance (reserve respected)', async () => {
    const { executed } = wire({ balanceCents: 100_000, reservedCents: 90_000 });

    // available = 10_000c; a 200.00 withdrawal is 20_000c.
    await expect(processWithdrawal(bankReq(200))).rejects.toThrow(/insufficient/i);
    expect(withdrawalInsert(executed)).toBeUndefined();
  });
});
