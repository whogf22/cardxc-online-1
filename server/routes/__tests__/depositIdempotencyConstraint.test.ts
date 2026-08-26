/**
 * @vitest-environment node
 *
 * NEW-9 (MEDIUM) — behavioural half: the deposit fulfillment ROUTES must only
 * treat the transactions-idempotency constraint as idempotent success.
 *
 * `server/lib/__tests__/pgErrors.test.ts` pins the predicate. This suite proves
 * the routes actually use it, by throwing a real pg-shaped error out of the
 * fulfillment transaction and observing the HTTP outcome.
 *
 * The Stripe webhook is the sharpest case: `{ received: true }` permanently ACKs
 * the event, so Stripe never retries. Reporting success for an unrelated
 * integrity failure silently loses a paid deposit.
 *
 * Socket-free: driven in-process via invokeRouter (the sandbox forbids listen()).
 */
import { beforeEach, afterEach, vi, describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { invokeRouter } from './_invoke';

const OTP = '123456';
const OTP_HASH = crypto.createHash('sha256').update(OTP).digest('hex');
const ORDER_ID = '33333333-3333-4333-8333-333333333333';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockTransaction = vi.fn();
const mockGetCheckoutSession = vi.fn();
const mockConstructWebhookEvent = vi.fn();

vi.mock('../../db/pool', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  transaction: (fn: unknown) => mockTransaction(fn),
}));
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _r: any, n: any) => { req.user = { id: 'user-1' }; n(); },
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
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/emailService', () => ({
  sendDepositOtpEmail: vi.fn().mockResolvedValue(true),
  sendDepositSuccessEmail: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../services/stripeService', () => ({
  isStripeConfigured: () => true,
  getCheckoutSession: (...a: unknown[]) => mockGetCheckoutSession(...a),
  createCheckoutSession: vi.fn(),
  constructWebhookEvent: (...a: unknown[]) => mockConstructWebhookEvent(...a),
  getStripePublishableKey: () => 'pk_test_x',
  getStripe: () => null,
}));
vi.mock('../../services/fluzApi', () => ({
  isConfigured: () => false, createOrder: vi.fn(), getOrder: vi.fn(),
}));
vi.mock('../../services/cryptoProviderService', () => ({
  sendCryptoToWallet: vi.fn(), isCryptoProviderConfigured: () => false,
}));

/** A pg-shaped unique violation. */
const uniqueViolation = (constraint: string) => {
  const e: any = new Error(`duplicate key value violates unique constraint "${constraint}"`);
  e.code = '23505';
  e.constraint = constraint;
  return e;
};

/** A non-unique integrity failure. */
const checkViolation = () => {
  const e: any = new Error('new row violates check constraint "transactions_type_check"');
  e.code = '23514';
  e.constraint = 'transactions_type_check';
  return e;
};

const IDEMPOTENCY_CONSTRAINT = 'idx_transactions_idempotency_unique';
const UNRELATED_CONSTRAINT = 'wallets_user_id_currency_key';

function wireCommon(throwOnLedgerInsert: unknown) {
  mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  mockTransaction.mockImplementation(async (fn: any) => {
    const client = {
      query: vi.fn(async (sql: string) => {
        const flat = String(sql).replace(/\s+/g, ' ');
        if (flat.includes('UPDATE card_orders') && flat.includes('RETURNING')) {
          return { rows: [{ amount_cents: 100_00, currency: 'USD' }], rowCount: 1 };
        }
        if (flat.includes('INSERT INTO transactions')) {
          if (throwOnLedgerInsert) throw throwOnLedgerInsert;
          return { rows: [{ id: 'tx-1' }], rowCount: 1 };
        }
        if (flat.includes('INSERT INTO wallets')) return { rows: [{ balance_cents: 200_00 }], rowCount: 1 };
        if (flat.includes('SELECT balance_cents')) return { rows: [{ balance_cents: 100_00 }], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      }),
    };
    return fn(client);
  });
}

// ── OTP verify path ─────────────────────────────────────────────────────────
function wireOtp(throwOnLedgerInsert: unknown) {
  mockQueryOne.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM card_orders')) {
      return {
        id: ORDER_ID, user_id: 'user-1', status: 'PENDING',
        amount_cents: 100_00, currency: 'USD', provider_payment_id: 'cs_test_1',
      };
    }
    if (sql.includes('FROM deposit_otps')) {
      return {
        id: 'otp-1', otp_code: OTP_HASH, attempts: 0,
        expires_at: new Date(Date.now() + 600_000).toISOString(),
      };
    }
    if (sql.includes('FROM users')) return { email: 'u@example.com', full_name: 'U' };
    if (sql.includes('SELECT balance_cents')) return { balance_cents: 100_00 };
    return null;
  });
  mockGetCheckoutSession.mockResolvedValue({ payment_status: 'paid', status: 'complete' });
  wireCommon(throwOnLedgerInsert);
}

