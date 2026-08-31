/**
 * @vitest-environment node
 *
 * Regression: the provider (Fluz) payment webhook must FAIL CLOSED when no
 * FLUZ_WEBHOOK_SECRET is configured — an unauthenticated event must never be
 * processed (which would credit wallets on a forged event).
 */
import express from 'express';
import request from 'supertest';
import { beforeAll, vi, describe, it, expect } from 'vitest';

const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
const mockQueryOne = vi.fn().mockResolvedValue(null);
const mockTransaction = vi.fn();

vi.mock('../../db/pool', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  transaction: (fn: (c: unknown) => Promise<unknown>) => mockTransaction(fn),
}));
vi.mock('../../services/auditService', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

let app: express.Express;

beforeAll(async () => {
  delete process.env.FLUZ_WEBHOOK_SECRET; // ensure fail-closed path
  vi.resetModules();
  const cardCheckout = await import('../cardCheckout');
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
  app.use('/api/webhooks', cardCheckout.paymentWebhookRouter);
});

describe('provider webhook — fail closed without secret', () => {
  it('returns 503 and does not process when FLUZ_WEBHOOK_SECRET is unset', async () => {
    const res = await request(app)
      .post('/api/webhooks/payment')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ event: 'payment.completed', paymentId: 'pay-1', status: 'completed' }));

    expect(res.status).toBe(503);
    expect(mockTransaction).not.toHaveBeenCalled();
    // No webhook log row should be inserted before the secret check
    expect(mockQuery).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO payment_webhook_logs'), expect.anything());
  });
});
