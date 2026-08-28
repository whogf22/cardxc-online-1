/**
 * @vitest-environment node
 *
 * R3-7 (MEDIUM) + LOW-6 — concurrent admin adjustment approval / rejection.
 *
 * `POST /api/admin/adjustments/:id/approve` read the adjustment with an UNLOCKED
 * query outside the transaction, checked `status !== 'PENDING'` in application
 * code, and then applied its terminal mutation with no predicate and no rowCount
 * check:
 *
 *   const adjustment = await queryOne(`SELECT * FROM admin_adjustments WHERE id = $1`);
 *   if (adjustment.status !== 'PENDING') throw ...            // <-- check
 *   await transaction(async (client) => {
 *     await client.query(`UPDATE admin_adjustments SET status = 'APPROVED' ...
 *                         WHERE id = $2`);                    // <-- ...use, no predicate
 *     // money mutation, driven by the STALE pre-read row
 *   });
 *
 * Two consequences, both money:
 *
 *  1. Two concurrent approvals both pass the check, so both apply the wallet
 *     mutation. The credit branch is an additive upsert
 *     (`balance_cents = wallets.balance_cents + $3`), so the user is credited
 *     TWICE for one approved adjustment, with two `transactions` ledger rows.
 *  2. Because the UPDATE carries no `status` predicate, an approval that lost the
 *     race to a REJECTION overwrites `REJECTED` with `APPROVED` and pays the money
 *     anyway — the rejection is silently undone.
 *
 * `POST /adjustments/:id/reject` did have `AND status = 'PENDING'`, but ignored
 * rowCount (LOW-6): a rejection that changed nothing still answered
 * `{ success: true, message: 'Adjustment rejected' }` and still wrote an
 * `ADJUSTMENT_REJECTED` audit entry, so the log shows a rejection that never
 * happened.
 *
 * INVARIANTS PINNED HERE:
 *  - the claim is the FIRST statement in the transaction, and precedes any money
 *  - approve + approve  => exactly one financial effect, one ledger row, one audit
 *  - approve + reject   => exactly one terminal winner; the loser moves no money
 *  - reject  + reject   => exactly one winner; one audit entry
 *  - the loser writes ZERO balance mutation and ZERO misleading audit/event
 *  - money is read from the CLAIMED row (RETURNING), not the unlocked pre-read
 *  - a failed money guard rolls the claim back, leaving the row PENDING
 *
 * Socket-free: driven in-process via invokeRouter (the sandbox forbids listen()).
 */
import { afterEach, beforeEach, vi, describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { invokeRouter } from './_invoke';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockTransaction = vi.fn();
const mockCreateAuditLog = vi.fn().mockResolvedValue(undefined);

vi.mock('../../db/pool', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  transaction: (fn: unknown) => mockTransaction(fn),
}));
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _r: any, n: any) => {
    req.user = { id: 'admin-1', email: 'admin@test.com', role: 'SUPER_ADMIN' };
    n();
  },
  requireRole: () => (_q: any, _s: any, n: any) => n(),
  AuthenticatedRequest: {},
}));
vi.mock('../../middleware/rateLimit', () => ({
  getRateLimitViolations: vi.fn(), clearRateLimitViolations: vi.fn(),
  sensitiveOpLimiter: (_q: any, _s: any, n: any) => n(),
  financialOpLimiter: (_q: any, _s: any, n: any) => n(),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../services/auditService', () => ({
  createAuditLog: (...a: unknown[]) => mockCreateAuditLog(...a),
  getAuditLogs: vi.fn(), exportAuditLogsToCSV: vi.fn(),
}));
vi.mock('../../services/fraudService', () => ({ getFraudFlags: vi.fn() }));
vi.mock('../../services/stripeService', () => ({ isStripeConfigured: () => false, createPaymentIntent: vi.fn(), getPaymentIntent: vi.fn() }));
vi.mock('../../services/fluzClient', () => ({ isFluzConfigured: () => false }));
vi.mock('../../middleware/securityLogger', () => ({ getSecurityEvents: vi.fn(), getSecurityEventsByType: vi.fn(), getSecurityEventsByIP: vi.fn() }));

const USER_ID = '22222222-2222-4222-8222-222222222222';
const ADJ_ID = '33333333-3333-4333-8333-333333333333';

/**
 * A rendezvous barrier. Both concurrent requests block on `arrive()` at the point
 * where they first touch the database, so neither can commit before the other has
 * started — the interleaving that makes a check-then-act race observable. Without
 * it the two requests would just run one after the other and the defect would hide.
 */
