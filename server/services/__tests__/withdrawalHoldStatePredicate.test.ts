/**
 * @vitest-environment node
 *
 * R3-2 — every money-affecting write on a crypto withdrawal must carry an
 * expected-prior-status predicate.
 *
 * Without `AND status = '<expected>'` the writes were unconditional
 * last-writer-wins overwrites keyed on the row id alone. Two concrete
 * consequences, both reproduced below:
 *   - a late reconciliation marker could drag an ALREADY-RESOLVED row (settled
 *     'completed' / refunded 'rejected') back to 'held', re-exposing it to a
 *     second operator resolution and a second money movement;
 *   - the pre-broadcast refund credited the wallet first and set the status
 *     second, so a replay credited twice.
 *
 * R3-11 — the outcome of a payout attempt must be persisted as its own
 * committed transition.
 *
 * Previously: 'confirmed_sent' wrote `status = 'processing'` inside the SAME
 * transaction as the ledger insert (so a bookkeeping failure rolled the status
 * back and left the row 'held' — refundable — after a real broadcast), while the
 * threw / ambiguous paths wrote only a 'held' marker, making a row whose funds
 * may already be on-chain indistinguishable from one that never reached the
 * provider.
 *
 * The mock below MODELS PostgreSQL predicate semantics: an UPDATE whose WHERE
 * clause names a status other than the row's current status matches 0 rows. That
 * is what makes these assertions behavioural rather than string-matching.
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

type Executed = { sql: string; params: unknown[]; txn: number };

/**
 * Postgres-shaped row store. `status` is authoritative: an UPDATE only matches
 * when its WHERE predicate agrees with the current value, exactly as a
 * conditional claim behaves under READ COMMITTED.
 */
