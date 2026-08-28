/**
 * @vitest-environment node
 *
 * R3-3 (HIGH) — `POST /api/user/withdraw` is a SECOND live withdrawal path that
 * moved money on its own instead of going through the canonical withdrawal
 * service.
 *
 * REPRODUCTION (pre-fix): the handler debited `usdt_balance_cents` itself and
 * then inserted into `withdrawal_requests` naming neither `asset_type`, `status`
 * nor `idempotency_key`. The column defaults therefore decided the lifecycle:
 * `asset_type = 'fiat'` and `status = 'pending'`. So a withdrawal funded from
 * the USDT balance was recorded as a PENDING FIAT withdrawal, which means:
 *
 *   - the fiat admin approver accepts it and debits `balance_cents` — a second
 *     debit, of the wrong asset, for money already taken out of USDT;
 *   - the fiat rejecter decrements `reserved_cents` this row never incremented
 *     (driving it negative) and never restores the USDT that was taken;
 *   - the USDT resolvers refuse it (`asset_type <> 'usdt'`), so there is no
 *     correct way to settle or refund it at all.
 *
 * That is exactly the NEW-1 defect, still reachable through this route after it
 * was fixed in the canonical service. On top of that the row carried no
 * idempotency key, so the partial unique index on
 * (user_id, idempotency_key) could not dedupe a double submit, and the only
 * duplicate protection was a non-transactional "same amount within an hour"
 * SELECT that answers a retry with 409 and no withdrawal id.
 *
 * The fix routes this handler through `processWithdrawal({ type: 'bank', ... })`
 * so there is ONE transaction/state machine for bank withdrawals. These tests
 * drive the real service through a mocked pool, so they assert the SQL that
 * actually reaches Postgres rather than that a particular function was called.
 *
 * The resulting ('held', 'usdt') row is the state the admin USDT resolvers
 * accept and the fiat handlers refuse — pinned in
 * adminUsdtWithdrawalResolution.test.ts.
 *
 * Socket-free: driven in-process via invokeRouter (the sandbox forbids listen()).
 */
import { beforeEach, afterEach, vi, describe, it, expect } from 'vitest';
import { invokeRouter } from './_invoke';

const USER_ID = '11111111-1111-1111-1111-111111111111';
/** Valid v4 shape — the route validates `idempotencyKey` with isUUID(). */
const KEY = '22222222-2222-4222-8222-222222222222';

/** Mutable DB state each test wires up. */
const state = {
  usdtBalanceCents: 100_00,
  balanceCents: 100_00,
  reservedCents: 0,
  /** Prior withdrawal row returned by BOTH duplicate lookups when set. */
  prior: null as null | Record<string, unknown>,
};

let executed: Array<{ sql: string; params: unknown[] }> = [];

const mockRunFraudChecks = vi.fn();

