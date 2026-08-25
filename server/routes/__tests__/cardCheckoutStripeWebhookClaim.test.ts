/**
 * @vitest-environment node
 *
 * HIGH-2 — Stripe webhook side of the webhook-vs-OTP deposit double-credit race.
 *
 * A card order created through the OTP deposit flow also has a live Stripe
 * checkout session, so BOTH `POST /api/deposit-otp/verify` and this webhook can
 * try to fulfill the SAME order. They write different transaction idempotency
 * keys (`deposit_otp_<order>` vs `stripe_<session>`), so the unique index on
 * transactions.idempotency_key cannot dedupe them, and the pre-transaction
 * `order.status === 'COMPLETED'` guard is a non-atomic read.
 *
 * The shared identity is the ORDER, so both paths must serialize on an atomic
 * conditional claim of the order row — `UPDATE card_orders ... status = 'PENDING'
 * -> 'COMPLETED' RETURNING` — issued inside the same transaction as the credit.
 * Only the claim winner may credit.
 *
 * Socket-free: driven in-process via invokeRouter (the sandbox forbids listen(),
 * which is why the supertest-based sibling suite cannot run here).
 */
import { afterEach, beforeEach, vi, describe, it, expect } from 'vitest';
import { invokeRouter } from './_invoke';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockTransaction = vi.fn();
const mockConstructWebhookEvent = vi.fn();

vi.mock('../../db/pool', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  transaction: (fn: unknown) => mockTransaction(fn),
}));
vi.mock('../../middleware/auth', () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
  requireSuperAdmin: (_req: any, _res: any, next: any) => next(),
  AuthenticatedRequest: {},
}));
vi.mock('../../middleware/rateLimit', () => ({
  sensitiveOpLimiter: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../services/auditService', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/stripeService', () => ({
  isStripeConfigured: () => true,
  getStripePublishableKey: () => 'pk_test_x',
  createCheckoutSession: vi.fn(),
  getCheckoutSession: vi.fn(),
  constructWebhookEvent: (...a: unknown[]) => mockConstructWebhookEvent(...a),
}));

const ORDER = {
  id: 'order-1',
  user_id: 'user-1',
  target_user_id: null,
  amount_cents: 15000,
  currency: 'USD',
  status: 'PENDING',
  created_by_user_id: 'user-1',
};

const SESSION = {
  id: 'cs_test_123',
  payment_status: 'paid',
  amount_total: 15000,
  currency: 'usd',
  metadata: { orderId: ORDER.id },
};

interface WireOpts {
  claimRowCount?: number;
  orderStatus?: string;
  txThrows?: unknown;
}

function wire(opts: WireOpts = {}): { sql: string; params: unknown[] }[] {
  const { claimRowCount = 1, orderStatus = 'PENDING', txThrows } = opts;

  mockQueryOne.mockResolvedValue({ ...ORDER, status: orderStatus });
  mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });
  mockConstructWebhookEvent.mockReturnValue({
    id: 'evt_1',
    type: 'checkout.session.completed',
    data: { object: SESSION },
  });

  const executed: { sql: string; params: unknown[] }[] = [];
  mockTransaction.mockImplementation(async (fn: any) => {
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        executed.push({ sql, params: params ?? [] });
        if (sql.includes('UPDATE card_orders') && sql.includes('RETURNING')) {
          return claimRowCount > 0
            ? { rowCount: 1, rows: [{ amount_cents: ORDER.amount_cents, currency: ORDER.currency }] }
            : { rowCount: 0, rows: [] };
        }
        if (sql.includes('INSERT INTO transactions')) {
          if (txThrows) throw txThrows;
          return { rowCount: 1, rows: [{ id: 'tx-1' }] };
        }
        return { rowCount: 1, rows: [] };
      }),
    };
    return fn(client);
  });
  return executed;
}

// STRIPE_WEBHOOK_SECRET is captured at module scope, so the router must be
// imported fresh after the env is set.
async function loadWebhookRouter() {
  vi.resetModules();
  const mod = await import('../cardCheckout');
  return mod.paymentWebhookRouter as any;
}

function post(router: any) {
  return invokeRouter(router, 'POST', '/stripe', {
    headers: { 'stripe-signature': 't=1,v1=sig' },
    rawBody: Buffer.from('{}'),
    body: {},
  });
}

const claimIndex = (executed: { sql: string }[]) =>
  executed.findIndex((e) => e.sql.includes('UPDATE card_orders') && e.sql.includes('RETURNING'));
const creditIndex = (executed: { sql: string }[]) =>
  executed.findIndex((e) => e.sql.includes('INSERT INTO wallets'));
const txInsertRan = (executed: { sql: string }[]) =>
  executed.some((e) => e.sql.includes('INSERT INTO transactions'));

let savedSecret: string | undefined;

beforeEach(() => {
  savedSecret = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
});

afterEach(() => {
  if (savedSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = savedSecret;
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
  mockConstructWebhookEvent.mockReset();
});

describe('POST /stripe — atomic order fulfillment claim', () => {
  it('claims the order atomically (PENDING -> COMPLETED RETURNING) before crediting', async () => {
    const executed = wire({ claimRowCount: 1 });
    const res = await post(await loadWebhookRouter());

    expect(res.status).toBe(200);
    expect(res.body?.received).toBe(true);

    const ci = claimIndex(executed);
    expect(ci, 'atomic order claim must run inside the fulfillment transaction').toBeGreaterThanOrEqual(0);
    expect(executed[ci].sql).toMatch(/status\s*=\s*'PENDING'/);
    expect(executed[ci].sql).toContain('COMPLETED');
    expect(creditIndex(executed)).toBeGreaterThan(ci);
  });

  it('does NOT credit when the claim loses the race to the OTP path (0 rows) — idempotent 200', async () => {
    const executed = wire({ claimRowCount: 0 });
    const res = await post(await loadWebhookRouter());

    expect(res.status).toBe(200);
    expect(res.body?.received).toBe(true);
    expect(txInsertRan(executed)).toBe(false);
    expect(creditIndex(executed)).toBe(-1);
  });

  it('still returns an idempotent 200 on a duplicate-key (23505) race, never a 500', async () => {
    const dup: any = new Error('duplicate key value violates unique constraint "idx_transactions_idempotency_unique"');
    dup.code = '23505';
    wire({ claimRowCount: 1, txThrows: dup });
    const res = await post(await loadWebhookRouter());

    expect(res.status).toBe(200);
    expect(res.body?.received).toBe(true);
  });

  it('still short-circuits an already-COMPLETED order before opening a transaction', async () => {
    wire({ orderStatus: 'COMPLETED' });
    const res = await post(await loadWebhookRouter());

    expect(res.status).toBe(200);
    expect(res.body?.received).toBe(true);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
