/**
 * @vitest-environment node
 *
 * HIGH-1 (RED) — the window in which a crypto payout is BOTH in flight and
 * refundable.
 *
 * `processCryptoWithdrawal` debits USDT, inserts the withdrawal row as 'held',
 * and then calls the external payout provider with the row STILL 'held'. There
 * is no in-flight state between 'held' and 'sent', and the admin route
 * POST /withdrawals/:id/usdt/refund refunds from exactly 'held'. So for the
 * whole duration of the provider call — a network round trip to a chain
 * gateway — an operator can refund a payout that is already on its way.
 *
 * `markSendOutcome` then claims `... AND status = 'held'` AFTER the provider
 * answers, so once the refund has moved the row that claim matches 0 rows and
 * the confirmed broadcast is never recorded: the money leaves on-chain, the
 * wallet is credited back, and the row reads 'rejected'.
 *
 * This file drives the REAL modules over ONE shared row/wallet store:
 *   - server/services/withdrawalService.ts  (processWithdrawal, real predicates)
 *   - server/routes/admin.ts                (the real adminRouter refund route)
 * Only system boundaries are stubbed: the pg pool, sendCryptoToWallet, fraud
 * checks, audit logging, request auth / rate limiting.
 *
 * SCOPE OF THE DB DOUBLE — read this before citing any result from this file.
 * The store below is a deterministic ROW MODEL. It honours an UPDATE's
 * `status = '<x>'` WHERE predicate (matching row -> rowCount 1, non-matching
 * row -> rowCount 0) and lets a claim be forced to rowCount 0. That is all it
 * is. It is NOT PostgreSQL: no MVCC, no snapshot isolation, no row locks, no
 * real concurrency. The interleaving here is explicit and sequential, driven by
 * a deferred provider promise. It is a regression harness for the service's own
 * state logic, not evidence about a live database.
 *
 * EXPECTED ON BASELINE: RED — both invariants below fail.
 */
import { beforeEach, afterEach, vi, describe, it, expect } from 'vitest';
import { invokeRouter } from '../../routes/__tests__/_invoke';

const WITHDRAWAL_ID = 'wd-race-1';
const TRANSACTION_ID = 'tx-race-1';
const USER_ID = 'user-1';
const OPENING_USDT_CENTS = 200_00;
const AMOUNT_USD = 50;
const AMOUNT_CENTS = 50_00;
const DEBITED_USDT_CENTS = OPENING_USDT_CENTS - AMOUNT_CENTS;

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockTransaction = vi.fn();
const mockSendCryptoToWallet = vi.fn();
const mockCreateAuditLog = vi.fn();
const mockRunFraudChecks = vi.fn();

// One pool mock serves BOTH production modules: withdrawalService imports
// '../db/pool' and admin.ts imports '../db/pool', which resolve to the same
// module, so the service and the route contend over the same row.
vi.mock('../../db/pool', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  transaction: (fn: unknown) => mockTransaction(fn),
}));
vi.mock('../auditService', () => ({
  createAuditLog: (...a: unknown[]) => mockCreateAuditLog(...a),
  getAuditLogs: vi.fn(),
  exportAuditLogsToCSV: vi.fn(),
}));
vi.mock('../fraudService', () => ({
  runFraudChecks: (...a: unknown[]) => mockRunFraudChecks(...a),
  getFraudFlags: vi.fn(),
}));
// Only the external send is replaced; parseUsdtAmountToCents and the rest of
// the provider module stay real.
vi.mock('../cryptoProviderService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../cryptoProviderService')>()),
  sendCryptoToWallet: (...a: unknown[]) => mockSendCryptoToWallet(...a),
}));
vi.mock('../stripeService', () => ({
  isStripeConfigured: () => false,
  createPaymentIntent: vi.fn(),
  getPaymentIntent: vi.fn(),
}));
vi.mock('../fluzClient', () => ({ isFluzConfigured: () => false }));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../middleware/securityLogger', () => ({
  getSecurityEvents: vi.fn(),
  getSecurityEventsByType: vi.fn(),
  getSecurityEventsByIP: vi.fn(),
}));
vi.mock('../../middleware/rateLimit', () => ({
  getRateLimitViolations: vi.fn(),
  clearRateLimitViolations: vi.fn(),
  apiLimiter: (_q: any, _s: any, n: any) => n(),
  sensitiveOpLimiter: (_q: any, _s: any, n: any) => n(),
  financialOpLimiter: (_q: any, _s: any, n: any) => n(),
}));
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _r: any, n: any) => {
    req.user = { id: 'admin-1', email: 'admin@test.com', role: 'SUPER_ADMIN' };
    n();
  },
  requireRole: () => (_q: any, _s: any, n: any) => n(),
  AuthenticatedRequest: {},
}));

