/**
 * @vitest-environment node
 *
 * NEW-R4-2 — `creditUserDeposit` anchors its crypto ledger entry to the WRONG
 * table's primary key, so a real, fully-confirmed on-chain deposit is never
 * credited.
 *
 * `crypto_ledger_entries.source_transaction_id` is
 *   `UUID REFERENCES transactions(id) ON DELETE SET NULL`
 * (server/db/init.ts). The deposit path passed `cryptoTxId` — a
 * `crypto_transactions.id` — into that column. On a real PostgreSQL server that
 * is SQLSTATE 23503 (foreign_key_violation), raised INSIDE the `transaction()`
 * block, and the only catch in `creditUserDeposit` special-cases
 * `DEPOSIT_ALREADY_CREDITED` and rethrows everything else. So the whole unit
 * rolls back:
 *
 *   - the `crypto_transactions` claim reverts to 'pending'
 *   - the `usdt_balance_cents` credit is undone
 *   - the user-visible `transactions` row is undone
 *
 * The USDT is in the hot wallet, the transfer has 20 confirmations, and the user
 * is never credited. Worse, the row returns to 'pending', so every subsequent
 * monitor pass re-attempts and fails identically — the deposit can never
 * succeed, not even by retry.
 *
 * WHY THE EXISTING SUITES MISS IT: every other mock in this repo returns a bare
 * `{rows: [], rowCount: 1}` for an unrecognised INSERT, which cannot express a
 * foreign key. The `installFkAwarePool` helper below MODELS the constraint: it
 * records the ids that `INSERT INTO transactions ... RETURNING id` actually
 * produced, and rejects a ledger insert whose `source_transaction_id` is not one
 * of them, with `code = '23503'` exactly as node-postgres would.
 *
 * INVARIANT PINNED HERE: a crypto ledger entry is anchored to the id of the
 * `transactions` row created for the SAME money movement, in the SAME atomic
 * unit — never to an id borrowed from another table.
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

let creditUserDeposit: typeof import('../tronDepositMonitor')['creditUserDeposit'];

beforeEach(async () => {
  vi.resetModules();
  ({ creditUserDeposit } = await import('../tronDepositMonitor'));
});

afterEach(() => {
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
});

type Stmt = { sql: string; params: unknown[] };

/** The `crypto_transactions.id` of the deposit intent being credited. */
const CRYPTO_TX_ID = 'crypto-tx-11111111';
/** The id the `transactions` INSERT hands back — a DIFFERENT id space. */
const TRANSACTIONS_ID = 'txn-99999999';
const USER_ID = 'user-1';
const TX_HASH = 'b'.repeat(64);

/**
 * A transaction client that enforces the real FK.
 *
 * `claimRowCount` models losing the atomic claim to a concurrent monitor pass.
 */
function installFkAwarePool(executed: Stmt[], opts: { claimRowCount?: number } = {}) {
  const { claimRowCount = 1 } = opts;
  /** Ids that genuinely exist in `transactions` — the only legal FK targets. */
  const transactionIds = new Set<string>();
  /** Rows in `crypto_ledger_entries`, to model the unique index on the FK column. */
  const ledgerRows: string[] = [];

  mockQuery.mockResolvedValue([]);
  mockQueryOne.mockResolvedValue(null);
  mockTransaction.mockImplementation(async (fn: any) => {
    const client = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        const flat = String(sql).replace(/\s+/g, ' ').trim();
        executed.push({ sql: flat, params });

        if (flat.includes('UPDATE crypto_transactions')) {
          return { rows: [], rowCount: claimRowCount };
        }
        if (flat.includes('INSERT INTO transactions')) {
          transactionIds.add(TRANSACTIONS_ID);
          return { rows: [{ id: TRANSACTIONS_ID }], rowCount: 1 };
        }
        if (flat.includes('INSERT INTO crypto_ledger_entries')) {
          const fk = params[1] === null || params[1] === undefined ? null : String(params[1]);
          if (fk !== null && !transactionIds.has(fk)) {
            // Exactly what PostgreSQL raises: the value is not present in
            // transactions(id).
            const err: any = new Error(
              'insert or update on table "crypto_ledger_entries" violates foreign key constraint "crypto_ledger_entries_source_transaction_id_fkey"',
            );
            err.code = '23503';
            err.constraint = 'crypto_ledger_entries_source_transaction_id_fkey';
            throw err;
          }
          if (fk !== null && ledgerRows.includes(fk)) {
            // uniq_crypto_ledger_source_transaction (R3-8). Without an
            // ON CONFLICT clause this is a 23505 that aborts the credit.
            if (/ON CONFLICT\s*\(\s*source_transaction_id\s*\)\s*DO NOTHING/i.test(flat)) {
              return { rows: [], rowCount: 0 };
            }
            const err: any = new Error('duplicate key value violates unique constraint "uniq_crypto_ledger_source_transaction"');
            err.code = '23505';
            err.constraint = 'uniq_crypto_ledger_source_transaction';
            throw err;
          }
          if (fk !== null) ledgerRows.push(fk);
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
    };
    return fn(client);
  });
  return { transactionIds, ledgerRows };
}

