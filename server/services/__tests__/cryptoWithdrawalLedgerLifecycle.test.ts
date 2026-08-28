/**
 * @vitest-environment node
 *
 * R3-8 (MEDIUM) — a crypto (USDT) withdrawal has no canonical user-visible
 * transaction identity, and its only bookkeeping write cannot succeed.
 *
 * `processBankWithdrawal` inserts the user-visible ledger row for every bank
 * withdrawal:
 *
 *   INSERT INTO transactions (user_id, type, status, amount_cents, currency,
 *                             reference, description)
 *   VALUES ($1, 'withdrawal', 'PENDING', $2, $3, $4, $5)   -- $4 = withdrawal id
 *
 * `processCryptoWithdrawal` inserts NONE. Three consequences, all reproduced
 * below:
 *
 *  1. The USDT leaves `usdt_balance_cents` with no `transactions` row at all, so
 *     the withdrawal is invisible in transaction history for its whole lifetime.
 *
 *  2. Both admin resolvers finalise with
 *     `UPDATE transactions SET status = ... WHERE reference = $1 AND type = 'withdrawal'`.
 *     With no row to match, settle and refund silently finalise nothing (neither
 *     checks rowCount) — the withdrawal state and the ledger state diverge
 *     permanently.
 *
 *  3. The one bookkeeping write the crypto path does make passes `withdrawalId`
 *     as `crypto_ledger_entries.source_transaction_id`, but that column is
 *     `UUID REFERENCES transactions(id)` (server/db/init.ts). A
 *     `withdrawal_requests.id` is not a `transactions.id`, so on a real Postgres
 *     the insert raises FK violation 23503 — and it sits inside a catch that only
 *     logs, so EVERY confirmed crypto payout silently produces no ledger row.
 *     `cardCheckout.ts` passes a real `transactions.id` into the same column,
 *     which is what establishes the intended contract.
 *
 * Nor is the ledger write replay-safe: `crypto_ledger_entries`' only uniqueness is
 * `UNIQUE(source_order_id, user_id)`, and `source_order_id` is NULL for
 * withdrawals. NULLs never collide in a Postgres unique index, so duplicate
 * bookkeeping can insert duplicate ledger rows.
 *
 * INVARIANTS PINNED HERE:
 *  - the USDT hold creates exactly ONE canonical `transactions` row, in the SAME
 *    transaction as the debit, referencing the withdrawal
 *  - the ledger entry references that row's `transactions.id`, never the
 *    withdrawal id
 *  - the ledger insert is duplicate-safe, and the schema enforces it
 *  - the pre-broadcast refund resolves that SAME transaction row
 *  - no fiat balance column is ever mutated for a USDT withdrawal
 */
import { beforeEach, afterEach, vi, describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
vi.mock('../cryptoProviderService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../cryptoProviderService')>()),
  sendCryptoToWallet: (...args: unknown[]) => mockSendCryptoToWallet(...args),
}));
vi.mock('../fraudService', () => ({ runFraudChecks: (...args: unknown[]) => mockRunFraudChecks(...args) }));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

let processWithdrawal: typeof import('../withdrawalService')['processWithdrawal'];