function makeBarrier(n: number) {
  let arrived = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  return async function arrive(): Promise<void> {
    arrived += 1;
    if (arrived >= n) release();
    await gate;
  };
}

interface Db {
  /** Adjustment lifecycle state, mutated only by a statement that matches it. */
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  /** When true no such adjustment row exists at all. */
  missing?: boolean;
  balanceCents: number;
  reservedCents: number;
  /** Every `INSERT INTO transactions` that committed. */
  ledger: Array<{ reference: unknown; amountCents: unknown }>;
  /** Every wallet-balance mutation that committed, in order. */
  moneyWrites: Array<{ kind: 'credit' | 'debit'; amountCents: number }>;
  /** Flattened SQL of every statement executed, in order, across both requests. */
  executed: string[];
}

function freshDb(over: Partial<Db> = {}): Db {
  return {
    status: 'PENDING', balanceCents: 100_00, reservedCents: 0,
    ledger: [], moneyWrites: [], executed: [],
    ...over,
  };
}

const ADJUSTMENT_ROW = (db: Db, adj: { type: 'credit' | 'debit'; amount_cents: number }) => ({
  id: ADJ_ID, user_id: USER_ID, currency: 'USD', reason: 'test reason long enough',
  status: db.status, ...adj,
});

/**
 * Execute one statement against the in-memory Db.
 *
 * The only statements that mutate `db.status` are the ones whose text actually
 * carries a matching predicate, so the model reproduces Postgres faithfully: an
 * UPDATE with `AND status = 'PENDING'` is a single-winner claim, and an UPDATE
 * without it overwrites whatever is there. `rowCount` and `rows` follow from that,
 * which is what lets the loser be detected — or not.
 */
function runStatement(
  db: Db,
  adj: { type: 'credit' | 'debit'; amount_cents: number },
  rawSql: string,
  params: unknown[] = [],
  journal?: Array<() => void>,
): { rows: any[]; rowCount: number } {
  const sql = String(rawSql).replace(/\s+/g, ' ').trim();
  db.executed.push(sql);
  const undo = (fn: () => void) => { journal?.push(fn); };

  // The authoritative re-read a claim loser uses to classify what actually happened.
  if (/SELECT[\s\S]*FROM admin_adjustments/i.test(sql)) {
    if (db.missing) return { rows: [], rowCount: 0 };
    return { rows: [ADJUSTMENT_ROW(db, adj)], rowCount: 1 };
  }

  if (/UPDATE admin_adjustments/i.test(sql)) {
    const target = /status\s*=\s*'APPROVED'/i.test(sql) ? 'APPROVED'
      : /status\s*=\s*'REJECTED'/i.test(sql) ? 'REJECTED' : null;
    if (!target) return { rows: [], rowCount: 0 };
    if (db.missing) return { rows: [], rowCount: 0 };
    const predicated = /status\s*=\s*'PENDING'/i.test(sql.replace(/SET[\s\S]*?WHERE/i, 'WHERE'));
    if (predicated && db.status !== 'PENDING') return { rows: [], rowCount: 0 };
    const before = { ...ADJUSTMENT_ROW(db, adj) };
    const prevStatus = db.status;
    db.status = target as Db['status'];
    undo(() => { db.status = prevStatus; });
    // RETURNING hands back the row as claimed, i.e. with its new status.
    return { rows: [{ ...before, status: target }], rowCount: 1 };
  }

  // Additive credit upsert.
  if (/INSERT INTO wallets/i.test(sql)) {
    const amt = Number(params[2] ?? 0);
    db.balanceCents += amt;
    db.moneyWrites.push({ kind: 'credit', amountCents: amt });
    undo(() => { db.balanceCents -= amt; db.moneyWrites.pop(); });
    return { rows: [], rowCount: 1 };
  }

  // Guarded debit: matches a row only when the AVAILABLE balance covers it, which
  // is what the `balance_cents - COALESCE(reserved_cents, 0) >= $1` predicate does.
  if (/UPDATE wallets/i.test(sql) && /balance_cents[^;]*>=\s*\$1/.test(sql)) {
    const amt = Number(params[0] ?? 0);
    if (db.balanceCents - db.reservedCents < amt) return { rows: [], rowCount: 0 };
    db.balanceCents -= amt;
    db.moneyWrites.push({ kind: 'debit', amountCents: amt });
    undo(() => { db.balanceCents += amt; db.moneyWrites.pop(); });
    return { rows: [], rowCount: 1 };
  }

  if (/INSERT INTO transactions/i.test(sql)) {
    db.ledger.push({ reference: params[3], amountCents: params[1] });
    undo(() => { db.ledger.pop(); });
    return { rows: [{ id: `tx-${db.ledger.length}` }], rowCount: 1 };
  }

  return { rows: [], rowCount: 1 };
}