let processWithdrawal: typeof import('../withdrawalService')['processWithdrawal'];
let adminRouter: any;

type Executed = { sql: string; params: unknown[]; txn: number };

interface WithdrawalRow {
  id: string;
  user_id: string;
  amount_cents: number;
  currency: string;
  withdrawal_type: string;
  asset_type: string;
  status: string;
  crypto_address: string | null;
  crypto_network: string | null;
  tx_hash: string | null;
  admin_notes: string | null;
  approved_by: string | null;
}

interface Store {
  withdrawal: WithdrawalRow | null;
  usdtCents: number;
  txStatus: string | null;
  ledger: string[];
}

let store: Store;
let executed: Executed[];

/** SET half of an UPDATE, so the two `status = '...'` occurrences never mix. */
const setOf = (flat: string) => {
  const i = flat.search(/\sWHERE\s/i);
  return i === -1 ? flat : flat.slice(0, i);
};
/** WHERE half of an UPDATE. */
const whereOf = (flat: string) => {
  const i = flat.search(/\sWHERE\s/i);
  return i === -1 ? '' : flat.slice(i);
};
const isUsdtDebit = (f: string) =>
  /usdt_balance_cents\s*=\s*usdt_balance_cents\s*-\s*\$1/i.test(f);
/** Matched structurally so both the plain and the COALESCE spelling count. */
const isUsdtCredit = (f: string) =>
  /usdt_balance_cents\s*=\s*(?:COALESCE\(\s*usdt_balance_cents\s*,\s*0\s*\)|usdt_balance_cents)\s*\+\s*\$1/i.test(f);

function freshStore(): Store {
  return { withdrawal: null, usdtCents: OPENING_USDT_CENTS, txStatus: null, ledger: [] };
}

interface DbOptions {
  /**
   * Force EVERY predicate-scoped `UPDATE withdrawal_requests` to match 0 rows
   * without mutating the row — i.e. another actor already resolved it. This is
   * the explicit rowCount = 0 capability the claim-lost test needs.
   */
  withdrawalClaimRowCount?: 0 | 1;
  /** Runs after transaction #n resolves, for explicit interleaving. */
  afterCommit?: (txn: number) => Promise<void>;
}

