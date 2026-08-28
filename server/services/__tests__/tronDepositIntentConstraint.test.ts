/**
 * @vitest-environment node
 *
 * NEW-R4-4 (LOW, same family as LOW-5) — `createDepositIntent` retried on ANY
 * unique violation.
 *
 * The allocation loop is a FIN-1 mechanism: because every user deposits to one
 * shared hot wallet, the exact amount is the attribution key, so each active
 * pending intent gets a random micro-USDT discriminator and the partial index
 * `uniq_crypto_deposit_expected_amount` rejects collisions. On a collision the
 * loop retries with a fresh discriminator.
 *
 * The guard was `if (err?.code === '23505') continue;` — every unique violation on
 * `crypto_transactions`, not just the amount one. `crypto_transactions` also
 * carries `uniq_crypto_transactions_tx_hash`. A violation there (or on any future
 * unique constraint) is not a discriminator collision and a new amount cannot fix
 * it, so the loop spun through all 8 attempts and threw
 * `DEPOSIT_INTENT_ALLOCATION_FAILED` — replacing a real integrity error with a
 * misleading one, and hiding it from whoever has to diagnose it.
 *
 * This is the same defect class as LOW-5/R3-4 on the withdrawal and card-deposit
 * paths, which is why the fix routes through the same `server/lib/pgErrors.ts`
 * helper rather than adding another ad-hoc SQLSTATE test.
 *
 * INVARIANTS PINNED HERE:
 *  - a collision on the amount index is retried with a DIFFERENT expected_amount
 *  - a unique violation on any OTHER constraint propagates unchanged
 *  - a non-unique error (e.g. a serialization failure) propagates unchanged
 *  - the retry budget is bounded and exhaustion is reported, not looped forever
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
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

let createDepositIntent: typeof import('../tronDepositMonitor')['createDepositIntent'];

const ENV_KEYS = ['USDT_TRC20_DEPOSIT_ADDRESS', 'TRON_HOT_WALLET_ADDRESS'] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(async () => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  process.env.USDT_TRC20_DEPOSIT_ADDRESS = 'TDepositAddress00000000000000000000';
  vi.resetModules();
  ({ createDepositIntent } = await import('../tronDepositMonitor'));
});

afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
});

/** A node-postgres unique violation naming `constraint`. */
function uniqueViolation(constraint: string) {
  const err: any = new Error(`duplicate key value violates unique constraint "${constraint}"`);
  err.code = '23505';
  err.constraint = constraint;
  return err;
}

const ok = () => [{ id: 'intent-1', expires_at: '2026-01-01T00:00:00.000Z' }];

/** The `expected_amount` each attempt proposed (params $2 of the INSERT). */
const proposedAmounts = () => mockQuery.mock.calls.map((c) => (c[1] as unknown[])[1]);

describe('NEW-R4-4: an amount-discriminator collision is retried', () => {
  it('retries with a DIFFERENT expected_amount and eventually succeeds', async () => {
    mockQuery
      .mockRejectedValueOnce(uniqueViolation('uniq_crypto_deposit_expected_amount'))
      .mockRejectedValueOnce(uniqueViolation('uniq_crypto_deposit_expected_amount'))
      .mockResolvedValueOnce(ok());

    const intent = await createDepositIntent('user-1', 100);

    expect(intent.depositId).toBe('intent-1');
    expect(mockQuery).toHaveBeenCalledTimes(3);
    const amounts = proposedAmounts();
    // A retry that reused the same amount would collide forever.
    expect(new Set(amounts).size).toBe(3);
    // Every proposal keeps the caller's whole-USDT base.
    for (const a of amounts) {
      expect(Number(a)).toBeGreaterThanOrEqual(100);
      expect(Number(a)).toBeLessThan(101);
    }
  });

  it('exhausting the bounded retry budget reports allocation failure', async () => {
    mockQuery.mockRejectedValue(uniqueViolation('uniq_crypto_deposit_expected_amount'));

    await expect(createDepositIntent('user-1', 100)).rejects.toThrow('DEPOSIT_INTENT_ALLOCATION_FAILED');
    // Bounded: it does not spin indefinitely.
    expect(mockQuery.mock.calls.length).toBeLessThanOrEqual(8);
  });
});

describe('NEW-R4-4: an UNRELATED unique violation is not swallowed', () => {
  it('a tx_hash collision propagates instead of becoming an allocation failure', async () => {
    const err = uniqueViolation('uniq_crypto_transactions_tx_hash');
    mockQuery.mockRejectedValue(err);

    await expect(createDepositIntent('user-1', 100)).rejects.toBe(err);
    // No retry: a new discriminator cannot resolve a tx_hash collision.
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('an unnamed unique violation propagates rather than being assumed benign', async () => {
    const err: any = new Error('duplicate key value violates unique constraint');
    err.code = '23505';
    mockQuery.mockRejectedValue(err);

    await expect(createDepositIntent('user-1', 100)).rejects.toBe(err);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('a serialization failure propagates unchanged', async () => {
    const err: any = new Error('could not serialize access due to concurrent update');
    err.code = '40001';
    mockQuery.mockRejectedValue(err);

    await expect(createDepositIntent('user-1', 100)).rejects.toBe(err);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

describe('NEW-R4-4: the intent is still validated before any insert', () => {
  it('a non-positive or non-finite amount is refused without touching the database', async () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, 0.4]) {
      await expect(createDepositIntent('user-1', bad)).rejects.toThrow('INVALID_DEPOSIT_AMOUNT');
    }
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