/**
 * Wire the db mocks against one shared Db, with a 2-party barrier at the first
 * database touch of each request.
 *
 * `transaction()` journals the mutations its own callback made and reverses them
 * if the callback throws — a real ROLLBACK, scoped to that transaction so it cannot
 * undo a concurrent transaction's committed work. That is what lets the suite
 * assert that a failed money guard leaves the adjustment PENDING instead of
 * consuming its claim.
 */
function wire(db: Db, adj: { type: 'credit' | 'debit'; amount_cents: number }, parties = 2) {
  const arrive = makeBarrier(parties);

  mockQueryOne.mockImplementation(async (sql: string) => {
    const flat = String(sql).replace(/\s+/g, ' ');
    if (/FROM users/i.test(flat)) return { id: USER_ID };
    if (/FROM admin_adjustments/i.test(flat)) {
      // The pre-read the defective approve path relied on. Barrier here so both
      // requests observe PENDING before either commits.
      await arrive();
      if (db.missing) return null;
      return ADJUSTMENT_ROW(db, adj);
    }
    return null;
  });

  // Pool-level writes (the reject path issues its claim through `query`).
  // NOTE: `server/db/pool.ts`'s `query()` resolves to `result.rows` — an ARRAY, with
  // no `.rowCount`. The mock returns the same shape so a claim-result check written
  // against `.rowCount` here would fail exactly as it would in production.
  mockQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
    if (/admin_adjustments/i.test(String(sql))) await arrive();
    return runStatement(db, adj, sql, params).rows;
  });

  mockTransaction.mockImplementation(async (fn: any) => {
    await arrive();
    const journal: Array<() => void> = [];
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => runStatement(db, adj, sql, params, journal)),
    };
    try {
      return await fn(client);
    } catch (err) {
      for (const revert of journal.reverse()) revert();
      throw err;
    }
  });
}

const auditActions = () => mockCreateAuditLog.mock.calls.map((c) => (c[0] as any)?.action);
const claimIndex = (db: Db) => db.executed.findIndex((s) => /UPDATE admin_adjustments/i.test(s));
const firstMoneyIndex = (db: Db) => db.executed.findIndex((s) => /wallets/i.test(s));

async function loadAdminRouter() {
  vi.resetModules();
  const mod = await import('../admin');
  return (mod as any).adminRouter;
}

const approve = (router: any) =>
  invokeRouter(router, 'POST', `/adjustments/${ADJ_ID}/approve`, { body: {} });
const reject = (router: any) =>
  invokeRouter(router, 'POST', `/adjustments/${ADJ_ID}/reject`, { body: { reason: 'not legitimate' } });

beforeEach(() => {
  mockCreateAuditLog.mockResolvedValue(undefined);
});

afterEach(() => {
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
  mockCreateAuditLog.mockReset();
});