async function otpRouter() {
  vi.resetModules();
  const mod = await import('../depositOtp');
  return (mod as any).depositOtpRouter;
}

const otpVerify = (router: any) =>
  invokeRouter(router, 'POST', '/verify', { body: { orderId: ORDER_ID, otpCode: OTP } });

// ── Stripe webhook path ─────────────────────────────────────────────────────
function wireStripe(throwOnLedgerInsert: unknown) {
  mockQueryOne.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM card_orders')) {
      return {
        id: ORDER_ID, user_id: 'user-1', target_user_id: null, created_by_user_id: 'user-1',
        status: 'PENDING', amount_cents: 100_00, currency: 'USD',
        merchant_name: 'M', provider_payment_id: 'cs_test_1',
      };
    }
    return null;
  });
  mockConstructWebhookEvent.mockReturnValue({
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_1', payment_status: 'paid', status: 'complete',
        amount_total: 100_00, currency: 'usd', metadata: { orderId: ORDER_ID },
      },
    },
  });
  wireCommon(throwOnLedgerInsert);
}

async function stripeRouter() {
  vi.resetModules();
  const mod = await import('../cardCheckout');
  return (mod as any).paymentWebhookRouter;
}

const stripeWebhook = (router: any) =>
  invokeRouter(router, 'POST', '/stripe', {
    body: {},
    rawBody: Buffer.from('{}', 'utf8'),
    headers: { 'stripe-signature': 'sig' },
  });

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
});

afterEach(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
  mockGetCheckoutSession.mockReset();
  mockConstructWebhookEvent.mockReset();
});

describe('NEW-9: OTP verify narrows the 23505 handling', () => {
  it('the idempotency constraint yields idempotent success (200)', async () => {
    wireOtp(uniqueViolation(IDEMPOTENCY_CONSTRAINT));
    const res = await otpVerify(await otpRouter());

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('an UNRELATED unique violation surfaces as an error, not success', async () => {
    wireOtp(uniqueViolation(UNRELATED_CONSTRAINT));
    const res = await otpVerify(await otpRouter());

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body?.success).not.toBe(true);
  });

  it('a CHECK violation surfaces as an error', async () => {
    wireOtp(checkViolation());
    const res = await otpVerify(await otpRouter());

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body?.success).not.toBe(true);
  });

  it('a bare "duplicate key" message with no identifiable constraint surfaces as an error', async () => {
    // Exactly what the old /duplicate key/i check swallowed.
    const e: any = new Error('duplicate key value violates unique constraint');
    e.code = '23505';
    wireOtp(e);
    const res = await otpVerify(await otpRouter());

    expect(res.status).toBeGreaterThanOrEqual(500);
  });
});

describe('NEW-9: the Stripe webhook must not permanently ACK an unrelated failure', () => {
  it('the idempotency constraint is acknowledged (received: true)', async () => {
    wireStripe(uniqueViolation(IDEMPOTENCY_CONSTRAINT));
    const res = await stripeWebhook(await stripeRouter());

    expect(res.status).toBe(200);
    expect(res.body?.received).toBe(true);
  });

  it('an UNRELATED unique violation is NOT acknowledged, so Stripe retries', async () => {
    wireStripe(uniqueViolation(UNRELATED_CONSTRAINT));
    const res = await stripeWebhook(await stripeRouter());

    // Anything other than a 2xx ACK: Stripe will redeliver the event.
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body?.received).not.toBe(true);
  });

  it('a CHECK violation is NOT acknowledged', async () => {
    wireStripe(checkViolation());
    const res = await stripeWebhook(await stripeRouter());

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body?.received).not.toBe(true);
  });
});
