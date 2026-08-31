/**
 * @vitest-environment node
 *
 * PHASE 5 / PHASE 7 — BIGINT-as-string handling in the money paths.
 *
 * ESTABLISHED FACT: node-postgres registers OID 20 (int8/BIGINT) to
 * `parseBigInteger`, which returns a STRING (node_modules/pg-types/lib/textParsers.js
 * line 167). The repository installs no `setTypeParser` override, so every
 * BIGINT column — wallets.balance_cents, wallets.usdt_balance_cents,
 * card_orders.amount_cents, transactions.amount_cents,
 * withdrawal_requests.amount_cents — arrives in JavaScript as a string.
 *
 * Two defects follow, and both are pinned here:
 *
 * 1. HIGH, REGRESSION introduced by commit 012205b. `usdtCentsForFiatCents`
 *    guards with `Number.isFinite(fiatCents)`, which does NOT coerce: per
 *    ES2015, if the argument is not a Number it returns false. So
 *    `Number.isFinite("5000") === false` and the helper returns null for every
 *    real database value, silently SKIPPING the stablecoin credit while the fiat
 *    credit still commits. The code it replaced —
 *    `Math.round(order.amount_cents / USDT_RATE)` — coerced correctly, so this
 *    is a functional regression, not a pre-existing bug.
 *
 * 2. HIGH, PRE-EXISTING (present at baseline baf0dd5). The Stripe webhook
 *    compares `paidAmount !== order.amount_cents` where paidAmount is a JS
 *    number from the Stripe SDK and order.amount_cents is a BIGINT string.
 *    `5000 !== "5000"` is true, so a correctly-paid deposit takes the mismatch
 *    branch: the order is marked FAILED, a CARD_PAYMENT_MISMATCH audit record is
 *    written, `{ received: true }` permanently ACKs the event, and the wallet is
 *    never credited.
 *
 * Socket-free: driven in-process via invokeRouter (the sandbox forbids listen()).
 */
import { beforeEach, afterEach, vi, describe, it, expect } from 'vitest';
import { usdtCentsForFiatCents, resolveUsdtRate } from '../../lib/usdtRate';
import { invokeRouter } from './_invoke';

describe('1. usdtCentsForFiatCents accepts the BIGINT string pg actually returns', () => {
  it('the premise: Number.isFinite does not coerce a numeric string', () => {
    expect(Number.isFinite('5000' as unknown as number)).toBe(false);
  });

  it('converts a BIGINT string amount', () => {
    // This is exactly what `order.amount_cents` looks like at runtime.
    expect(usdtCentsForFiatCents('10000' as unknown as number, 1)).toBe(10_000);
    expect(usdtCentsForFiatCents('5000' as unknown as number, 1)).toBe(5_000);
  });

  it('still converts a plain number', () => {
    expect(usdtCentsForFiatCents(10_000, 1)).toBe(10_000);
  });

  it('agrees between the string and number forms at a non-parity rate', () => {
    const rate = resolveUsdtRate({ USDT_RATE: '1.25' } as NodeJS.ProcessEnv)!;
    expect(usdtCentsForFiatCents('10000' as unknown as number, rate))
      .toBe(usdtCentsForFiatCents(10_000, rate));
  });

  it('is STILL fail-safe on genuinely unusable input', () => {
    expect(usdtCentsForFiatCents('abc' as unknown as number, 1)).toBeNull();
    expect(usdtCentsForFiatCents('' as unknown as number, 1)).toBeNull();
    expect(usdtCentsForFiatCents('  ' as unknown as number, 1)).toBeNull();
    expect(usdtCentsForFiatCents('-1' as unknown as number, 1)).toBeNull();
    expect(usdtCentsForFiatCents('1e5' as unknown as number, 1)).toBeNull();
    expect(usdtCentsForFiatCents(Number.NaN, 1)).toBeNull();
    expect(usdtCentsForFiatCents(-1, 1)).toBeNull();
    expect(usdtCentsForFiatCents(null as unknown as number, 1)).toBeNull();
    expect(usdtCentsForFiatCents(undefined as unknown as number, 1)).toBeNull();
    expect(usdtCentsForFiatCents({} as unknown as number, 1)).toBeNull();
    // A bad rate is still refused regardless of the amount's type.
    expect(usdtCentsForFiatCents('10000' as unknown as number, 0)).toBeNull();
  });
});

// ── 2. the Stripe webhook amount comparison ────────────────────────────────
const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockTransaction = vi.fn();
const mockConstructWebhookEvent = vi.fn();
const mockCreateAuditLog = vi.fn().mockResolvedValue(undefined);

