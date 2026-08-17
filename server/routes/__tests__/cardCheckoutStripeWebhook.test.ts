/**
 * @vitest-environment node
 *
 * Production-safety tests for the Stripe checkout webhook:
 * - fiat-only credit by default (stablecoin/USDT fulfillment fail-closed)
 * - honest, non-randomized deposit labeling (no fake merchant names)
 * - amount / currency / payment_status verification before crediting
 * - strict idempotency (already-completed orders are not re-credited)
 * - stablecoin credit only when explicitly enabled
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, afterEach, beforeAll, vi, describe, it, expect } from 'vitest';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockTransaction = vi.fn();
const mockCreateAuditLog = vi.fn().mockResolvedValue(undefined);
const mockConstructWebhookEvent = vi.fn();

vi.mock('../../db/pool', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  transaction: (fn: (client: unknown) => Promise<void>) => mockTransaction(fn),
}));
vi.mock('../../services/auditService', () => ({ createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args) }));
vi.mock('../../services/stripeService', () => ({
  isStripeConfigured: () => true,
  getStripePublishableKey: () => 'pk_test_x',
  createCheckoutSession: vi.fn(),
  getCheckoutSession: vi.fn(),
  constructWebhookEvent: (...args: unknown[]) => mockConstructWebhookEvent(...args),
}));

let paymentWebhookRouter: express.Router;
let app: express.Express;

// Capture the SQL + params issued inside the DB transaction so tests can assert
// exactly what was (and was not) written.
let clientCalls: Array<{ sql: string; params: unknown[] }> = [];

function installTransactionMock() {
  mockTransaction.mockImplementation(async (fn: (client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: { id: string }[]; rowCount: number }> }) => Promise<void>) => {
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        clientCalls.push({ sql, params: params ?? [] });
        if (sql.includes('INSERT INTO transactions')) {
          return { rows: [{ id: 'tx-id-1' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
    };
    await fn(client);
  });
}

const ORDER = {
  id: 'order-1',
  user_id: 'user-1',
  target_user_id: null,
  amount_cents: 15000,
  currency: 'USD',
  merchant_name: 'Stripe Checkout',
  status: 'PENDING',
  created_by_user_id: 'user-1',
};

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cs_test_123',
    payment_status: 'paid',
    amount_total: 15000,
    currency: 'usd',
    metadata: { orderId: ORDER.id },
    ...overrides,
  };
}

function stripeEvent(session: object, type = 'checkout.session.completed') {
  return { id: 'evt_1', type, data: { object: session } };
}

beforeAll(async () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  delete process.env.ENABLE_STABLECOIN_FULFILLMENT;
  vi.resetModules();
  const cardCheckout = await import('../cardCheckout');
  paymentWebhookRouter = cardCheckout.paymentWebhookRouter;
  app = express();
  app.use((req, res, next) => {
    if (req.method === 'POST' && req.originalUrl?.split('?')[0] === '/api/webhooks/stripe') {
      return express.raw({ type: 'application/json', limit: '100kb' })(req, res, (err: Error) => {
        if (err) return next(err);
        const raw = req.body as Buffer;
        (req as express.Request & { rawBody?: Buffer }).rawBody = raw;
        (req as any).body = raw?.length ? JSON.parse(raw.toString('utf8')) : {};
        next();
      });
    }
    next();
  });
  app.use('/api/webhooks', paymentWebhookRouter);
});

beforeEach(() => {
  clientCalls = [];
  mockTransaction.mockReset();
  installTransactionMock();
  mockQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 1 });
  mockQueryOne.mockReset().mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT * FROM card_orders')) return { ...ORDER };
    return null;
  });
  mockCreateAuditLog.mockReset().mockResolvedValue(undefined);
  mockConstructWebhookEvent.mockReset();
  delete process.env.ENABLE_STABLECOIN_FULFILLMENT;
});

afterEach(() => {
  delete process.env.ENABLE_STABLECOIN_FULFILLMENT;
});

function postStripe(event: object) {
  mockConstructWebhookEvent.mockReturnValue(event);
  return request(app)
    .post('/api/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', 'sig_test')
    .send(JSON.stringify({ any: 'body' }));
}

const usdtWrites = () => clientCalls.filter(c => c.sql.includes('usdt_balance_cents') || c.sql.includes('crypto_ledger_entries'));

describe('Stripe webhook — production safety', () => {
  it('credits fiat only (no USDT) by default and labels the deposit honestly', async () => {
    const res = await postStripe(stripeEvent(makeSession()));
    expect(res.status).toBe(200);
    expect(mockTransaction).toHaveBeenCalled();

    // Fiat wallet credited
    const fiatCredit = clientCalls.find(c => c.sql.includes('INSERT INTO wallets') && !c.sql.includes('usdt_balance_cents'));
    expect(fiatCredit).toBeTruthy();

    // No stablecoin/crypto writes when disabled (fail-closed)
    expect(usdtWrites()).toHaveLength(0);

    // Honest naming: no fake merchant name; uses the fixed deposit display name
    const txInsert = clientCalls.find(c => c.sql.includes('INSERT INTO transactions'));
    expect(txInsert?.params).toContain('CardXC Wallet Deposit');
    const joined = JSON.stringify(txInsert?.params ?? []);
    expect(joined).not.toMatch(/Merchant Payment/i);

    expect(mockCreateAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'CARD_PAYMENT_COMPLETED' }));
  });

  it('does NOT credit when payment_status is not "paid"', async () => {
    const res = await postStripe(stripeEvent(makeSession({ payment_status: 'unpaid' })));
    expect(res.status).toBe(200);
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(clientCalls).toHaveLength(0);
  });

  it('fails closed and marks order FAILED on amount mismatch', async () => {
    const res = await postStripe(stripeEvent(makeSession({ amount_total: 100 })));
    expect(res.status).toBe(200);
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("status = 'FAILED'"), expect.any(Array));
    expect(mockCreateAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'CARD_PAYMENT_MISMATCH' }));
  });

  it('fails closed on currency mismatch', async () => {
    const res = await postStripe(stripeEvent(makeSession({ currency: 'eur' })));
    expect(res.status).toBe(200);
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'CARD_PAYMENT_MISMATCH' }));
  });

  it('is idempotent: an already COMPLETED order is not re-credited', async () => {
    mockQueryOne.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM card_orders')) return { ...ORDER, status: 'COMPLETED' };
      return null;
    });
    const res = await postStripe(stripeEvent(makeSession()));
    expect(res.status).toBe(200);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('credits USDT only when stablecoin fulfillment is explicitly enabled', async () => {
    process.env.ENABLE_STABLECOIN_FULFILLMENT = 'true';
    const res = await postStripe(stripeEvent(makeSession()));
    expect(res.status).toBe(200);
    expect(mockTransaction).toHaveBeenCalled();
    expect(usdtWrites().length).toBeGreaterThan(0);
  });
});