beforeEach(async () => {
  vi.resetModules();
  mockRunFraudChecks.mockResolvedValue({ passed: true, flags: [], score: 0 });
  process.env.CRYPTO_AUTO_PAYOUT_ENABLED = 'true';
  process.env.CRYPTO_AUTO_PAYOUT_MAX_USD = '1000000';
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

const WITHDRAWAL_ID = 'wd-1';
const TRANSACTION_ID = 'tx-canonical-1';

type Executed = { sql: string; params: unknown[]; txn: number };

/**
 * Postgres-shaped store. The two id spaces are deliberately DISTINCT values so a
 * test can tell which one a statement was given: `withdrawal_requests.id` is
 * 'wd-1' and `transactions.id` is 'tx-canonical-1'. Passing the wrong one into
 * `source_transaction_id` is exactly the FK violation this finding is about, and
 * here it is visible as a parameter rather than as a swallowed 23503.
 */
function installTransaction(executed: Executed[], row: { status: string }, opts: {
  balanceCents?: number;
  ledgerRows?: Array<{ source_transaction_id: string }>;
} = {}) {
  const { balanceCents = 100_00, ledgerRows = [] } = opts;
  let txn = 0;

  mockTransaction.mockImplementation(async (fn: (client: { query: (sql: string, params?: unknown[]) => Promise<any> }) => Promise<unknown>) => {
    const current = ++txn;
    const client = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        const flat = sql.replace(/\s+/g, ' ').trim();
        executed.push({ sql: flat, params, txn: current });

        if (flat.includes('SELECT usdt_balance_cents')) {
          return { rows: [{ usdt_balance_cents: balanceCents }], rowCount: 1 };
        }
        if (flat.includes('INSERT INTO withdrawal_requests')) {
          return { rows: [{ id: WITHDRAWAL_ID }], rowCount: 1 };
        }
        if (flat.includes('INSERT INTO transactions')) {
          return { rows: [{ id: TRANSACTION_ID }], rowCount: 1 };
        }
        if (flat.includes('INSERT INTO crypto_ledger_entries')) {
          // Model the unique index on source_transaction_id together with
          // ON CONFLICT DO NOTHING: a duplicate inserts nothing.
          const sourceId = String(params[1]);
          if (ledgerRows.some((r) => r.source_transaction_id === sourceId)) {
            return { rows: [], rowCount: 0 };
          }
          ledgerRows.push({ source_transaction_id: sourceId });
          return { rows: [{ id: `cle-${ledgerRows.length}` }], rowCount: 1 };
        }
        if (flat.includes('UPDATE transactions')) {
          return { rows: [{ id: TRANSACTION_ID }], rowCount: 1 };
        }
        if (flat.includes('UPDATE wallets')) {
          return { rows: [], rowCount: 1 };
        }
        if (flat.includes('UPDATE withdrawal_requests')) {
          const wi = flat.search(/\sWHERE\s/i);
          const setPart = wi === -1 ? flat : flat.slice(0, wi);
          const wherePart = wi === -1 ? '' : flat.slice(wi);

          const wants = /status\s*=\s*'(\w+)'/.exec(wherePart);
          const wantsIn = /status\s+IN\s*\(([^)]*)\)/i.exec(wherePart);
          if (wants && wants[1] !== row.status) return { rows: [], rowCount: 0 };
          if (wantsIn) {
            const allowed = wantsIn[1].split(',').map((s) => s.trim().replace(/'/g, ''));
            if (!allowed.includes(row.status)) return { rows: [], rowCount: 0 };
          }

          const target = /status\s*=\s*'(\w+)'/.exec(setPart);
          if (target) row.status = target[1];
          return { rows: [{ id: WITHDRAWAL_ID }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
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

const CONFIRMED_SENT = {
  success: true, outcome: 'confirmed_sent', payoutId: 'p1', txHash: '0xabc', status: 'completed',
};

const only = (executed: Executed[], needle: string) =>
  executed.filter((e) => e.sql.includes(needle));

/**
 * Statements that mutate a FIAT balance column. `usdt_balance_cents` is excluded
 * structurally: the character before `balance_cents` is `_` there, so the
 * `[^_]` guard cannot match it.
 */
const fiatMutations = (executed: Executed[]) =>
  executed.filter((e) =>
    /(?:^|[^_])balance_cents\s*=/.test(e.sql) || /reserved_cents\s*=/.test(e.sql),
  );

describe('R3-8: the USDT hold creates one canonical transactions row', () => {
  it('inserts exactly one withdrawal transaction, in the SAME transaction as the debit', async () => {
    const executed: Executed[] = [];
    const row = { status: 'held' };
    installTransaction(executed, row);
    mockSendCryptoToWallet.mockResolvedValue(CONFIRMED_SENT);

    await processWithdrawal(baseReq);

    const inserts = only(executed, 'INSERT INTO transactions');
    expect(inserts, 'a crypto withdrawal must create a user-visible ledger row').toHaveLength(1);

    const debit = executed.find((e) => /usdt_balance_cents = usdt_balance_cents - \$1/.test(e.sql));
    const wdInsert = only(executed, 'INSERT INTO withdrawal_requests')[0];
    expect(debit).toBeDefined();
    // One atomic unit: the debit, the withdrawal row and the ledger row commit
    // together or not at all.
    expect(inserts[0].txn).toBe(debit!.txn);
    expect(inserts[0].txn).toBe(wdInsert.txn);
  });

  it('records the withdrawal id as the reference, with the debited USDT amount', async () => {
    const executed: Executed[] = [];
    const row = { status: 'held' };
    installTransaction(executed, row);
    mockSendCryptoToWallet.mockResolvedValue(CONFIRMED_SENT);

    await processWithdrawal(baseReq);

    const insert = only(executed, 'INSERT INTO transactions')[0];
    expect(insert.sql).toMatch(/type[\s\S]*status/i);
    expect(insert.sql).toContain("'withdrawal'");
    expect(insert.sql).toContain("'PENDING'");
    // `reference` is the join key both admin resolvers use to finalise the row.
    expect(insert.params).toContain(WITHDRAWAL_ID);
    // 50 USDT, debited as 5000 cents — the same integer as the wallet debit.
    expect(insert.params).toContain(5000);
    expect(insert.params).toContain('user-1');
  });

  it('is created before the payout is attempted, not after it confirms', async () => {
    const executed: Executed[] = [];
    const row = { status: 'held' };
    installTransaction(executed, row);
    // A payout that never resolves as sent must still have left a ledger row.
    mockSendCryptoToWallet.mockResolvedValue({ success: false, outcome: 'unknown', error: 'no confirmation' });

    const result = await processWithdrawal(baseReq);

    expect(result.status).toBe('reconcile');
    expect(only(executed, 'INSERT INTO transactions')).toHaveLength(1);
  });

  it('is created even when the withdrawal is held by the fail-closed payout gate', async () => {
    delete process.env.CRYPTO_AUTO_PAYOUT_ENABLED;
    const executed: Executed[] = [];
    const row = { status: 'held' };
    installTransaction(executed, row);

    const result = await processWithdrawal(baseReq);

    expect(result.status).toBe('held');
    expect(mockSendCryptoToWallet).not.toHaveBeenCalled();
    expect(only(executed, 'INSERT INTO transactions')).toHaveLength(1);
  });

  it('never mutates a fiat balance column for a USDT withdrawal', async () => {
    const executed: Executed[] = [];
    const row = { status: 'held' };
    installTransaction(executed, row);
    mockSendCryptoToWallet.mockResolvedValue(CONFIRMED_SENT);

    await processWithdrawal(baseReq);

    expect(fiatMutations(executed)).toHaveLength(0);
  });
});

describe('R3-8: the crypto ledger entry references the canonical transaction', () => {
  it('passes a transactions.id into source_transaction_id, never the withdrawal id', async () => {
    const executed: Executed[] = [];
    const row = { status: 'held' };
    installTransaction(executed, row);
    mockSendCryptoToWallet.mockResolvedValue(CONFIRMED_SENT);

    await processWithdrawal(baseReq);

    const ledger = only(executed, 'INSERT INTO crypto_ledger_entries')[0];
    expect(ledger).toBeDefined();
    // `source_transaction_id` is `UUID REFERENCES transactions(id)`. Handing it a
    // withdrawal_requests id is FK violation 23503, swallowed by the log-only
    // catch — so the ledger row silently never exists.
    expect(ledger.params[1]).toBe(TRANSACTION_ID);
    expect(ledger.params[1]).not.toBe(WITHDRAWAL_ID);
  });

  it('signs the ledger amount as a debit of the exact debited integer', async () => {
    const executed: Executed[] = [];
    const row = { status: 'held' };
    installTransaction(executed, row);
    mockSendCryptoToWallet.mockResolvedValue(CONFIRMED_SENT);

    await processWithdrawal(baseReq);

    const ledger = only(executed, 'INSERT INTO crypto_ledger_entries')[0];
    expect(ledger.params[2]).toBe(-5000);
    expect(ledger.params[3]).toBe(-5000);
  });

  it('is duplicate-safe: a replayed bookkeeping write inserts no second row', async () => {
    const ledgerRows: Array<{ source_transaction_id: string }> = [];
    const executedA: Executed[] = [];
    const rowA = { status: 'held' };
    installTransaction(executedA, rowA, { ledgerRows });
    mockSendCryptoToWallet.mockResolvedValue(CONFIRMED_SENT);
    await processWithdrawal(baseReq);

    // Replay the same logical withdrawal against the same ledger store.
    const executedB: Executed[] = [];
    const rowB = { status: 'held' };
    installTransaction(executedB, rowB, { ledgerRows });
    await processWithdrawal(baseReq);

    expect(only(executedB, 'INSERT INTO crypto_ledger_entries')).toHaveLength(1);
    // Exactly one ledger row survives for one canonical transaction.
    expect(ledgerRows).toHaveLength(1);
    // And the statement itself must carry the conflict clause that makes the
    // duplicate benign rather than a 23505 the caller has to classify.
    const ledger = only(executedB, 'INSERT INTO crypto_ledger_entries')[0];
    expect(ledger.sql).toMatch(/ON CONFLICT\s*\(\s*source_transaction_id\s*\)\s*DO NOTHING/i);
  });
});

describe('R3-8: resolution keeps the withdrawal and its transaction consistent', () => {
  it('the pre-broadcast refund fails the SAME transaction row it created', async () => {
    const executed: Executed[] = [];
    const row = { status: 'held' };
    installTransaction(executed, row);
    mockSendCryptoToWallet.mockResolvedValue({ success: false, outcome: 'not_sent', error: 'provider rejected' });

    await expect(processWithdrawal(baseReq)).rejects.toThrow(/Crypto withdrawal failed/);

    // The refund transaction is the last one.
    const lastTxn = Math.max(...executed.map((e) => e.txn));
    const refundTxn = executed.filter((e) => e.txn === lastTxn);

    const claimIdx = refundTxn.findIndex((e) => e.sql.includes('UPDATE withdrawal_requests'));
    const creditIdx = refundTxn.findIndex((e) => /usdt_balance_cents = usdt_balance_cents \+ \$1/.test(e.sql));
    const finaliseIdx = refundTxn.findIndex((e) => e.sql.includes('UPDATE transactions'));

    expect(claimIdx).toBeGreaterThanOrEqual(0);
    expect(creditIdx).toBeGreaterThan(claimIdx);
    // A refunded withdrawal whose transaction row stays PENDING forever is the
    // divergence this finding is about.
    expect(finaliseIdx, 'the refund must finalise the canonical transaction row').toBeGreaterThan(claimIdx);
    expect(refundTxn[finaliseIdx].sql).toContain("'FAILED'");
    expect(refundTxn[finaliseIdx].params).toContain(WITHDRAWAL_ID);
  });

  it('a lost refund claim finalises nothing at all', async () => {
    const executed: Executed[] = [];
    // An operator already resolved it: the claim matches 0 rows.
    const row = { status: 'rejected' };
    installTransaction(executed, row);
    mockSendCryptoToWallet.mockResolvedValue({ success: false, outcome: 'not_sent', error: 'provider rejected' });

    await expect(processWithdrawal(baseReq)).rejects.toThrow(/Crypto withdrawal failed/);

    const lastTxn = Math.max(...executed.map((e) => e.txn));
    const refundTxn = executed.filter((e) => e.txn === lastTxn);
    expect(refundTxn.filter((e) => /usdt_balance_cents = usdt_balance_cents \+ \$1/.test(e.sql))).toHaveLength(0);
    expect(refundTxn.filter((e) => e.sql.includes('UPDATE transactions'))).toHaveLength(0);
  });
});

describe('R3-8: the schema enforces one ledger row per canonical transaction', () => {
  const initSql = readFileSync(
    fileURLToPath(new URL('../../db/init.ts', import.meta.url)),
    'utf8',
  );

  it('declares a unique index on crypto_ledger_entries(source_transaction_id)', () => {
    // `UNIQUE(source_order_id, user_id)` cannot help: `source_order_id` is NULL
    // for withdrawals and NULLs never collide in a Postgres unique index, so
    // without this index duplicate bookkeeping duplicates the ledger row.
    expect(initSql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS \w+\s+ON crypto_ledger_entries\(source_transaction_id\)/i,
    );
  });

  it('does not block startup when historical duplicates exist', () => {
    // Same tolerance the other retro-fitted unique indexes use.
    const idx = initSql.indexOf('ON crypto_ledger_entries(source_transaction_id)');
    expect(idx).toBeGreaterThan(-1);
    expect(initSql.slice(idx, idx + 400)).toMatch(/\.catch\(/);
  });
});
