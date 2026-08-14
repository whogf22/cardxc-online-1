/**
 * @vitest-environment node
 *
 * Regression tests for the Stripe checkout webhook credit gate.
 *
 * Invariant under test: the wallet is credited only once funds have actually
 * settled. checkout.session.completed with payment_status !== 'paid' (async /
 * redirect payment methods) must NOT credit; settlement arrives later via
 * checkout.session.async_payment_succeeded, which DOES credit.
 */
import express from 'express';
import request from 'supertest';
import { beforeAll, afterEach, vi, describe, it, expect } from 'vitest';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockTransaction = vi.fn();
const mockCreateAuditLog = vi.fn().mockResolvedValue(undefined);
const mockConstructWebhookEvent = vi.fn();

vi.mock('../../db/pool', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  transaction: (fn: (client: { query: typeof mockQuery }) => Promise<void>) => mockTransaction(fn),
}));
vi.mock('../../services/auditService', () => ({ createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args) }));
vi.mock('../../services/stripeService', () => ({
  constructWebhookEvent: (...args: unknown[]) => mockConstructWebhookEvent(...args),
  isStripeConfigured: () => true,
  getStripePublishableKey: () => 'pk_test',
  createCheckoutSession: vi.fn(),
  getCheckoutSession: vi.fn(),
}));

let paymentWebhookRouter: express.Router;
let app: express.Express;

beforeAll(async () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  vi.resetModules();
  const cardCheckout = await import('../cardCheckout');
  paymentWebhookRouter = cardCheckout.paymentWebhookRouter;
  app = express();
  app.use((req, _res, next) => {
    if (req.method === 'POST') {
      return express.raw({ type: '*/*', limit: '100kb' })(req, _res, (err?: unknown) => {
        if (err) return next(err as Error);
        const raw = req.body as Buffer;
        (req as express.Request & { rawBody?: Buffer }).rawBody = raw;
        (req as any).body = {};
        next();
      });
    }
    next();
  });
  app.use('/api/webhooks', paymentWebhookRouter);
});

afterEach(() => {
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
  mockCreateAuditLog.mockReset();
  mockConstructWebhookEvent.mockReset();
});

let capturedTxQueries: Array<{ sql: string; params?: unknown[] }> = [];

function primeOrderLookup(opts: { orderAmountCents?: number; throwOnTx?: unknown } = {}) {
  const { orderAmountCents = 100000, throwOnTx } = opts;
  capturedTxQueries = [];
  mockQueryOne.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT * FROM card_orders')) {
      return { id: 'order-1', user_id: 'user-1', target_user_id: null, amount_cents: orderAmountCents, currency: 'USD', status: 'PENDING' };
    }
    return null;
  });
  mockTransaction.mockImplementation(async (fn: (client: { query: (a: string, b?: unknown[]) => Promise<{ rows: { id: string }[] }> }) => Promise<void>) => {
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        capturedTxQueries.push({ sql, params });
        if (throwOnTx) throw throwOnTx;
        if (sql.includes('INSERT INTO transactions')) return { rows: [{ id: 'tx-1' }] };
        return { rows: [] };
      }),
    };
    await fn(client);
  });
  // pool.query() returns result.rows (an array), not the pg result object.
  mockQuery.mockResolvedValue([]);
}

function post() {
  return request(app)
    .post('/api/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', 't=1,v1=deadbeef')
    .send(Buffer.from('{}'));
}

describe('stripe checkout webhook credit gate', () => {
  it('does NOT credit when checkout.session.completed is still unpaid', async () => {
    primeOrderLookup();
    mockConstructWebhookEvent.mockReturnValue({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', payment_status: 'unpaid', metadata: { orderId: 'order-1' } } },
    });

    const res = await post();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    // No wallet credit transaction ran, no completion audit logged.
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  it('DOES credit when checkout.session.completed is paid', async () => {
    primeOrderLookup();
    mockConstructWebhookEvent.mockReturnValue({
      id: 'evt_2',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_2', payment_status: 'paid', metadata: { orderId: 'order-1' } } },
    });

    const res = await post();

    expect(res.status).toBe(200);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'CARD_PAYMENT_COMPLETED' }));
  });

  it('DOES credit on checkout.session.async_payment_succeeded', async () => {
    primeOrderLookup();
    mockConstructWebhookEvent.mockReturnValue({
      id: 'evt_3',
      type: 'checkout.session.async_payment_succeeded',
      data: { object: { id: 'cs_3', payment_status: 'paid', metadata: { orderId: 'order-1' } } },
    });

    const res = await post();

    expect(res.status).toBe(200);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'CARD_PAYMENT_COMPLETED' }));
  });

  it('marks order FAILED on checkout.session.async_payment_failed without crediting', async () => {
    primeOrderLookup();
    mockConstructWebhookEvent.mockReturnValue({
      id: 'evt_4',
      type: 'checkout.session.async_payment_failed',
      data: { object: { id: 'cs_4', metadata: { orderId: 'order-1' } } },
    });

    const res = await post();

    expect(res.status).toBe(200);
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("status = 'FAILED'"), expect.any(Array));
  });

  it('does not credit twice on a duplicate delivery (unique_violation 23505)', async () => {
    // A concurrent second delivery loses the race on the unique idempotency key.
    const dupErr = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
    primeOrderLookup({ throwOnTx: dupErr });
    mockConstructWebhookEvent.mockReturnValue({
      id: 'evt_5',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_dup', payment_status: 'paid', metadata: { orderId: 'order-1' } } },
    });

    const res = await post();

    // Treated as already-processed: 200, no completion audit, no rethrow.
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  it('credits the stored order amount, never the webhook-supplied amount', async () => {
    primeOrderLookup({ orderAmountCents: 100000 });
    mockConstructWebhookEvent.mockReturnValue({
      id: 'evt_6',
      type: 'checkout.session.completed',
      // Attacker-inflated session total must be ignored.
      data: { object: { id: 'cs_amt', payment_status: 'paid', amount_total: 999999, metadata: { orderId: 'order-1' } } },
    });

    const res = await post();

    expect(res.status).toBe(200);
    const txInsert = capturedTxQueries.find((q) => q.sql.includes('INSERT INTO transactions'));
    expect(txInsert).toBeTruthy();
    // amount_cents is the 3rd positional param and must equal the stored order.
    expect(txInsert!.params).toContain(100000);
    expect(txInsert!.params).not.toContain(999999);
  });
});
