/**
 * @vitest-environment node
 *
 * R3-4 (MEDIUM) — PostgreSQL idempotency-constraint classification.
 *
 * `transactions.idempotency_key` is covered by TWO unique constraints: the inline
 * `UNIQUE` in CREATE TABLE (`transactions_idempotency_key_key`, db/init.ts) and
 * the explicit partial index `idx_transactions_idempotency_unique`. Postgres
 * reports whichever one the insert actually violated, and that is not something
 * the application can predict. The platform-transfer race handler accepted only
 * the index name, so a genuine idempotent retry that collided on the inline
 * constraint fell through to `throw err` — a 500 on a request that had already
 * succeeded, and (worse) a caller-visible failure for money that did move.
 *
 * The same classification must stay STRICT in the other direction: an unrelated
 * unique violation (a real integrity failure) must never be laundered into
 * idempotent success. That means:
 *   - trust `err.constraint` when the driver provides it, never the message text;
 *   - accept only the constraints that belong to THIS path's claim (the bank path
 *     must not accept a `transactions` constraint, and vice versa);
 *   - a bare 23505 with no trustworthy constraint is NOT idempotent.
 *
 * Sibling defects in the same handlers, fixed with the same change:
 *   LOW-5  — the crypto path classified on `err.code === '23505'` alone.
 *   LOW-10 — the crypto path returned the prior row without comparing the
 *            payload, so one key could stand in for a different request.
 */
