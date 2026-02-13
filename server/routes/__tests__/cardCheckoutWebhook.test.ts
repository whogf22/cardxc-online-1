/**
 * @vitest-environment node
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, afterEach, beforeAll, vi, describe, it, expect } from 'vitest';
import crypto from 'crypto';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockTransaction = vi.fn();
const mockCreateAuditLog = vi.fn().mockResolvedValue(undefined);

vi.mock('../../db/pool', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  transaction: (fn: (client: { query: typeof mockQuery }) => Promise<void>) => mockTransaction(fn),
}));
vi.mock('../../services/auditService', () => ({ createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args) }));

let paymentWebhookRouter: express.Router;
let app: express.Express;

function signPayload(payload: object, secret: string): string {
  const body = JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

beforeAll(async () => {
  process.env.FLUZ_WEBHOOK_SECRET = 'test-webhook-secret';
  vi.resetModules();
  const cardCheckout = await import('../cardCheckout');
  paymentWebhookRouter = cardCheckout.paymentWebhookRouter;
  app = express();
  app.use((req, res, next) => {
    if (req.method === 'POST' && req.originalUrl?.split('?')[0] === '/api/webhooks/payment') {
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

afterEach(() => {
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockTransaction.mockReset();
  mockCreateAuditLog.mockReset();
});

describe('payment webhook', () => {
  const orderId = 'order-uuid-123';
  const paymentId = 'pay-fluz-456';
  const basePayload = { event: 'payment.completed', paymentId, status: 'completed' };

  beforeEach(() => {
    mockQueryOne.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('INSERT INTO payment_webhook_logs')) return { id: 'log-id-1' };
      if (sql.includes('SELECT id FROM payment_webhook_logs') && params[2] === paymentId) return null;
      if (sql.includes('SELECT * FROM card_orders')) return { id: orderId, user_id: 'user-1', target_user_id: null, amount_cents: 1000, currency: 'USD', merchant_name: 'Test', status: 'PENDING' };
      return null;
    });
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    mockTransaction.mockImplementation(async (fn: (client: { query: (a: string, b?: unknown[]) => Promise<{ rows: { id: string }[] }> }) => Promise<void>) => {
      const client = {
        query: vi.fn().mockResolvedValueOnce({ rows: [{ id: 'tx-id-1' }] }).mockResolvedValue({ rows: [], rowCount: 1 }),
      };
      await fn(client);
    });
  });

  it('returns 200 Already processed when same paymentId+event already processed (early skip, no log)', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'existing-log' }); // early idempotency: already processed
    const body = JSON.stringify(basePayload);
    const sig = signPayload(basePayload, 'test-webhook-secret');
    const res = await request(app)
      .post('/api/webhooks/payment')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sig)
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Already processed');
    expect(mockQueryOne).toHaveBeenCalledTimes(1); // no INSERT
  });

  it('returns 401 when signature missing and FLUZ_WEBHOOK_SECRET set', async () => {
    // First call: early idempotency (null); second: INSERT returns log id — then signature check runs
    mockQueryOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'log-1' });
    const res = await request(app)
      .post('/api/webhooks/payment')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(basePayload));
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Missing signature');
  });

  it('returns 401 when signature invalid', async () => {
    mockQueryOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'log-1' });
    const body = JSON.stringify(basePayload);
    const res = await request(app)
      .post('/api/webhooks/payment')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', 'invalid-sig')
      .send(body);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid signature');
  });

  it('returns 400 when paymentId missing', async () => {
    const payload = { event: 'payment.completed', status: 'completed' };
    const body = JSON.stringify(payload);
    const sig = signPayload(payload, 'test-webhook-secret');
    mockQueryOne.mockResolvedValueOnce({ id: 'log-1' });
    const res = await request(app)
      .post('/api/webhooks/payment')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sig)
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing paymentId');
  });

  it('returns 404 when order not found', async () => {
    mockQueryOne
      .mockResolvedValueOnce(null)   // early idempotency
      .mockResolvedValueOnce({ id: 'log-1' })  // INSERT
      .mockResolvedValueOnce(null)   // alreadyProcessed (same paymentId+event)
      .mockResolvedValueOnce(null);  // order not found
    const body = JSON.stringify(basePayload);
    const sig = signPayload(basePayload, 'test-webhook-secret');
    const res = await request(app)
      .post('/api/webhooks/payment')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sig)
      .send(body);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Order not found');
  });

  it('returns 200 Already processed when order already COMPLETED', async () => {
    mockQueryOne
      .mockResolvedValueOnce(null)   // early idempotency
      .mockResolvedValueOnce({ id: 'log-1' })  // INSERT
      .mockResolvedValueOnce(null)   // alreadyProcessed
      .mockResolvedValueOnce({ id: orderId, status: 'COMPLETED', user_id: 'user-1', target_user_id: null, amount_cents: 1000, currency: 'USD', merchant_name: 'Test' });
    const body = JSON.stringify(basePayload);
    const sig = signPayload(basePayload, 'test-webhook-secret');
    const res = await request(app)
      .post('/api/webhooks/payment')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sig)
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Already processed');
  });

  it('credits wallet and marks COMPLETED for payment.completed', async () => {
    const body = JSON.stringify(basePayload);
    const sig = signPayload(basePayload, 'test-webhook-secret');
    const res = await request(app)
      .post('/api/webhooks/payment')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sig)
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockTransaction).toHaveBeenCalled();
    expect(mockCreateAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'CARD_PAYMENT_COMPLETED' }));
  });

  it('marks order FAILED for payment.failed', async () => {
    const payload = { event: 'payment.failed', paymentId, status: 'failed' };
    const body = JSON.stringify(payload);
    const sig = signPayload(payload, 'test-webhook-secret');
    const res = await request(app)
      .post('/api/webhooks/payment')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sig)
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('FAILED'), expect.any(Array));
  });

  it('marks order EXPIRED for payment.expired', async () => {
    const payload = { event: 'payment.expired', paymentId, status: 'expired' };
    const body = JSON.stringify(payload);
    const sig = signPayload(payload, 'test-webhook-secret');
    const res = await request(app)
      .post('/api/webhooks/payment')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sig)
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('EXPIRED'), expect.any(Array));
  });
});
