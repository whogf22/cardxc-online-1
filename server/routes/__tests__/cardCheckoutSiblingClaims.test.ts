/**
 * @vitest-environment node
 *
 * NEW-2 (HIGH) — the remaining unguarded card-order fulfillment paths.
 *
 * The Stripe webhook and the OTP verify path were both hardened with an atomic
 * claim (`UPDATE card_orders ... WHERE id = $1 AND status = 'PENDING' RETURNING`).
 * Two sibling paths in this same file were NOT:
 *
 *   provider webhook  (POST /payment,               formerly cardCheckout.ts:403)
 *   admin log replay  (POST /webhook-logs/:id/replay, formerly cardCheckout.ts:614)
 *
 * Both credited the wallet after only a NON-atomic `order.status === 'COMPLETED'`
 * pre-read, then wrote `UPDATE card_orders SET status = 'COMPLETED' ... WHERE
 * id = $2` with NO status predicate. They key their ledger row on
 * `card_${paymentId}` while Stripe uses `stripe_${session.id}` and OTP uses
 * `deposit_otp_${orderId}` — three different values for ONE order, so the unique
 * index on transactions.idempotency_key cannot dedupe them.
 *
 * Because `provider_payment_id` IS the Stripe session id, these paths resolve to
 * the same order as the guarded Stripe webhook. Concurrently, the guarded path
 * claims and commits while an unguarded path — whose pre-read already said
 * PENDING — credits anyway. Double credit survives.
 *
 * INVARIANTS PINNED HERE, for BOTH paths:
 *  - the atomic claim is the FIRST money-affecting statement in the transaction
 *  - the claim is scoped by status = 'PENDING'
 *  - the credit is sized from the CLAIMED row, not the stale pre-read
 *  - a lost claim credits nothing and emits no completion audit/log
 *
 * Socket-free: driven in-process via invokeRouter (the sandbox forbids listen()).
 */
import { beforeEach, afterEach, vi, describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { invokeRouter } from './_invoke';

const WEBHOOK_SECRET = 'test-provider-webhook-secret';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockTransaction = vi.fn();
const mockCreateAuditLog = vi.fn().mockResolvedValue(undefined);

vi.mock('../../db/pool', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  transaction: (fn: unknown) => mockTransaction(fn),
}));
vi.mock('../../services/auditService', () => ({
  createAuditLog: (...a: unknown[]) => mockCreateAuditLog(...a),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _r: any, n: any) => {
    req.user = { id: 'admin-1', email: 'admin@test.com', role: 'SUPER_ADMIN' };
    n();
  },
  requireRole: () => (_q: any, _s: any, n: any) => n(),
  requireSuperAdmin: (_q: any, _s: any, n: any) => n(),
  requireAdmin: (_q: any, _s: any, n: any) => n(),
  AuthenticatedRequest: {},
}));
vi.mock('../../middleware/rateLimit', () => ({
  apiLimiter: (_q: any, _s: any, n: any) => n(),
  sensitiveOpLimiter: (_q: any, _s: any, n: any) => n(),
  financialOpLimiter: (_q: any, _s: any, n: any) => n(),
  webhookLimiter: (_q: any, _s: any, n: any) => n(),
}));
vi.mock('../../services/fluzApi', () => ({
  isConfigured: () => false, createOrder: vi.fn(), getOrder: vi.fn(),
}));
vi.mock('../../services/stripeService', () => ({
  isStripeConfigured: () => false, getStripe: () => null,
  createCheckoutSession: vi.fn(), getCheckoutSession: vi.fn(), constructWebhookEvent: vi.fn(),
}));
vi.mock('../../services/emailService', () => ({
  sendDepositSuccessEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/cryptoProviderService', () => ({
  sendCryptoToWallet: vi.fn(), isCryptoProviderConfigured: () => false,
}));

const PAYMENT_ID = 'pay_abc123';
const ORDER = {
  id: 'order-1',
  user_id: 'user-1',
  target_user_id: null,
  created_by_user_id: 'user-1',
  amount_cents: 5000,
  currency: 'USD',
  merchant_name: 'Test Merchant',
  status: 'PENDING',
  provider_payment_id: PAYMENT_ID,
};

/** The amount on the CLAIMED row deliberately differs from the stale pre-read. */
const CLAIMED_AMOUNT = 7000;

interface WireOpts {
  claimRowCount?: number;
  orderStatus?: string;
}

function wire(opts: WireOpts = {}) {
  const { claimRowCount = 1, orderStatus = 'PENDING' } = opts;
  const executed: Array<{ sql: string; params: unknown[] }> = [];

  mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  mockQueryOne.mockImplementation(async (sql: string) => {
    const s = String(sql);
    if (s.includes('FROM card_orders')) return { ...ORDER, status: orderStatus };
    if (s.includes('INSERT INTO payment_webhook_logs')) return { id: 'log-1' };
    if (s.includes('FROM payment_webhook_logs')) {
      // Used both by the idempotency probes (must be null) and by the replay
      // route's log lookup (must return a payload).
      if (s.includes('SELECT id, payload, event_type')) {
        return { id: 'log-1', event_type: 'payment.completed', payload: JSON.stringify({ event: 'payment.completed', paymentId: PAYMENT_ID }) };
      }
      return null;
    }
    return null;
  });

  mockTransaction.mockImplementation(async (fn: any) => {
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        const flat = String(sql).replace(/\s+/g, ' ');
        executed.push({ sql: flat, params: params ?? [] });
        // The atomic claim.
        if (flat.includes('UPDATE card_orders') && flat.includes('RETURNING')) {
          return claimRowCount === 0
            ? { rows: [], rowCount: 0 }
            : { rows: [{ amount_cents: CLAIMED_AMOUNT, currency: ORDER.currency }], rowCount: 1 };
        }
        if (flat.includes('INSERT INTO transactions')) return { rows: [{ id: 'tx-1' }], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      }),
    };
    return fn(client);
  });
  return executed;
}

