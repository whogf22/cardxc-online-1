/**
 * @vitest-environment node
 *
 * Regression tests for the OTP deposit verify path.
 *
 * HIGH-1 — Stripe test-key payment-confirmation bypass:
 *   An sk_test_ key must NOT, on its own, bypass paid-session confirmation. A
 *   production-shaped environment fails closed (402) even with a test key and
 *   the opt-in flag set. The demo bypass only fires in a non-production env
 *   that has explicitly opted in.
 *
 * HIGH-2 / MEDIUM — OTP-verify vs Stripe-webhook double-credit race and the
 * idempotency-unique 500:
 *   An OTP-initiated order also has a live Stripe checkout session, so the
 *   Stripe webhook AND this verify path can both try to fulfill the SAME order
 *   under DIFFERENT transaction idempotency keys (deposit_otp_<order> vs
 *   stripe_<session>) — the transactions unique index cannot dedupe across
 *   them. The fix serializes on the shared identity (the order): an atomic
 *   conditional UPDATE card_orders ... status='PENDING' -> 'COMPLETED'
 *   RETURNING claim inside the transaction. Only the single winner credits;
 *   a lost claim or a duplicate-key (23505) race returns an idempotent 200,
 *   never a second credit and never a 500.
 *
 * Socket-free: driven in-process via invokeRouter (sandbox forbids listen()).
 */
import { afterEach, beforeEach, vi, describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { invokeRouter } from './_invoke';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockTransaction = vi.fn();
const mockGetCheckoutSession = vi.fn();
const mockSendSuccess = vi.fn().mockResolvedValue(true);

vi.mock('../../db/pool', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  transaction: (fn: unknown) => mockTransaction(fn),
}));
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1' };
    next();
  },
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
vi.mock('../../services/emailService', () => ({
  sendDepositOtpEmail: vi.fn().mockResolvedValue(true),
  sendDepositSuccessEmail: (...a: unknown[]) => mockSendSuccess(...a),
}));
vi.mock('../../services/stripeService', () => ({
  isStripeConfigured: () => true,
  getCheckoutSession: (...a: unknown[]) => mockGetCheckoutSession(...a),
  createCheckoutSession: vi.fn(),
  getStripePublishableKey: () => 'pk_test_x',
}));

// Must be a real RFC-4122 UUID: the route validates with isUUID(), and
// validator.js requires a valid version nibble ([1-8]) and variant ([89ab]).
const ORDER_ID = '33333333-3333-4333-8333-333333333333';
const OTP = '123456';
const OTP_HASH = crypto.createHash('sha256').update(OTP).digest('hex');

const ENV_KEYS = ['NODE_ENV', 'STRIPE_SECRET_KEY', 'ALLOW_UNCONFIRMED_DEPOSITS', 'ENABLE_STABLECOIN_FULFILLMENT'] as const;
let savedEnv: Record<string, string | undefined>;

function setEnv(over: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

interface WireOpts {
  orderStatus?: string;
  paid?: boolean;
  claimRowCount?: number;
  txThrows?: unknown;
}

function wireDefaults(opts: WireOpts = {}): { sql: string; params?: unknown[] }[] {
  const { orderStatus = 'PENDING', paid = true, claimRowCount = 1, txThrows } = opts;

  mockQueryOne.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM card_orders')) {
      return {
        id: ORDER_ID,
        user_id: 'user-1',
        status: orderStatus,
        amount_cents: 100_00,
        currency: 'USD',
        provider_payment_id: 'cs_test_123',
      };
    }
    if (sql.includes('FROM deposit_otps')) {
      return {
        id: 'otp-1',
        otp_code: OTP_HASH,
        attempts: 0,
        expires_at: new Date(Date.now() + 600_000).toISOString(),
      };
    }
    if (sql.includes('FROM users')) {
      return { email: 'u@example.com', full_name: 'U Name' };
    }
    return null;
  });

  mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });
  mockGetCheckoutSession.mockResolvedValue(
    paid ? { payment_status: 'paid', status: 'complete' } : { payment_status: 'unpaid', status: 'open' },
  );

  const executed: { sql: string; params?: unknown[] }[] = [];
  mockTransaction.mockImplementation(async (fn: any) => {
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        executed.push({ sql, params });
        if (sql.includes('UPDATE card_orders') && sql.includes('RETURNING')) {
          return claimRowCount > 0
            ? { rowCount: 1, rows: [{ id: ORDER_ID, amount_cents: 100_00, currency: 'USD' }] }
            : { rowCount: 0, rows: [] };
        }
        if (sql.includes('INSERT INTO transactions')) {
          if (txThrows) throw txThrows;
          return { rowCount: 1, rows: [{ id: 'tx-1' }] };
        }
        if (sql.includes('INSERT INTO wallets')) {
          return { rowCount: 1, rows: [{ balance_cents: 200_00 }] };
        }
        if (sql.includes('SELECT balance_cents FROM wallets')) {
          return { rowCount: 1, rows: [{ balance_cents: 100_00 }] };
        }
        return { rowCount: 1, rows: [] };
      }),
    };
    return fn(client);
  });

  return executed;
}

async function loadRouter() {
  vi.resetModules();
  const mod = await import('../depositOtp');
  return mod.depositOtpRouter as any;
}

function verify() {
  return { body: { orderId: ORDER_ID, otpCode: OTP } };
}

const creditRan = (executed: { sql: string }[]) =>
  executed.some((e) => e.sql.includes('INSERT INTO wallets') && e.sql.includes('balance_cents'));