const credit = () =>
  creditUserDeposit(USER_ID, CRYPTO_TX_ID, TX_HASH, '25.5', 'TFromAddress0000000000', 1_700_000_000, 20);

const ledgerInsert = (ex: Stmt[]) => ex.find((e) => e.sql.includes('INSERT INTO crypto_ledger_entries'));
const walletCredit = (ex: Stmt[]) =>
  ex.filter((e) => /usdt_balance_cents\s*=\s*wallets\.usdt_balance_cents\s*\+/i.test(e.sql) || e.sql.includes('INSERT INTO wallets'));

describe('NEW-R4-2: a confirmed deposit is actually credited', () => {
  it('does not fail on the crypto ledger foreign key', async () => {
    const executed: Stmt[] = [];
    installFkAwarePool(executed);

    // Before the fix this rejects with 23503 and the whole credit rolls back.
    await expect(credit()).resolves.toBeUndefined();
  });

  it('credits the wallet and records the user-visible transaction', async () => {
    const executed: Stmt[] = [];
    installFkAwarePool(executed);

    await credit();

    expect(walletCredit(executed)).toHaveLength(1);
    expect(executed.some((e) => e.sql.includes('INSERT INTO transactions'))).toBe(true);
  });
});

describe('NEW-R4-2: the ledger entry is anchored to the transactions row', () => {
  it('passes the id returned by the transactions INSERT, not the crypto_transactions id', async () => {
    const executed: Stmt[] = [];
    installFkAwarePool(executed);

    await credit();

    const ledger = ledgerInsert(executed);
    expect(ledger).toBeDefined();
    expect(ledger!.params[1]).toBe(TRANSACTIONS_ID);
    expect(ledger!.params[1]).not.toBe(CRYPTO_TX_ID);
  });

  it('creates the transactions row BEFORE the ledger entry that references it', async () => {
    const executed: Stmt[] = [];
    installFkAwarePool(executed);

    await credit();

    const txIdx = executed.findIndex((e) => e.sql.includes('INSERT INTO transactions'));
    const ledgerIdx = executed.findIndex((e) => e.sql.includes('INSERT INTO crypto_ledger_entries'));
    expect(txIdx).toBeGreaterThanOrEqual(0);
    expect(ledgerIdx).toBeGreaterThan(txIdx);
  });

  it('the transactions INSERT returns its id rather than discarding it', async () => {
    const executed: Stmt[] = [];
    installFkAwarePool(executed);

    await credit();

    const txInsert = executed.find((e) => e.sql.includes('INSERT INTO transactions'));
    expect(txInsert!.sql).toMatch(/RETURNING id/i);
  });

  it('records the deposit as a POSITIVE ledger amount for the depositing user', async () => {
    const executed: Stmt[] = [];
    installFkAwarePool(executed);

    await credit();

    const ledger = ledgerInsert(executed);
    // 25.5 USDT == 2550 cents, credited (positive), to the depositing user.
    expect(ledger!.params[0]).toBe(USER_ID);
    expect(ledger!.params[2]).toBe(2550);
    expect(ledger!.params[3]).toBe(2550);
  });
});

describe('NEW-R4-2: replay safety survives the R3-8 unique index', () => {
  it('a duplicate ledger insert is a no-op, not a 23505 that rolls back the credit', async () => {
    const executed: Stmt[] = [];
    installFkAwarePool(executed);

    await credit();
    const ledger = ledgerInsert(executed);
    expect(ledger!.sql).toMatch(/ON CONFLICT\s*\(\s*source_transaction_id\s*\)\s*DO NOTHING/i);
  });

  it('a lost claim credits nothing and writes no ledger entry', async () => {
    const executed: Stmt[] = [];
    installFkAwarePool(executed, { claimRowCount: 0 });

    // Benign: another monitor pass already credited it.
    await expect(credit()).resolves.toBeUndefined();

    expect(walletCredit(executed)).toHaveLength(0);
    expect(ledgerInsert(executed)).toBeUndefined();
  });
});