async function loadRouters() {
  vi.resetModules();
  const mod = await import('../cardCheckout');
  return {
    webhookRouter: (mod as any).paymentWebhookRouter,
    adminRouter: (mod as any).paymentAdminRouter,
  };
}

function signedProviderWebhook(router: any) {
  const payload = { event: 'payment.completed', paymentId: PAYMENT_ID, status: 'completed' };
  const raw = Buffer.from(JSON.stringify(payload), 'utf8');
  const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw.toString('utf8')).digest('hex');
  return invokeRouter(router, 'POST', '/payment', {
    body: payload,
    rawBody: raw,
    headers: { 'x-webhook-signature': signature },
  });
}

const walletCredits = (ex: Array<{ sql: string; params: unknown[] }>) =>
  ex.filter(e => e.sql.includes('INSERT INTO wallets') || (e.sql.includes('UPDATE wallets') && e.sql.includes('balance_cents')));

const claimStmt = (ex: Array<{ sql: string }>) =>
  ex.find(e => e.sql.includes('UPDATE card_orders') && e.sql.includes('RETURNING'));

beforeEach(() => {
  process.env.FLUZ_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

afterEach(() => {
  delete process.env.FLUZ_WEBHOOK_SECRET;
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
  mockCreateAuditLog.mockReset();
});

describe('NEW-2: provider webhook (POST /payment) atomic claim', () => {
  it('claims the order atomically before any credit, scoped to PENDING', async () => {
    const ex = wire();
    const { webhookRouter } = await loadRouters();
    const res = await signedProviderWebhook(webhookRouter);

    expect(res.status).toBe(200);

    const claim = claimStmt(ex);
    expect(claim).toBeDefined();
    expect(claim!.sql).toMatch(/status\s*=\s*'PENDING'/);

    // The claim must precede every wallet credit.
    const claimIdx = ex.findIndex(e => e.sql.includes('UPDATE card_orders') && e.sql.includes('RETURNING'));
    const creditIdx = ex.findIndex(e => e.sql.includes('INSERT INTO wallets'));
    expect(claimIdx).toBeGreaterThanOrEqual(0);
    expect(creditIdx).toBeGreaterThan(claimIdx);
  });

  it('credits the CLAIMED amount, not the stale pre-read amount', async () => {
    const ex = wire();
    const { webhookRouter } = await loadRouters();
    await signedProviderWebhook(webhookRouter);

    const credits = walletCredits(ex);
    expect(credits.length).toBeGreaterThan(0);
    // 7000 came from RETURNING; 5000 was the stale pre-transaction read.
    expect(credits[0].params).toContain(CLAIMED_AMOUNT);
    expect(credits[0].params).not.toContain(ORDER.amount_cents);
  });

  it('race loser (claim matches 0 rows): no credit, no completion audit', async () => {
    const ex = wire({ claimRowCount: 0 });
    const { webhookRouter } = await loadRouters();
    const res = await signedProviderWebhook(webhookRouter);

    // Idempotent success — the other path already fulfilled this order.
    expect(res.status).toBe(200);
    expect(walletCredits(ex).length).toBe(0);
    expect(ex.some(e => e.sql.includes('INSERT INTO transactions'))).toBe(false);
    const completed = mockCreateAuditLog.mock.calls.some(
      c => (c[0] as any)?.action === 'CARD_PAYMENT_COMPLETED',
    );
    expect(completed).toBe(false);
  });
});

describe('NEW-2: admin webhook-log replay atomic claim', () => {
  const replay = (router: any) =>
    invokeRouter(router, 'POST', '/webhook-logs/log-1/replay', { body: {} });

  it('claims the order atomically before any credit, scoped to PENDING', async () => {
    const ex = wire();
    const { adminRouter } = await loadRouters();
    const res = await replay(adminRouter);

    expect(res.status).toBe(200);

    const claim = claimStmt(ex);
    expect(claim).toBeDefined();
    expect(claim!.sql).toMatch(/status\s*=\s*'PENDING'/);

    const claimIdx = ex.findIndex(e => e.sql.includes('UPDATE card_orders') && e.sql.includes('RETURNING'));
    const creditIdx = ex.findIndex(e => e.sql.includes('INSERT INTO wallets'));
    expect(claimIdx).toBeGreaterThanOrEqual(0);
    expect(creditIdx).toBeGreaterThan(claimIdx);
  });

  it('credits the CLAIMED amount, not the stale pre-read amount', async () => {
    const ex = wire();
    const { adminRouter } = await loadRouters();
    await replay(adminRouter);

    const credits = walletCredits(ex);
    expect(credits.length).toBeGreaterThan(0);
    expect(credits[0].params).toContain(CLAIMED_AMOUNT);
    expect(credits[0].params).not.toContain(ORDER.amount_cents);
  });

  it('race loser (claim matches 0 rows): no credit, no ledger row', async () => {
    const ex = wire({ claimRowCount: 0 });
    const { adminRouter } = await loadRouters();
    const res = await replay(adminRouter);

    expect(res.status).toBe(200);
    expect(walletCredits(ex).length).toBe(0);
    expect(ex.some(e => e.sql.includes('INSERT INTO transactions'))).toBe(false);
  });
});