describe('R3-7: approve + approve — one financial effect', () => {
  it('a concurrent double approval of a CREDIT credits the wallet exactly once', async () => {
    const db = freshDb({ balanceCents: 0 });
    const adj = { type: 'credit' as const, amount_cents: 50_00 };
    wire(db, adj);
    const router = await loadAdminRouter();

    const [a, b] = await Promise.all([approve(router), approve(router)]);

    // The reproduction: the additive upsert ran twice, so the user got 100.00 for
    // a single approved 50.00 adjustment.
    expect(db.moneyWrites).toHaveLength(1);
    expect(db.balanceCents).toBe(50_00);
    expect(db.ledger).toHaveLength(1);
    expect(db.status).toBe('APPROVED');

    const codes = [a.status, b.status].sort();
    expect(codes[0]).toBe(200);
    expect(codes[1]).toBeGreaterThanOrEqual(400);
  });

  it('a concurrent double approval of a DEBIT debits the wallet exactly once', async () => {
    const db = freshDb({ balanceCents: 500_00 });
    const adj = { type: 'debit' as const, amount_cents: 50_00 };
    wire(db, adj);
    const router = await loadAdminRouter();

    await Promise.all([approve(router), approve(router)]);

    expect(db.moneyWrites).toEqual([{ kind: 'debit', amountCents: 50_00 }]);
    expect(db.balanceCents).toBe(450_00);
    expect(db.ledger).toHaveLength(1);
  });

  it('the loser writes no ledger row and no APPROVED audit entry', async () => {
    const db = freshDb({ balanceCents: 0 });
    wire(db, { type: 'credit', amount_cents: 25_00 });
    const router = await loadAdminRouter();

    await Promise.all([approve(router), approve(router)]);

    expect(db.ledger).toHaveLength(1);
    // Exactly one approval happened, so exactly one approval may be recorded.
    expect(auditActions().filter((x) => x === 'ADJUSTMENT_APPROVED')).toHaveLength(1);
  });

  it('claims the adjustment BEFORE touching money', async () => {
    const db = freshDb({ balanceCents: 0 });
    wire(db, { type: 'credit', amount_cents: 10_00 }, 1);
    const router = await loadAdminRouter();

    await approve(router);

    const claim = claimIndex(db);
    const money = firstMoneyIndex(db);
    expect(claim, 'the approve path must issue an UPDATE admin_adjustments claim').toBeGreaterThanOrEqual(0);
    expect(money).toBeGreaterThanOrEqual(0);
    expect(claim).toBeLessThan(money);
  });
  it('approving a missing adjustment is still 404, not a claim loss', async () => {
    // The old path got its 404 from the unlocked pre-read. Removing that pre-read
    // must not turn "no such adjustment" into "already processed".
    const db = freshDb({ missing: true });
    wire(db, { type: 'credit', amount_cents: 10_00 }, 1);
    const router = await loadAdminRouter();

    const res = await approve(router);

    expect(res.status).toBe(404);
    expect(res.body?.error?.code).toBe('NOT_FOUND');
    expect(db.moneyWrites).toHaveLength(0);
    expect(db.ledger).toHaveLength(0);
    expect(auditActions()).not.toContain('ADJUSTMENT_APPROVED');
  });
});

describe('R3-7: approve + reject — exactly one terminal winner', () => {
  it('the rejection is not silently overwritten, and money follows the winner', async () => {
    const db = freshDb({ balanceCents: 0 });
    wire(db, { type: 'credit', amount_cents: 40_00 });
    const router = await loadAdminRouter();

    const [ap, rj] = await Promise.all([approve(router), reject(router)]);

    // Whichever won, the row must be terminal in exactly one direction and the
    // money must agree with it. Before the fix the approval's predicate-less UPDATE
    // could stamp APPROVED over a committed REJECTED *and* credit the wallet.
    expect(['APPROVED', 'REJECTED']).toContain(db.status);
    if (db.status === 'APPROVED') {
      expect(db.moneyWrites).toHaveLength(1);
      expect(db.ledger).toHaveLength(1);
      expect(auditActions()).not.toContain('ADJUSTMENT_REJECTED');
      expect(ap.status).toBe(200);
      expect(rj.status).toBeGreaterThanOrEqual(400);
    } else {
      expect(db.moneyWrites).toHaveLength(0);
      expect(db.ledger).toHaveLength(0);
      expect(db.balanceCents).toBe(0);
      expect(auditActions()).not.toContain('ADJUSTMENT_APPROVED');
      expect(rj.status).toBe(200);
      expect(ap.status).toBeGreaterThanOrEqual(400);
    }
    // Exactly one of the two requests may report success.
    expect([ap.status, rj.status].filter((s) => s < 400)).toHaveLength(1);
    // ...and exactly one terminal audit entry may exist.
    expect(auditActions().filter((x) => x === 'ADJUSTMENT_APPROVED' || x === 'ADJUSTMENT_REJECTED')).toHaveLength(1);
  });

  it('an approval that arrives after a committed rejection moves no money at all', async () => {
    // Sequential, not racing: the rejection has already committed.
    const db = freshDb({ status: 'REJECTED', balanceCents: 0 });
    wire(db, { type: 'credit', amount_cents: 40_00 }, 1);
    const router = await loadAdminRouter();

    const res = await approve(router);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(db.status).toBe('REJECTED');
    expect(db.moneyWrites).toHaveLength(0);
    expect(db.balanceCents).toBe(0);
    expect(db.ledger).toHaveLength(0);
    expect(auditActions()).not.toContain('ADJUSTMENT_APPROVED');
  });
});