const txInsertRan = (executed: { sql: string }[]) =>
  executed.some((e) => e.sql.includes('INSERT INTO transactions'));

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  setEnv({ ENABLE_STABLECOIN_FULFILLMENT: undefined }); // fiat-only unless a test opts in
});

afterEach(() => {
  setEnv(savedEnv);
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
  mockGetCheckoutSession.mockReset();
  mockSendSuccess.mockClear();
});

describe('POST /verify — HIGH-1 payment-confirmation bypass', () => {
  it('fails CLOSED (402) in production even with a test key + opt-in when the session is unpaid', async () => {
    setEnv({ NODE_ENV: 'production', STRIPE_SECRET_KEY: 'sk_test_abc', ALLOW_UNCONFIRMED_DEPOSITS: 'true' });
    const executed = wireDefaults({ paid: false });
    const router = await loadRouter();

    const res = await invokeRouter(router, 'POST', '/verify', verify());

    expect(res.status).toBe(402);
    expect(res.body?.error?.code).toBe('PAYMENT_NOT_CONFIRMED');
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(creditRan(executed)).toBe(false);
  });

  it('allows the bypass (200, credited) only in a non-production env that opted in with a test key', async () => {
    setEnv({ NODE_ENV: 'development', STRIPE_SECRET_KEY: 'sk_test_abc', ALLOW_UNCONFIRMED_DEPOSITS: 'true' });
    const executed = wireDefaults({ paid: false });
    const router = await loadRouter();

    const res = await invokeRouter(router, 'POST', '/verify', verify());

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(creditRan(executed)).toBe(true);
  });

  it('fails CLOSED (402) in a non-production env WITHOUT the explicit opt-in, even with a test key', async () => {
    setEnv({ NODE_ENV: 'development', STRIPE_SECRET_KEY: 'sk_test_abc', ALLOW_UNCONFIRMED_DEPOSITS: undefined });
    const executed = wireDefaults({ paid: false });
    const router = await loadRouter();

    const res = await invokeRouter(router, 'POST', '/verify', verify());

    expect(res.status).toBe(402);
    expect(creditRan(executed)).toBe(false);
  });

  it('credits a genuinely paid session regardless of environment (production + live key)', async () => {
    setEnv({ NODE_ENV: 'production', STRIPE_SECRET_KEY: 'sk_live_abc', ALLOW_UNCONFIRMED_DEPOSITS: undefined });
    const executed = wireDefaults({ paid: true });
    const router = await loadRouter();

    const res = await invokeRouter(router, 'POST', '/verify', verify());

    expect(res.status).toBe(200);
    expect(creditRan(executed)).toBe(true);
  });
});

describe('POST /verify — HIGH-2 / MEDIUM fulfillment idempotency', () => {
  it('claims the order atomically (UPDATE ... status PENDING -> COMPLETED RETURNING) before crediting', async () => {
    setEnv({ NODE_ENV: 'production', STRIPE_SECRET_KEY: 'sk_live_abc' });
    const executed = wireDefaults({ paid: true, claimRowCount: 1 });
    const router = await loadRouter();

    const res = await invokeRouter(router, 'POST', '/verify', verify());
    expect(res.status).toBe(200);

    const claimIdx = executed.findIndex(
      (e) => e.sql.includes('UPDATE card_orders') && e.sql.includes('RETURNING'),
    );
    const creditIdx = executed.findIndex((e) => e.sql.includes('INSERT INTO wallets'));
    expect(claimIdx, 'atomic order claim must run inside the transaction').toBeGreaterThanOrEqual(0);
    const claimSql = executed[claimIdx].sql;
    expect(claimSql).toMatch(/status\s*=\s*'PENDING'/); // claims only a still-pending order
    expect(claimSql).toContain('COMPLETED'); // and transitions it in the same statement
    expect(creditIdx).toBeGreaterThan(claimIdx); // credit strictly after winning the claim
  });

  it('does NOT credit again when the atomic claim loses the race (0 rows) — idempotent 200', async () => {
    // Order is PENDING at the pre-transaction read (passes the fast-path guard)
    // but a concurrent Stripe webhook completes it first, so the in-transaction
    // claim matches 0 rows. No second credit; caller still gets success.
    setEnv({ NODE_ENV: 'production', STRIPE_SECRET_KEY: 'sk_live_abc' });
    const executed = wireDefaults({ paid: true, claimRowCount: 0 });
    const router = await loadRouter();

    const res = await invokeRouter(router, 'POST', '/verify', verify());

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(txInsertRan(executed)).toBe(false);
    expect(creditRan(executed)).toBe(false);
  });

  it('translates a duplicate-key (23505) race into an idempotent 200, never a 500', async () => {
    setEnv({ NODE_ENV: 'production', STRIPE_SECRET_KEY: 'sk_live_abc' });
    const dupErr: any = new Error('duplicate key value violates unique constraint "idx_transactions_idempotency_unique"');
    dupErr.code = '23505';
    wireDefaults({ paid: true, claimRowCount: 1, txThrows: dupErr });
    const router = await loadRouter();

    const res = await invokeRouter(router, 'POST', '/verify', verify());

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('still rejects an already-COMPLETED order at the fast-path pre-read (400)', async () => {
    setEnv({ NODE_ENV: 'production', STRIPE_SECRET_KEY: 'sk_live_abc' });
    const executed = wireDefaults({ orderStatus: 'COMPLETED', paid: true });
    const router = await loadRouter();

    const res = await invokeRouter(router, 'POST', '/verify', verify());

    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('ALREADY_COMPLETED');
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(creditRan(executed)).toBe(false);
  });
});
