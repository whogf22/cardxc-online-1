/**
 * @vitest-environment node
 *
 * NEW-5 (MEDIUM) — a race loser must not emit any event claiming credit occurred.
 *
 * The OTP verify path gates only the success EMAIL on the atomic-claim winner
 * (`if (user && credited)`). Everything else ran unconditionally:
 *
 *   createAuditLog({ action: 'DEPOSIT_OTP_VERIFIED', newValues: { amount, newBalance } })
 *   logger.info('deposit_otp_verified_and_credited', { amountCents, newBalance })
 *   res.json({ message: 'Deposit verified and credited to your wallet!', amount })
 *
 * So when the Stripe webhook won the claim and this path credited NOTHING, the
 * audit trail still recorded a DEPOSIT_OTP_VERIFIED credit and the log line
 * literally said "verified_and_credited". For a fintech audit trail that is a
 * false financial record, and it makes double-credit investigations unreadable.
 * The sibling Stripe path already gates both correctly behind `if (fulfilled)`.
 *
 * Related LOW, fixed here because it is the same lines: the email, audit values,
 * log fields and HTTP receipt all read the STALE pre-claim `order.amount_cents` /
 * `order.currency` instead of the claimed row that actually sized the credit.
 *
 * Socket-free: driven in-process via invokeRouter (the sandbox forbids listen()).
 */
import { afterEach, beforeEach, vi, describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { invokeRouter } from './_invoke';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockTransaction = vi.fn();
const mockGetCheckoutSession = vi.fn();
const mockSendSuccess = vi.fn().mockResolvedValue(true);
const mockCreateAuditLog = vi.fn().mockResolvedValue(undefined);
const mockLoggerInfo = vi.fn();

vi.mock('../../db/pool', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  transaction: (fn: unknown) => mockTransaction(fn),
}));
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => { req.user = { id: 'user-1' }; next(); },
  AuthenticatedRequest: {},
}));
vi.mock('../../middleware/rateLimit', () => ({
  sensitiveOpLimiter: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../middleware/logger', () => ({
  logger: {
    info: (...a: unknown[]) => mockLoggerInfo(...a),
    warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  },
}));
vi.mock('../../services/auditService', () => ({
  createAuditLog: (...a: unknown[]) => mockCreateAuditLog(...a),
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

const ORDER_ID = '33333333-3333-4333-8333-333333333333';
const OTP = '123456';
const OTP_HASH = crypto.createHash('sha256').update(OTP).digest('hex');

/** The stale pre-read amount, and the DIFFERENT amount on the claimed row. */
const STALE_AMOUNT = 100_00;
const CLAIMED_AMOUNT = 137_00;

function wire(opts: { claimRowCount?: number } = {}) {
  const { claimRowCount = 1 } = opts;

  mockQueryOne.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM card_orders')) {
      return {
        id: ORDER_ID, user_id: 'user-1', status: 'PENDING',
        amount_cents: STALE_AMOUNT, currency: 'USD',
        provider_payment_id: 'cs_test_123',
      };
    }
    if (sql.includes('FROM deposit_otps')) {
      return {
        id: 'otp-1', otp_code: OTP_HASH, attempts: 0,
        expires_at: new Date(Date.now() + 600_000).toISOString(),
      };
    }
    if (sql.includes('FROM users')) return { email: 'u@example.com', full_name: 'U Name' };
    if (sql.includes('SELECT balance_cents FROM wallets')) return { balance_cents: 100_00 };
    return null;
  });

  mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });
  mockGetCheckoutSession.mockResolvedValue({ payment_status: 'paid', status: 'complete' });

  const executed: { sql: string; params?: unknown[] }[] = [];
  mockTransaction.mockImplementation(async (fn: any) => {
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        executed.push({ sql, params });
        if (sql.includes('UPDATE card_orders') && sql.includes('RETURNING')) {
          return claimRowCount > 0
            ? { rowCount: 1, rows: [{ amount_cents: CLAIMED_AMOUNT, currency: 'USD' }] }
            : { rowCount: 0, rows: [] };
        }
        if (sql.includes('INSERT INTO transactions')) return { rowCount: 1, rows: [{ id: 'tx-1' }] };
        if (sql.includes('INSERT INTO wallets')) return { rowCount: 1, rows: [{ balance_cents: 237_00 }] };
        if (sql.includes('SELECT balance_cents FROM wallets')) return { rowCount: 1, rows: [{ balance_cents: 100_00 }] };
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
  return (mod as any).depositOtpRouter;
}

const verify = (router: any) =>
  invokeRouter(router, 'POST', '/verify', { body: { orderId: ORDER_ID, otpCode: OTP } });

const auditActions = () => mockCreateAuditLog.mock.calls.map(c => (c[0] as any)?.action);
const loggedEvents = () => mockLoggerInfo.mock.calls.map(c => String(c[0]));

const ENV_KEYS = ['NODE_ENV', 'STRIPE_SECRET_KEY', 'ALLOW_UNCONFIRMED_DEPOSITS', 'ENABLE_STABLECOIN_FULFILLMENT'] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
  delete process.env.ENABLE_STABLECOIN_FULFILLMENT;
});

afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
  mockGetCheckoutSession.mockReset();
  mockSendSuccess.mockClear();
  mockCreateAuditLog.mockClear();
  mockLoggerInfo.mockClear();
});

describe('NEW-5: the claim LOSER emits no credit-success event', () => {
  it('writes no DEPOSIT_OTP_VERIFIED audit record when nothing was credited', async () => {
    wire({ claimRowCount: 0 });
    const res = await verify(await loadRouter());

    // Idempotent success to the caller — the order really is fulfilled.
    expect(res.status).toBe(200);
    // ...but this request credited nothing, so it must not claim it did.
    expect(auditActions()).not.toContain('DEPOSIT_OTP_VERIFIED');
  });

  it('logs no "verified_and_credited" event when nothing was credited', async () => {
    wire({ claimRowCount: 0 });
    await verify(await loadRouter());

    expect(loggedEvents()).not.toContain('deposit_otp_verified_and_credited');
    // A distinct, truthful event is expected instead.
    expect(loggedEvents()).toContain('deposit_otp_fulfillment_claim_lost');
  });

  it('sends no success email when nothing was credited', async () => {
    wire({ claimRowCount: 0 });
    await verify(await loadRouter());

    expect(mockSendSuccess).not.toHaveBeenCalled();
  });

  it('does not tell the user THIS request credited their wallet when it did not', async () => {
    wire({ claimRowCount: 0 });
    const res = await verify(await loadRouter());

    // The loser must not assert that it performed the credit. Saying the deposit
    // was ALREADY credited is truthful (another path did it) and acceptable.
    expect(res.body?.data?.message).not.toMatch(/^Deposit verified and credited/i);
    expect(res.body?.data?.message).toMatch(/already/i);
  });
});

describe('NEW-5: the claim WINNER reports the CLAIMED values, not the stale pre-read', () => {
  it('emits the credit-success audit and log exactly once', async () => {
    wire();
    await verify(await loadRouter());

    expect(auditActions().filter(a => a === 'DEPOSIT_OTP_VERIFIED')).toHaveLength(1);
    expect(loggedEvents()).toContain('deposit_otp_verified_and_credited');
  });

  it('the audit record carries the CLAIMED amount', async () => {
    wire();
    await verify(await loadRouter());

    const audit = mockCreateAuditLog.mock.calls
      .map(c => c[0] as any)
      .find(a => a?.action === 'DEPOSIT_OTP_VERIFIED');
    expect(audit).toBeDefined();
    expect(audit.newValues.amount).toBe(CLAIMED_AMOUNT);
    expect(audit.newValues.amount).not.toBe(STALE_AMOUNT);
  });

  it('the success email carries the CLAIMED amount', async () => {
    wire();
    await verify(await loadRouter());

    expect(mockSendSuccess).toHaveBeenCalledTimes(1);
    const args = mockSendSuccess.mock.calls[0];
    // sendDepositSuccessEmail(email, name, amount, currency, newBalance)
    expect(args[2]).toBe(CLAIMED_AMOUNT / 100);
  });

  it('the HTTP receipt carries the CLAIMED amount', async () => {
    wire();
    const res = await verify(await loadRouter());

    expect(res.status).toBe(200);
    expect(res.body?.data?.amount).toBe(CLAIMED_AMOUNT / 100);
    expect(res.body?.data?.amount).not.toBe(STALE_AMOUNT / 100);
  });
});