describe('LOW-6: reject + reject — one winner, no misleading audit', () => {
  it('a concurrent double rejection reports success exactly once', async () => {
    const db = freshDb();
    wire(db, { type: 'credit', amount_cents: 30_00 });
    const router = await loadAdminRouter();

    const [a, b] = await Promise.all([reject(router), reject(router)]);

    expect(db.status).toBe('REJECTED');
    expect([a.status, b.status].filter((s) => s < 400)).toHaveLength(1);
    // The loser changed nothing, so it must not claim to have rejected anything.
    expect(auditActions().filter((x) => x === 'ADJUSTMENT_REJECTED')).toHaveLength(1);
  });

  it('rejecting an already-APPROVED adjustment fails instead of reporting success', async () => {
    const db = freshDb({ status: 'APPROVED' });
    wire(db, { type: 'credit', amount_cents: 30_00 }, 1);
    const router = await loadAdminRouter();

    const res = await reject(router);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(db.status).toBe('APPROVED');
    expect(auditActions()).not.toContain('ADJUSTMENT_REJECTED');
  });

  it('rejecting a missing adjustment is 404, not a success with no effect', async () => {
    // No row matches: the claim affects 0 rows and the follow-up read finds nothing.
    const db = freshDb({ missing: true });
    wire(db, { type: 'credit', amount_cents: 30_00 }, 1);
    const router = await loadAdminRouter();

    const res = await reject(router);

    expect(res.status).toBe(404);
    expect(auditActions()).not.toContain('ADJUSTMENT_REJECTED');
  });
});

describe('R3-7: rollback safety and claimed-row provenance', () => {
  it('a failed debit guard rolls the claim back, leaving the row PENDING', async () => {
    // 500.00 debit against 100.00 available: the guarded UPDATE matches 0 rows.
    const db = freshDb({ balanceCents: 100_00 });
    wire(db, { type: 'debit', amount_cents: 500_00 }, 1);
    const router = await loadAdminRouter();

    const res = await approve(router);

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('INSUFFICIENT_BALANCE');
    // The claim must not be consumed by an approval that could not be applied,
    // or the adjustment becomes unresolvable: APPROVED with no money moved.
    expect(db.status).toBe('PENDING');
    expect(db.moneyWrites).toHaveLength(0);
    expect(db.ledger).toHaveLength(0);
    expect(db.balanceCents).toBe(100_00);
    expect(auditActions()).not.toContain('ADJUSTMENT_APPROVED');
  });

  it('the money amount comes from the claimed row, not a stale unlocked pre-read', async () => {
    // The unlocked pre-read reports a stale 1.00; the row actually claimed says
    // 50.00. A path that pays the pre-read amount would move the wrong money.
    const db = freshDb({ balanceCents: 0 });
    wire(db, { type: 'credit', amount_cents: 50_00 }, 1);
    mockQueryOne.mockImplementation(async (sql: string) => {
      const flat = String(sql).replace(/\s+/g, ' ');
      if (/FROM users/i.test(flat)) return { id: USER_ID };
      if (/FROM admin_adjustments/i.test(flat)) {
        return { id: ADJ_ID, user_id: USER_ID, currency: 'USD', status: 'PENDING', reason: 'stale pre-read row', type: 'credit', amount_cents: 100 };
      }
      return null;
    });
    const router = await loadAdminRouter();

    const res = await approve(router);

    expect(res.status).toBe(200);
    expect(db.moneyWrites).toEqual([{ kind: 'credit', amountCents: 50_00 }]);
    expect(db.balanceCents).toBe(50_00);
    expect(db.ledger[0]?.amountCents).toBe(50_00);
  });
});

describe('R3-7: the claim shape is pinned in the source', () => {
  const src = readFileSync(join(__dirname, '..', 'admin.ts'), 'utf8');
  const flat = src.replace(/\s+/g, ' ');

  it('every terminal admin_adjustments mutation carries a status predicate', () => {
    const updates = flat.match(/UPDATE admin_adjustments[^`]*/g) ?? [];
    expect(updates.length).toBeGreaterThanOrEqual(2);
    for (const u of updates) {
      expect(u, `predicate-less terminal mutation: ${u.slice(0, 160)}`)
        .toMatch(/status\s*=\s*'PENDING'/);
    }
  });

  it('every terminal admin_adjustments mutation uses RETURNING so the winner is knowable', () => {
    for (const u of flat.match(/UPDATE admin_adjustments[^`]*/g) ?? []) {
      expect(u, `no RETURNING: ${u.slice(0, 160)}`).toMatch(/RETURNING/);
    }
  });

  it('the approve handler no longer decides on an unlocked pre-read', () => {
    // The defect was `SELECT * FROM admin_adjustments WHERE id = $1` followed by an
    // application-level `status !== 'PENDING'` check. The status decision must come
    // from the claim's own rowCount instead.
    expect(flat).not.toMatch(/SELECT \* FROM admin_adjustments WHERE id = \$1/);
    expect(flat).not.toMatch(/adjustment\.status\s*!==\s*'PENDING'/);
  });
});