function runStatement(sql: string, params: unknown[], txn: number, opts: DbOptions) {
  const flat = String(sql).replace(/\s+/g, ' ').trim();
  executed.push({ sql: flat, params, txn });

  if (flat.includes('SELECT usdt_balance_cents')) {
    return { rows: [{ usdt_balance_cents: store.usdtCents }], rowCount: 1 };
  }
  if (isUsdtDebit(flat)) {
    const amount = Number(params[0]);
    if (store.usdtCents < amount) return { rows: [], rowCount: 0 };
    store.usdtCents -= amount;
    return { rows: [], rowCount: 1 };
  }
  if (isUsdtCredit(flat)) {
    store.usdtCents += Number(params[0]);
    return { rows: [], rowCount: 1 };
  }
  if (flat.includes('INSERT INTO withdrawal_requests')) {
    store.withdrawal = {
      id: WITHDRAWAL_ID,
      user_id: String(params[0]),
      amount_cents: Number(params[1]),
      currency: String(params[5]),
      withdrawal_type: 'crypto',
      asset_type: 'usdt',
      status: 'held',
      crypto_address: String(params[2]),
      crypto_network: String(params[3]),
      tx_hash: null,
      admin_notes: null,
      approved_by: null,
    };
    return { rows: [{ id: WITHDRAWAL_ID }], rowCount: 1 };
  }
  if (flat.includes('INSERT INTO transactions')) {
    store.txStatus = 'PENDING';
    return { rows: [{ id: TRANSACTION_ID }], rowCount: 1 };
  }
  if (flat.includes('UPDATE transactions')) {
    const wants = /status\s*=\s*'(\w+)'/.exec(whereOf(flat));
    if (wants && wants[1] !== store.txStatus) return { rows: [], rowCount: 0 };
    const target = /status\s*=\s*'(\w+)'/.exec(setOf(flat));
    if (target) store.txStatus = target[1];
    return { rows: [{ id: TRANSACTION_ID }], rowCount: 1 };
  }
  if (flat.includes('INSERT INTO crypto_ledger_entries')) {
    // Models the unique index on source_transaction_id with ON CONFLICT DO
    // NOTHING: a replayed bookkeeping write inserts nothing.
    const source = String(params[1]);
    if (store.ledger.includes(source)) return { rows: [], rowCount: 0 };
    store.ledger.push(source);
    return { rows: [{ id: `cle-${store.ledger.length}` }], rowCount: 1 };
  }
  if (flat.includes('UPDATE withdrawal_requests')) {
    if (opts.withdrawalClaimRowCount === 0) return { rows: [], rowCount: 0 };
    const row = store.withdrawal;
    if (!row) return { rows: [], rowCount: 0 };

    const where = whereOf(flat);
    const wants = /status\s*=\s*'(\w+)'/.exec(where);
    const wantsIn = /status\s+IN\s*\(([^)]*)\)/i.exec(where);
    if (wants && wants[1] !== row.status) return { rows: [], rowCount: 0 };
    if (wantsIn) {
      const allowed = wantsIn[1].split(',').map((s) => s.trim().replace(/'/g, ''));
      if (!allowed.includes(row.status)) return { rows: [], rowCount: 0 };
    }

    const target = /status\s*=\s*'(\w+)'/.exec(setOf(flat));
    if (target) row.status = target[1];
    return { rows: [{ id: WITHDRAWAL_ID }], rowCount: 1 };
  }
  return { rows: [], rowCount: 0 };
}

function installDb(opts: DbOptions = {}) {
  let txn = 0;

  mockQuery.mockImplementation(async () => ({ rows: [], rowCount: 1 }));
  // The admin route's pre-flight read: SELECT * FROM withdrawal_requests.
  mockQueryOne.mockImplementation(async (sql: string) => {
    if (String(sql).includes('FROM withdrawal_requests')) {
      return store.withdrawal ? { ...store.withdrawal } : null;
    }
    return null;
  });

  mockTransaction.mockImplementation(async (fn: (c: any) => Promise<unknown>) => {
    const current = ++txn;
    const client = {
      query: vi.fn(async (sql: string, params: unknown[] = []) =>
        runStatement(sql, params, current, opts)),
    };
    const out = await fn(client);
    if (opts.afterCommit) await opts.afterCommit(current);
    return out;
  });
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const usdtCredits = () => executed.filter((e) => isUsdtCredit(e.sql));
const ledgerInserts = () => executed.filter((e) => e.sql.includes('INSERT INTO crypto_ledger_entries'));

const baseReq = {
  type: 'crypto' as const,
  userId: USER_ID,
  amount: AMOUNT_USD,
  walletAddress: 'TxxxxxxxxxxxxxxxxxxxxxxxxxxxxxYYYY',
  network: 'TRC20',
};

beforeEach(async () => {
  vi.resetModules();
  store = freshStore();
  executed = [];
  mockCreateAuditLog.mockResolvedValue(undefined);
  mockRunFraudChecks.mockResolvedValue({ passed: true, flags: [], score: 0 });
  // Steps 1-3: auto-payout enabled, cap permits the amount, fraud passes.
  process.env.CRYPTO_AUTO_PAYOUT_ENABLED = 'true';
  process.env.CRYPTO_AUTO_PAYOUT_MAX_USD = '1000000';
  ({ processWithdrawal } = await import('../withdrawalService'));
  adminRouter = (await import('../../routes/admin') as any).adminRouter;
});

afterEach(() => {
  delete process.env.CRYPTO_AUTO_PAYOUT_ENABLED;
  delete process.env.CRYPTO_AUTO_PAYOUT_MAX_USD;
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
  mockSendCryptoToWallet.mockReset();
  mockCreateAuditLog.mockReset();
  mockRunFraudChecks.mockReset();
});

describe('HIGH-1: a crypto payout that is already in flight must not stay refundable', () => {
  it('EXTERNAL_PAYOUT_AND_REFUND_CANNOT_BOTH_OCCUR', async () => {
    // 7. The external send parks on a deferred, still-unresolved promise, so the
    //    withdrawal sits in the real in-flight window for as long as we choose.
    const entered = deferred<void>();
    const payout = deferred<any>();
    let providerSettled = false;
    payout.promise.then(() => { providerSettled = true; }, () => { providerSettled = true; });

    mockSendCryptoToWallet.mockImplementation(() => {
      entered.resolve();
      return payout.promise;
    });
    installDb();

    // 4-6. Debit commits and the withdrawal row is created 'held'.
    const service = processWithdrawal(baseReq);

    // 8. Prove the provider call is CURRENTLY in flight: it has been entered and
    //    has not settled, and the money has already left the wallet.
    await entered.promise;
    expect(mockSendCryptoToWallet).toHaveBeenCalledTimes(1);
    expect(providerSettled).toBe(false);
    expect(store.withdrawal).not.toBeNull();
    expect(store.usdtCents).toBe(DEBITED_USDT_CENTS);

    // 9-10. The operator refunds the SAME withdrawal through the real admin
    //    router while the broadcast is still outstanding. Whether this is
    //    permitted is exactly what the fix changes, so the reply is recorded as
    //    a diagnostic rather than asserted.
    const refund = await invokeRouter(
      adminRouter,
      'POST',
      `/withdrawals/${WITHDRAWAL_ID}/usdt/refund`,
      { body: { reason: 'customer asked to cancel' } },
    );

    // 11-12. The provider now confirms the broadcast that was already on its
    //    way; markSendOutcome runs its own predicate against whatever state the
    //    row is in.
    payout.resolve({
      success: true,
      outcome: 'confirmed_sent',
      payoutId: 'payout-abc',
      txHash: 'a'.repeat(64),
      status: 'completed',
    });
    const result = await service;
    // 13. THE INVARIANT. A confirmed external payout and a wallet refund of the
    //     same debit may never both happen. The correct resolution of this race
    //     is: the payout stands, the refund is refused, the wallet is NOT
    //     credited back and the row is not left reading 'rejected'.
    const diagnostics = [
      `refund route replied ${refund.status} ${JSON.stringify(refund.body)}`,
      `service returned ${JSON.stringify(result)}`,
      `final withdrawal status: ${store.withdrawal!.status}`,
      `usdt cents: opening ${OPENING_USDT_CENTS}, after debit ${DEBITED_USDT_CENTS}, final ${store.usdtCents}`,
    ].join(' | ');

    expect({
      invariant: 'EXTERNAL_PAYOUT_AND_REFUND_CANNOT_BOTH_OCCUR',
      externalPayoutConfirmed: providerSettled && mockSendCryptoToWallet.mock.calls.length === 1,
      walletRefundCredits: usdtCredits().length,
      usdtCentsAfter: store.usdtCents,
      withdrawalResolvedAsRefunded: store.withdrawal!.status === 'rejected',
    }, diagnostics).toEqual({
      invariant: 'EXTERNAL_PAYOUT_AND_REFUND_CANNOT_BOTH_OCCUR',
      externalPayoutConfirmed: true,
      walletRefundCredits: 0,
      usdtCentsAfter: DEBITED_USDT_CENTS,
      withdrawalResolvedAsRefunded: false,
    });
  });
});

/**
 * The claim-lost half. `withdrawalClaimRowCount: 0` makes every
 * predicate-scoped `UPDATE withdrawal_requests` match 0 rows, which is what a
 * row someone else has already resolved looks like from inside this code path.
 *
 * Nothing financial may follow a claim that was not won: no on-chain broadcast,
 * no wallet credit, and no second bookkeeping entry. On the baseline the payout
 * is broadcast unconditionally — no claim guards it — so this fails too.
 */
describe('HIGH-1: a lost pre-broadcast claim must have no financial effect', () => {
  it('LOST_PREBROADCAST_CLAIM_HAS_NO_FINANCIAL_EFFECT', async () => {
    installDb({ withdrawalClaimRowCount: 0 });
    mockSendCryptoToWallet.mockResolvedValue({
      success: true,
      outcome: 'confirmed_sent',
      payoutId: 'payout-should-never-exist',
      txHash: 'b'.repeat(64),
      status: 'completed',
    });

    const outcome = await processWithdrawal(baseReq).catch((e: any) => ({ threw: e?.message }));

    expect({
      invariant: 'LOST_PREBROADCAST_CLAIM_HAS_NO_FINANCIAL_EFFECT',
      providerCalls: mockSendCryptoToWallet.mock.calls.length,
      walletRefundCredits: usdtCredits().length,
      usdtCentsAfter: store.usdtCents,
      ledgerEntries: ledgerInserts().length,
    }, `service outcome: ${JSON.stringify(outcome)} | row status: ${store.withdrawal?.status}`).toEqual({
      invariant: 'LOST_PREBROADCAST_CLAIM_HAS_NO_FINANCIAL_EFFECT',
      providerCalls: 0,
      walletRefundCredits: 0,
      usdtCentsAfter: DEBITED_USDT_CENTS,
      ledgerEntries: 0,
    });
  });
});