vi.mock('../../db/pool', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  transaction: (fn: unknown) => mockTransaction(fn),
}));
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _r: any, n: any) => { req.user = { id: 'u1' }; n(); },
  requireSuperAdmin: (_q: any, _s: any, n: any) => n(),
  requireRole: () => (_q: any, _s: any, n: any) => n(),
  AuthenticatedRequest: {},
}));
vi.mock('../../middleware/rateLimit', () => ({
  apiLimiter: (_q: any, _s: any, n: any) => n(),
  sensitiveOpLimiter: (_q: any, _s: any, n: any) => n(),
  financialOpLimiter: (_q: any, _s: any, n: any) => n(),
  webhookLimiter: (_q: any, _s: any, n: any) => n(),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../services/auditService', () => ({
  createAuditLog: (...a: unknown[]) => mockCreateAuditLog(...a),
}));
vi.mock('../../services/emailService', () => ({
  sendDepositSuccessEmail: vi.fn().mockResolvedValue(true),
  sendDepositOtpEmail: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../services/stripeService', () => ({
  isStripeConfigured: () => true,
  getCheckoutSession: vi.fn(),
  createCheckoutSession: vi.fn(),
  constructWebhookEvent: (...a: unknown[]) => mockConstructWebhookEvent(...a),
  getStripePublishableKey: () => 'pk_test_x',
  getStripe: () => null,
}));
vi.mock('../../services/fluzApi', () => ({
  isConfigured: () => false, createOrder: vi.fn(), getOrder: vi.fn(),
}));

const ORDER_ID = '66666666-6666-4666-8666-666666666666';

/** `amountCents` is supplied as a STRING, exactly as pg returns a BIGINT. */
function wireStripe(amountCents: string, paidTotal: number) {
  const executed: Array<{ sql: string; params: unknown[] }> = [];

  mockQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
    executed.push({ sql: String(sql).replace(/\s+/g, ' '), params: params ?? [] });
    return { rows: [], rowCount: 1 };
  });
  mockQueryOne.mockImplementation(async (sql: string) => {
    if (String(sql).includes('FROM card_orders')) {
      return {
        id: ORDER_ID, user_id: 'u1', target_user_id: null, created_by_user_id: 'u1',
        status: 'PENDING', amount_cents: amountCents, currency: 'USD',
        merchant_name: 'M', provider_payment_id: 'cs_1',
      };
    }
    return null;
  });
  mockConstructWebhookEvent.mockReturnValue({
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_1', payment_status: 'paid', status: 'complete',
        amount_total: paidTotal, currency: 'usd', metadata: { orderId: ORDER_ID },
      },
    },
  });
  mockTransaction.mockImplementation(async (fn: any) => {
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        const flat = String(sql).replace(/\s+/g, ' ');
        executed.push({ sql: flat, params: params ?? [] });
        if (flat.includes('UPDATE card_orders') && flat.includes('RETURNING')) {
          return { rows: [{ amount_cents: amountCents, currency: 'USD' }], rowCount: 1 };
        }
        if (flat.includes('INSERT INTO transactions')) return { rows: [{ id: 'tx1' }], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      }),
    };
    return fn(client);
  });
  return executed;
}

async function stripeRouter() {
  vi.resetModules();
  const mod = await import('../cardCheckout');
  return (mod as any).paymentWebhookRouter;
}

const post = (router: any) =>
  invokeRouter(router, 'POST', '/stripe', {
    body: {}, rawBody: Buffer.from('{}', 'utf8'),
    headers: { 'stripe-signature': 'sig' },
  });

const markedFailed = (ex: Array<{ sql: string }>) =>
  ex.some(e => e.sql.includes('UPDATE card_orders') && e.sql.includes("status = 'FAILED'"));
const credited = (ex: Array<{ sql: string }>) =>
  ex.some(e => e.sql.includes('INSERT INTO wallets'));
const mismatchAudited = () =>
  mockCreateAuditLog.mock.calls.some(c => (c[0] as any)?.action === 'CARD_PAYMENT_MISMATCH');

beforeEach(() => { process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x'; });
afterEach(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
  mockQuery.mockReset(); mockQueryOne.mockReset(); mockTransaction.mockReset();
  mockConstructWebhookEvent.mockReset(); mockCreateAuditLog.mockClear();
});

describe('2. the Stripe webhook accepts a correctly-paid deposit whose amount is a BIGINT string', () => {
  it('a matching payment is CREDITED, not marked FAILED', async () => {
    const ex = wireStripe('10000', 10_000);
    const res = await post(await stripeRouter());

    expect(res.status).toBe(200);
    expect(markedFailed(ex)).toBe(false);
    expect(mismatchAudited()).toBe(false);
    expect(credited(ex)).toBe(true);
  });

  it('a genuine UNDERPAYMENT is still rejected — the guard is not simply removed', async () => {
    const ex = wireStripe('10000', 5_000);
    const res = await post(await stripeRouter());

    expect(res.status).toBe(200);
    expect(markedFailed(ex)).toBe(true);
    expect(mismatchAudited()).toBe(true);
    expect(credited(ex)).toBe(false);
  });

  it('a genuine OVERPAYMENT is still rejected', async () => {
    const ex = wireStripe('10000', 20_000);
    await post(await stripeRouter());

    expect(markedFailed(ex)).toBe(true);
    expect(credited(ex)).toBe(false);
  });

  it('a missing amount_total is still rejected', async () => {
    const ex = wireStripe('10000', null as unknown as number);
    await post(await stripeRouter());

    expect(credited(ex)).toBe(false);
  });
});