function installTransaction(executed: Executed[], row: { status: string }, opts: {
  balanceCents?: number;
  ledgerInsertThrows?: boolean;
  afterCommit?: (txn: number) => Promise<void> | void;
} = {}) {
  const { balanceCents = 100_00, ledgerInsertThrows = false, afterCommit } = opts;
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
        if (flat.includes('UPDATE wallets')) {
          return { rows: [], rowCount: 1 };
        }
        if (flat.includes('INSERT INTO withdrawal_requests')) {
          return { rows: [{ id: 'wd-1' }], rowCount: 1 };
        }
        // R3-8: the crypto hold now also inserts the ONE canonical user-visible
        // `transactions` row (`RETURNING id`) in the same transaction as the
        // debit, and the pre-broadcast refund finalises that same row. Model both
        // so the predicate/outcome assertions below are unaffected.
        if (flat.includes('INSERT INTO transactions')) {
          return { rows: [{ id: 'tx-1' }], rowCount: 1 };
        }
        if (flat.includes('UPDATE transactions')) {
          return { rows: [{ id: 'tx-1' }], rowCount: 1 };
        }
        if (flat.includes('INSERT INTO crypto_ledger_entries')) {
          if (ledgerInsertThrows) throw new Error('ledger insert failed');
          return { rows: [], rowCount: 1 };
        }
        if (flat.includes('UPDATE withdrawal_requests')) {
          // Split SET from WHERE so the two `status = '...'` occurrences are
          // never confused for one another.
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
          return { rows: [{ id: 'wd-1' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
    };
    const out = await fn(client);
    if (afterCommit) await afterCommit(current);
    return out;
  });
}

const baseReq = {
  type: 'crypto' as const,
  userId: 'user-1',
  amount: 50,
  walletAddress: 'TxxxxxxxxxxxxxxxxxxxxxxxxxxxxxYYYY',
  network: 'TRC20',
};

/** Statements that SET status to 'held' (the WHERE clause is excluded). */
const setsHeld = (executed: Executed[]) =>
  executed.filter((e) => {
    if (!e.sql.includes('UPDATE withdrawal_requests')) return false;
    const wi = e.sql.search(/\sWHERE\s/i);
    const setPart = wi === -1 ? e.sql : e.sql.slice(0, wi);
    return /status\s*=\s*'held'/.test(setPart);
  });

const withdrawalUpdates = (executed: Executed[]) =>
  executed.filter((e) => e.sql.includes('UPDATE withdrawal_requests'));

describe('R3-2: money-affecting withdrawal writes carry an expected-prior-status predicate', () => {
  it('the reconciliation marker is scoped to id + asset_type + status', async () => {
    const executed: Executed[] = [];
    const row = { status: 'held' };
    installTransaction(executed, row);
    mockSendCryptoToWallet.mockRejectedValue(new Error('socket hang up'));

    await processWithdrawal(baseReq);

    const marker = withdrawalUpdates(executed).find((e) => /admin_notes/.test(e.sql) && !/INSERT/.test(e.sql));
    expect(marker).toBeDefined();
    expect(marker!.sql).toMatch(/WHERE id = \$\d+ AND asset_type = 'usdt' AND status = 'sending'/i);
  });

  it('a late marker cannot drag an already-settled row back out of its resolved state', async () => {
    const executed: Executed[] = [];
    // The operator settled it while the payout call was still hanging.
    // HIGH-1: the mock must allow the held -> sending claim to win, then
    // interleave the concurrent settle to 'completed' before the provider answer.
    const row = { status: 'held' };
    installTransaction(executed, row, {
      afterCommit: (txn) => {
        if (txn === 2) row.status = 'completed';
      },
    });
    mockSendCryptoToWallet.mockRejectedValue(new Error('socket hang up'));

    await processWithdrawal(baseReq);

    // Predicate lost the claim: the resolved state survives.
    expect(row.status).toBe('completed');
  });

  it('a late marker cannot resurrect a refunded row', async () => {
    const executed: Executed[] = [];
    // HIGH-1: the mock must allow the held -> sending claim to win, then
    // interleave a concurrent refund to 'rejected' before the provider answer.
    const row = { status: 'held' };
    installTransaction(executed, row, {
      afterCommit: (txn) => {
        if (txn === 2) row.status = 'rejected';
      },
    });
    mockSendCryptoToWallet.mockResolvedValue({ success: false, outcome: 'unknown', error: 'no confirmation' });

    await processWithdrawal(baseReq);

    expect(row.status).toBe('rejected');
    expect(setsHeld(executed)).toHaveLength(0);
  });

  it('pre-broadcast refund claims the withdrawal row BEFORE crediting the wallet', async () => {
    const executed: Executed[] = [];
    const row = { status: 'held' };
    installTransaction(executed, row);
    mockSendCryptoToWallet.mockResolvedValue({ success: false, outcome: 'not_sent', error: 'provider rejected' });

    await expect(processWithdrawal(baseReq)).rejects.toThrow(/Crypto withdrawal failed/);

    const refundTxn = executed.filter((e) => e.txn === Math.max(...executed.map((x) => x.txn)));
    const claimIdx = refundTxn.findIndex((e) => e.sql.includes('UPDATE withdrawal_requests'));
    const creditIdx = refundTxn.findIndex((e) => /usdt_balance_cents = usdt_balance_cents \+ \$1/.test(e.sql));
    expect(claimIdx).toBeGreaterThanOrEqual(0);
    expect(creditIdx).toBeGreaterThan(claimIdx);
    expect(refundTxn[claimIdx].sql).toMatch(/AND asset_type = 'usdt' AND status = 'sending'/i);
  });

  it('pre-broadcast refund does NOT credit the wallet when the claim is lost', async () => {
    const executed: Executed[] = [];
    // Already resolved by an operator: the claim will match 0 rows.
    const row = { status: 'rejected' };
    installTransaction(executed, row);
    mockSendCryptoToWallet.mockResolvedValue({ success: false, outcome: 'not_sent', error: 'provider rejected' });

    await expect(processWithdrawal(baseReq)).rejects.toThrow(/Crypto withdrawal failed/);

    const credits = executed.filter((e) => /usdt_balance_cents = usdt_balance_cents \+ \$1/.test(e.sql));
    expect(credits).toHaveLength(0);
  });

  it('the gate-blocked hold marker is still scoped to the held state', async () => {
    delete process.env.CRYPTO_AUTO_PAYOUT_ENABLED; // fail-closed default
    const executed: Executed[] = [];
    const row = { status: 'held' };
    installTransaction(executed, row);

    const result = await processWithdrawal(baseReq);

    expect(mockSendCryptoToWallet).not.toHaveBeenCalled();
    expect(result.status).toBe('held');
    const marker = setsHeld(executed);
    expect(marker).toHaveLength(1);
    expect(marker[0].sql).toMatch(/AND asset_type = 'usdt' AND status = 'held'/i);
  });
});

describe('R3-11: payout outcome is persisted as its own claimed transition', () => {
  it('confirmed_sent records status sent, not the ambiguous processing', async () => {
    const executed: Executed[] = [];
    const row = { status: 'held' };
    installTransaction(executed, row);
    mockSendCryptoToWallet.mockResolvedValue({
      success: true, outcome: 'confirmed_sent', payoutId: 'p1', txHash: '0xabc', status: 'completed',
    });

    await processWithdrawal(baseReq);

    expect(row.status).toBe('sent');
    const processingWrites = withdrawalUpdates(executed).filter((e) => {
      const wi = e.sql.search(/\sWHERE\s/i);
      return /status\s*=\s*'processing'/.test(wi === -1 ? e.sql : e.sql.slice(0, wi));
    });
    expect(processingWrites).toHaveLength(0);
  });

  it('the sent transition commits in its own transaction, before the ledger insert', async () => {
    const executed: Executed[] = [];
    const row = { status: 'held' };
    installTransaction(executed, row);
    mockSendCryptoToWallet.mockResolvedValue({
      success: true, outcome: 'confirmed_sent', payoutId: 'p1', txHash: '0xabc', status: 'completed',
    });

    await processWithdrawal(baseReq);

    const sentWrite = withdrawalUpdates(executed).find((e) => {
      const wi = e.sql.search(/\sWHERE\s/i);
      return /status\s*=\s*'sent'/.test(wi === -1 ? e.sql : e.sql.slice(0, wi));
    });
    const ledger = executed.find((e) => e.sql.includes('INSERT INTO crypto_ledger_entries'));
    expect(sentWrite).toBeDefined();
    expect(ledger).toBeDefined();
    // Different transaction ids ⇒ the status is durable before bookkeeping runs.
    expect(ledger!.txn).toBeGreaterThan(sentWrite!.txn);
  });

  it('a failing ledger insert does not revert the sent status', async () => {
    const executed: Executed[] = [];
    const row = { status: 'held' };
    installTransaction(executed, row, { ledgerInsertThrows: true });
    mockSendCryptoToWallet.mockResolvedValue({
      success: true, outcome: 'confirmed_sent', payoutId: 'p1', txHash: '0xabc', status: 'completed',
    });

    const result = await processWithdrawal(baseReq);

    expect(row.status).toBe('sent');
    expect(result.success).toBe(true);
    // And no refund was attempted after a confirmed broadcast.
    expect(executed.filter((e) => /usdt_balance_cents = usdt_balance_cents \+ \$1/.test(e.sql))).toHaveLength(0);
  });

  it('a throwing payout call moves the row to reconcile and never refunds', async () => {
    const executed: Executed[] = [];
    const row = { status: 'held' };
    installTransaction(executed, row);
    mockSendCryptoToWallet.mockRejectedValue(new Error('ECONNRESET after broadcast'));

    const result = await processWithdrawal(baseReq);

    expect(row.status).toBe('reconcile');
    expect(result.status).toBe('reconcile');
    expect((result as any).requiresReconciliation).toBe(true);
    expect(executed.filter((e) => /usdt_balance_cents = usdt_balance_cents \+ \$1/.test(e.sql))).toHaveLength(0);
  });

  it('an ambiguous outcome moves the row to reconcile and never refunds', async () => {
    const executed: Executed[] = [];
    const row = { status: 'held' };
    installTransaction(executed, row);
    mockSendCryptoToWallet.mockResolvedValue({ success: false, outcome: 'unknown', error: 'no confirmation' });

    const result = await processWithdrawal(baseReq);

    expect(row.status).toBe('reconcile');
    expect(result.status).toBe('reconcile');
    expect(executed.filter((e) => /usdt_balance_cents = usdt_balance_cents \+ \$1/.test(e.sql))).toHaveLength(0);
  });

  it('the outcome write is audited with the persistence result', async () => {
    const executed: Executed[] = [];
    const row = { status: 'held' };
    installTransaction(executed, row);
    mockSendCryptoToWallet.mockResolvedValue({ success: false, outcome: 'unknown', error: 'no confirmation' });

    await processWithdrawal(baseReq);

    expect(mockCreateAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'CRYPTO_WITHDRAWAL_RECONCILE',
      newValues: expect.objectContaining({ markerPersisted: true }),
    }));
  });
});

describe('R3-11: the schema admits the two outcome states it now writes', () => {
  const initSql = readFileSync(
    fileURLToPath(new URL('../../db/init.ts', import.meta.url)),
    'utf8',
  );

  const statusChecks = initSql
    .split('\n')
    .filter((l) => /CHECK \(status IN \('pending', 'approved', 'rejected', 'held'/.test(l));

  it('both withdrawal_requests status CHECK sites exist', () => {
    // One inline in CREATE TABLE, one in the ALTER that migrates existing DBs.
    // A write the constraint rejects is a silently lost payout outcome.
    expect(statusChecks).toHaveLength(2);
  });

  it("every withdrawal_requests status CHECK admits 'sent' and 'reconcile'", () => {
    for (const line of statusChecks) {
      expect(line).toContain("'sent'");
      expect(line).toContain("'reconcile'");
    }
  });
});