import { beforeEach, afterEach, vi, describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

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

/** A pg unique violation exactly as node-postgres surfaces one. */
function pgUniqueViolation(opts: { constraint?: string; message?: string }) {
  const err: any = new Error(
    opts.message
      ?? `duplicate key value violates unique constraint "${opts.constraint ?? 'unknown'}"`,
  );
  err.code = '23505';
  if (opts.constraint !== undefined) err.constraint = opts.constraint;
  return err;
}

interface WireOpts {
  /** Error the money-moving INSERT raises (simulating the concurrent loser). */
  insertError?: Error;
  /** Row returned by the post-collision lookup (the winner). */
  winner?: Record<string, unknown> | null;
  /** Row returned by the pre-check lookup (a settled prior request). */
  prior?: Record<string, unknown> | null;
}

function wire(opts: WireOpts = {}) {
  const { insertError, winner = null, prior = null } = opts;
  const executed: Array<{ sql: string; params: unknown[] }> = [];
  let lookups = 0;

  mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  mockQueryOne.mockImplementation(async (sql: string) => {
    if (!String(sql).includes('idempotency_key')) return null;
    lookups += 1;
    // Lookup 1 is the pre-check; any later lookup is the post-collision one.
    return lookups === 1 ? prior : winner;
  });

  mockTransaction.mockImplementation(async (fn: any) => {
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        const flat = String(sql).replace(/\s+/g, ' ');
        executed.push({ sql: flat, params: params ?? [] });

        if (flat.includes('SELECT balance_cents')) {
          return {
            rows: [{ balance_cents: 100_000, usdt_balance_cents: 100_000, reserved_cents: 0 }],
            rowCount: 1,
          };
        }
        if (flat.includes('SELECT usdt_balance_cents')) {
          return { rows: [{ usdt_balance_cents: 100_000 }], rowCount: 1 };
        }
        if (flat.includes('FROM users')) {
          return { rows: [{ id: 'user-2', email: 'r@test.com', full_name: 'Recipient' }], rowCount: 1 };
        }
        if (flat.includes('INSERT INTO withdrawal_requests') || flat.includes('INSERT INTO transactions')) {
          if (insertError) throw insertError;
          return { rows: [{ id: 'row-new' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
    };
    return await fn(client);
  });

  return {
    executed,
    moneyWrites: () => executed.filter(e => /UPDATE wallets|INSERT INTO wallets/.test(e.sql)),
  };
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

const cryptoReq = (over: Record<string, unknown> = {}) => ({
  type: 'crypto' as const,
  userId: 'user-1',
  amount: 50,
  walletAddress: 'TXtestaddress0000000000000000000000',
  network: 'TRC20',
  idempotencyKey: 'key-abc',
  ...over,
});

const PLATFORM_WINNER = {
  id: 'tx-winner', amount_cents: 5000, currency: 'USD', description: 'Transfer', status: 'SUCCESS',
};
const BANK_WINNER = {
  id: 'wd-winner', status: 'pending', tx_hash: null,
  amount_cents: 5000, currency: 'USD', withdrawal_type: 'bank', asset_type: 'fiat',
};
const CRYPTO_WINNER = {
  id: 'wd-crypto-winner', status: 'held', tx_hash: null,
  amount_cents: 5000, currency: 'USD', withdrawal_type: 'crypto', asset_type: 'usdt',
};

describe('R3-4: platform transfer accepts EITHER transactions idempotency constraint', () => {
  it('idx_transactions_idempotency_unique => idempotent success', async () => {
    const { moneyWrites } = wire({
      insertError: pgUniqueViolation({ constraint: 'idx_transactions_idempotency_unique' }),
      winner: PLATFORM_WINNER,
    });

    const result = await processWithdrawal(platformReq());

    expect(result.idempotent).toBe(true);
    expect(result.success).toBe(true);
    // The loser's transaction rolled back: nothing it wrote survives, and it
    // must not attempt a compensating write outside the transaction either.
    expect(moneyWrites().length).toBe(0);
  });

  it('transactions_idempotency_key_key (the inline UNIQUE) => idempotent success', async () => {
    const { moneyWrites } = wire({
      insertError: pgUniqueViolation({ constraint: 'transactions_idempotency_key_key' }),
      winner: PLATFORM_WINNER,
    });

    const result = await processWithdrawal(platformReq());

    expect(result.idempotent).toBe(true);
    expect(result.success).toBe(true);
    expect(moneyWrites().length).toBe(0);
  });
});

describe('R3-4: unrelated unique violations are NOT idempotent success', () => {
  it('users_email_key on the platform path rolls back and rethrows', async () => {
    const err = pgUniqueViolation({ constraint: 'users_email_key' });
    const { moneyWrites } = wire({ insertError: err, winner: PLATFORM_WINNER });

    await expect(processWithdrawal(platformReq())).rejects.toBe(err);
    expect(moneyWrites().length).toBe(0);
  });

  it('an unrelated err.constraint is trusted over a misleading err.message', async () => {
    // Hostile/confusing shape: the constraint field says users_email_key, the
    // message text names our idempotency index. Text must never win.
    const err = pgUniqueViolation({
      constraint: 'users_email_key',
      message:
        'duplicate key value violates unique constraint "users_email_key" '
        + '(idx_transactions_idempotency_unique idx_withdrawal_requests_idempotency_unique)',
    });
    const { moneyWrites } = wire({ insertError: err, winner: PLATFORM_WINNER });

    await expect(processWithdrawal(platformReq())).rejects.toBe(err);
    expect(moneyWrites().length).toBe(0);
  });

  it('a generic duplicate-key error with no trustworthy constraint is NOT idempotent', async () => {
    // No `constraint` field and no known name anywhere in the text: this could be
    // any unique index in the schema, so it must surface as an error.
    const err = pgUniqueViolation({
      message: 'duplicate key value violates unique constraint',
    });
    delete (err as any).constraint;
    const { moneyWrites } = wire({ insertError: err, winner: PLATFORM_WINNER });

    await expect(processWithdrawal(platformReq())).rejects.toBe(err);
    expect(moneyWrites().length).toBe(0);
  });
});

describe('R3-4: the bank path accepts only withdrawal_requests idempotency constraints', () => {
  it('idx_withdrawal_requests_idempotency_unique => idempotent success', async () => {
    wire({
      insertError: pgUniqueViolation({ constraint: 'idx_withdrawal_requests_idempotency_unique' }),
      winner: BANK_WINNER,
    });

    const result = await processWithdrawal(bankReq());

    expect(result.idempotent).toBe(true);
    expect(result.withdrawalId).toBe('wd-winner');
  });

  it('a transactions constraint does NOT make a bank withdrawal idempotent', async () => {
    // Wrong table. The bank claim lives on withdrawal_requests; a collision on
    // transactions.idempotency_key here means something else went wrong.
    const err = pgUniqueViolation({ constraint: 'transactions_idempotency_key_key' });
    wire({ insertError: err, winner: BANK_WINNER });

    await expect(processWithdrawal(bankReq())).rejects.toBe(err);
  });

  it('users_email_key does NOT make a bank withdrawal idempotent', async () => {
    const err = pgUniqueViolation({ constraint: 'users_email_key' });
    wire({ insertError: err, winner: BANK_WINNER });

    await expect(processWithdrawal(bankReq())).rejects.toBe(err);
  });
});

describe('LOW-5: the crypto path classifies on the constraint, not on 23505 alone', () => {
  it('idx_withdrawal_requests_idempotency_unique => idempotent success', async () => {
    wire({
      insertError: pgUniqueViolation({ constraint: 'idx_withdrawal_requests_idempotency_unique' }),
      winner: CRYPTO_WINNER,
    });

    const result = await processWithdrawal(cryptoReq());

    expect(result.idempotent).toBe(true);
    expect(result.withdrawalId).toBe('wd-crypto-winner');
  });

  it('an unrelated unique violation rethrows instead of reporting success', async () => {
    const err = pgUniqueViolation({ constraint: 'users_email_key' });
    wire({ insertError: err, winner: CRYPTO_WINNER });

    await expect(processWithdrawal(cryptoReq())).rejects.toBe(err);
  });

  it('a bare 23505 with no constraint field rethrows', async () => {
    const err = pgUniqueViolation({ message: 'duplicate key value violates unique constraint' });
    delete (err as any).constraint;
    wire({ insertError: err, winner: CRYPTO_WINNER });

    await expect(processWithdrawal(cryptoReq())).rejects.toBe(err);
  });
});

describe('LOW-10: crypto idempotency compares the payload, like bank and platform', () => {
  it('same key + same payload => idempotent replay of the prior withdrawal', async () => {
    const { moneyWrites } = wire({ prior: CRYPTO_WINNER });

    const result = await processWithdrawal(cryptoReq());

    expect(result.idempotent).toBe(true);
    expect(result.withdrawalId).toBe('wd-crypto-winner');
    expect(moneyWrites().length).toBe(0);
  });

  it('same key + DIFFERENT amount => IDEMPOTENCY_KEY_CONFLICT, no money moves', async () => {
    const { moneyWrites } = wire({ prior: CRYPTO_WINNER });

    // Prior row is 5000 cents; this request is 99900.
    await expect(processWithdrawal(cryptoReq({ amount: 999 }))).rejects.toThrow(/idempotency/i);
    expect(moneyWrites().length).toBe(0);
  });

  it('same key + a prior withdrawal of a DIFFERENT type is rejected', async () => {
    // A bank row must not be replayed as the answer to a crypto request.
    const { moneyWrites } = wire({ prior: { ...CRYPTO_WINNER, withdrawal_type: 'bank' } });

    await expect(processWithdrawal(cryptoReq())).rejects.toThrow(/idempotency/i);
    expect(moneyWrites().length).toBe(0);
  });

  it('the post-collision replay also compares the payload', async () => {
    wire({
      insertError: pgUniqueViolation({ constraint: 'idx_withdrawal_requests_idempotency_unique' }),
      winner: { ...CRYPTO_WINNER, amount_cents: 123456 },
    });

    await expect(processWithdrawal(cryptoReq())).rejects.toThrow(/idempotency/i);
  });
});

describe('R3-4: no loose 23505 classification remains in the service', () => {
  const src = readFileSync(
    join(__dirname, '..', 'withdrawalService.ts'),
    'utf8',
  );

  it('withdrawalService.ts contains no raw 23505 comparison', () => {
    // Every classification must go through the shared constraint-aware helper in
    // server/lib/pgErrors.ts. A local `err.code === '23505'` check is exactly the
    // loose form that treated any unique violation as idempotent success.
    expect(src).not.toContain('23505');
  });

  it('withdrawalService.ts uses the shared pgErrors helper', () => {
    expect(src).toMatch(/from '\.\.\/lib\/pgErrors'/);
  });
});