vi.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _r: any, n: any) => {
    req.user = { id: USER_ID, email: 'u@test.com', role: 'USER', sessionId: 's1' };
    n();
  },
  requireRole: () => (_q: any, _s: any, n: any) => n(),
  AuthenticatedRequest: {},
}));
vi.mock('../../middleware/rateLimit', () => ({
  aiLimiter: (_r: any, _s: any, n: any) => n(),
  apiLimiter: (_r: any, _s: any, n: any) => n(),
  sensitiveOpLimiter: (_r: any, _s: any, n: any) => n(),
  financialOpLimiter: (_r: any, _s: any, n: any) => n(),
}));
vi.mock('../../services/auditService', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../services/fraudService', () => ({ runFraudChecks: (...a: unknown[]) => mockRunFraudChecks(...a) }));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../db/pool', () => {
  const run = async (sql: string, params: unknown[] = []) => {
    const flat = String(sql).replace(/\s+/g, ' ').trim();
    executed.push({ sql: flat, params });

    // Both duplicate lookups — the route's "same amount within an hour" probe and
    // the service's idempotency-key probe — read withdrawal_requests.
    if (/FROM withdrawal_requests/i.test(flat)) return state.prior;
    if (/FROM wallets/i.test(flat)) {
      return {
        balance_cents: state.balanceCents,
        reserved_cents: state.reservedCents,
        usdt_balance_cents: state.usdtBalanceCents,
      };
    }
    return null;
  };
  const queryOne = vi.fn(run);
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    await run(sql, params);
    return [];
  });
  const transaction = vi.fn(async (fn: any) => {
    const client = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        const flat = String(sql).replace(/\s+/g, ' ').trim();
        executed.push({ sql: flat, params });
        if (/FROM wallets/i.test(flat)) {
          return {
            rows: [{
              balance_cents: state.balanceCents,
              reserved_cents: state.reservedCents,
              usdt_balance_cents: state.usdtBalanceCents,
            }],
            rowCount: 1,
          };
        }
        if (/UPDATE wallets/i.test(flat)) {
          // Model the guarded debit/reserve predicates: a wallet without enough
          // funds matches 0 rows, which is what makes the service abort.
          const amount = Number(params[0]);
          if (/usdt_balance_cents = usdt_balance_cents - /.test(flat)) {
            return { rows: [], rowCount: state.usdtBalanceCents >= amount ? 1 : 0 };
          }
          if (/reserved_cents = COALESCE\(reserved_cents, 0\) \+ /.test(flat)) {
            return { rows: [], rowCount: state.balanceCents - state.reservedCents >= amount ? 1 : 0 };
          }
          return { rows: [], rowCount: 1 };
        }
        if (/INSERT INTO withdrawal_requests/i.test(flat)) {
          return { rows: [{ id: 'wd-new-1' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
    };
    return fn(client);
  });
  return { query, queryOne, transaction };
});

async function loadRouter() {
  const mod = await import('../user');
  return (mod as any).userRouter ?? (mod as any).default;
}

const body = (over: Record<string, unknown> = {}) => ({
  amount: 50,
  currency: 'USD',
  walletType: 'usdt',
  bankName: 'Test Bank',
  accountNumber: '1234567890',
  accountName: 'Test User',
  ...over,
});

const post = async (b: Record<string, unknown>) =>
  invokeRouter(await loadRouter(), 'POST', '/withdraw', { body: b });

const withdrawalInsert = () => executed.find((e) => /INSERT INTO withdrawal_requests/i.test(e.sql));
const walletWrites = () => executed.filter((e) => /UPDATE wallets/i.test(e.sql));

beforeEach(() => {
  executed = [];
  state.usdtBalanceCents = 100_00;
  state.balanceCents = 100_00;
  state.reservedCents = 0;
  state.prior = null;
  mockRunFraudChecks.mockResolvedValue({ passed: true, flags: [], score: 0 });
});

afterEach(() => {
  mockRunFraudChecks.mockReset();
});

describe('R3-3: POST /api/user/withdraw records the asset that actually funded it', () => {
  it('a USDT-funded withdrawal is written as asset_type usdt in the held state', async () => {
    const res = await post(body());

    expect(res.status).toBe(201);
    const insert = withdrawalInsert();
    expect(insert).toBeDefined();
    // The columns must be named explicitly — relying on the defaults is the
    // defect (they say fiat/pending for a row funded from USDT).
    expect(insert!.sql).toMatch(/asset_type/i);
    expect(insert!.sql).toMatch(/status/i);
    expect(insert!.params).toContain('usdt');
    expect(insert!.params).toContain('held');
    expect(res.body?.data?.status).toBe('held');
  });

  it('debits usdt_balance_cents under a guard and never touches the fiat columns', async () => {
    await post(body());

    const writes = walletWrites();
    expect(writes).toHaveLength(1);
    expect(writes[0].sql).toMatch(/usdt_balance_cents = usdt_balance_cents - \$1/);
    // The guard is what stops a concurrent debit overdrawing the wallet.
    expect(writes[0].sql).toMatch(/usdt_balance_cents >= \$1/);
    expect(writes.some((w) => /balance_cents = balance_cents|reserved_cents = /.test(w.sql))).toBe(false);
  });

  it('a fiat-funded withdrawal still reserves and stays pending', async () => {
    const res = await post(body({ walletType: 'fiat' }));

    expect(res.status).toBe(201);
    const insert = withdrawalInsert();
    expect(insert!.params).toContain('fiat');
    expect(insert!.params).toContain('pending');
    const writes = walletWrites();
    expect(writes).toHaveLength(1);
    expect(writes[0].sql).toMatch(/reserved_cents = COALESCE\(reserved_cents, 0\) \+ \$1/);
    // NULL-safe availability predicate, not a JS pre-read.
    expect(writes[0].sql).toMatch(/balance_cents - COALESCE\(reserved_cents, 0\) >= \$1/);
  });
});

describe('R3-3: idempotency is persisted on the withdrawal row', () => {
  it('stores the caller-supplied key so a concurrent duplicate collides on the unique index', async () => {
    await post(body({ idempotencyKey: KEY }));

    expect(withdrawalInsert()!.params).toContain(KEY);
  });

  it('a retry with the same key replays the prior withdrawal instead of refusing it', async () => {
    state.prior = {
      id: 'wd-prior-1', status: 'held', tx_hash: null,
      amount_cents: 5000, currency: 'USD', withdrawal_type: 'bank', asset_type: 'usdt',
    };

    const res = await post(body({ idempotencyKey: KEY }));

    // Pre-fix this was a bare 409 with no withdrawal id, indistinguishable from
    // "your request was rejected" even though the money had already moved.
    expect(res.status).toBe(200);
    expect(res.body?.data?.idempotent).toBe(true);
    expect(res.body?.data?.withdrawalId).toBe('wd-prior-1');
    // And nothing moved a second time.
    expect(walletWrites()).toHaveLength(0);
    expect(withdrawalInsert()).toBeUndefined();
  });

  it('the same key reused for a DIFFERENT amount is refused, not silently replayed', async () => {
    state.prior = {
      id: 'wd-prior-1', status: 'held', tx_hash: null,
      amount_cents: 5000, currency: 'USD', withdrawal_type: 'bank', asset_type: 'usdt',
    };

    const res = await post(body({ amount: 75, idempotencyKey: KEY }));

    expect(res.status).toBe(409);
    expect(res.body?.error?.code).toBe('IDEMPOTENCY_KEY_CONFLICT');
    expect(walletWrites()).toHaveLength(0);
  });

  it('with no key supplied the same-amount duplicate heuristic still applies', async () => {
    state.prior = { id: 'wd-prior-1' };

    const res = await post(body());

    expect(res.status).toBe(409);
    expect(res.body?.error?.code).toBe('DUPLICATE_REQUEST');
    expect(walletWrites()).toHaveLength(0);
  });
});

describe('R3-3: the guards this route already had are preserved', () => {
  it('a risk-engine block fails closed before any money moves', async () => {
    mockRunFraudChecks.mockResolvedValue({ passed: false, flags: ['VELOCITY'], score: 90 });

    const res = await post(body());

    expect(res.status).toBe(429);
    expect(res.body?.error?.code).toBe('FRAUD_BLOCKED');
    expect(walletWrites()).toHaveLength(0);
    expect(withdrawalInsert()).toBeUndefined();
  });

  it('insufficient USDT keeps its error code across the refactor', async () => {
    state.usdtBalanceCents = 10_00; // $10 available, $50 requested

    const res = await post(body());

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('INSUFFICIENT_USDT_BALANCE');
    expect(withdrawalInsert()).toBeUndefined();
  });

  it('insufficient fiat keeps its error code across the refactor', async () => {
    state.balanceCents = 10_00;

    const res = await post(body({ walletType: 'fiat' }));

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('INSUFFICIENT_BALANCE');
    expect(withdrawalInsert()).toBeUndefined();
  });
});
