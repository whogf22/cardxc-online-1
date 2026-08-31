/**
 * @vitest-environment node
 *
 * Provider webhook: AUTHENTICATE BEFORE TRUSTED PERSISTENCE.
 *
 * The handler used to INSERT the attacker-controlled payload into
 * `payment_webhook_logs` — a trusted table — and answer the idempotency lookup
 * ("Already processed") BEFORE verifying the HMAC. That gave an unauthenticated
 * caller two things it should never have: a write into trusted storage, and an
 * oracle for whether a given paymentId had already been handled.
 *
 * Signature verification now runs first. Replay/idempotency protection is
 * unchanged for authenticated callers.
 */
import express from 'express';
import request from 'supertest';
import crypto from 'crypto';
import { beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';

const SECRET = 'test-provider-webhook-secret-value';

const sqlLog: Array<{ sql: string; params: unknown[] }> = [];
/** Rows the idempotency lookup should pretend already exist. */
let alreadyProcessed = false;

vi.mock('../../db/pool', () => ({
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    sqlLog.push({ sql, params });
    return [];
  }),
  queryOne: vi.fn(async (sql: string, params: unknown[] = []) => {
    sqlLog.push({ sql, params });
    if (/SELECT id FROM payment_webhook_logs/i.test(sql)) {
      return alreadyProcessed ? { id: 'existing-log' } : null;
    }
    if (/INSERT INTO payment_webhook_logs/i.test(sql)) return { id: 'log-1' };
    return null;
  }),
  transaction: vi.fn(async (cb: any) => cb({ query: vi.fn(async () => ({ rows: [] })) })),
  isDatabaseConnectionError: () => false,
}));
vi.mock('../../services/auditService', () => ({ createAuditLog: vi.fn() }));
vi.mock('../../middleware/rateLimit', () => ({
  webhookLimiter: (_r: any, _s: any, n: any) => n(),
  sensitiveOpLimiter: (_r: any, _s: any, n: any) => n(),
  apiLimiter: (_r: any, _s: any, n: any) => n(),
  financialOpLimiter: (_r: any, _s: any, n: any) => n(),
  authLimiter: (_r: any, _s: any, n: any) => n(),
  aiLimiter: (_r: any, _s: any, n: any) => n(),
}));
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => { req.user = { id: 'u1', role: 'USER' }; next(); },
  requireSuperAdmin: (_r: any, _s: any, n: any) => n(),
  requireAdmin: (_r: any, _s: any, n: any) => n(),
  requireRole: () => (_r: any, _s: any, n: any) => n(),
  AuthenticatedRequest: {},
}));

process.env.FLUZ_WEBHOOK_SECRET = SECRET;

let app: express.Express;

beforeAll(async () => {
  vi.resetModules();
  const cc = await import('../cardCheckout');
  const err = await import('../../middleware/errorHandler');
  app = express();
  // Mirror production: raw body captured for signature verification.
  app.use('/api/webhooks', express.raw({ type: 'application/json' }), (req: any, _res, next) => {
    req.rawBody = req.body;
    try { req.body = JSON.parse(req.body.toString('utf8')); } catch { req.body = {}; }
    next();
  });
  app.use('/api/webhooks', (cc as any).paymentWebhookRouter ?? (cc as any).webhookRouter);
  app.use(err.errorHandler);
});

beforeEach(() => {
  sqlLog.length = 0;
  alreadyProcessed = false;
});

function sign(body: string) {
  return crypto.createHmac('sha256', SECRET).update(body).digest('hex');
}

function post(body: unknown, signature?: string) {
  const raw = JSON.stringify(body);
  const r = request(app)
    .post('/api/webhooks/payment')
    .set('Content-Type', 'application/json');
  if (signature !== undefined) r.set('x-webhook-signature', signature);
  return r.send(raw);
}

/** Any write into the trusted webhook-log table. */
function trustedWrites() {
  return sqlLog.filter((c) => /INSERT INTO payment_webhook_logs/i.test(c.sql));
}
/** The idempotency existence probe. */
function idempotencyProbes() {
  return sqlLog.filter((c) => /SELECT id FROM payment_webhook_logs/i.test(c.sql));
}

describe('unauthenticated requests never touch trusted storage', () => {
  it('rejects a missing signature and writes nothing', async () => {
    const res = await post({ event: 'payment.completed', paymentId: 'p-1' });
    expect(res.status).toBe(401);
    expect(trustedWrites()).toHaveLength(0);
  });

  it('rejects an invalid signature and writes nothing', async () => {
    const res = await post({ event: 'payment.completed', paymentId: 'p-1' }, 'deadbeef');
    expect(res.status).toBe(401);
    expect(trustedWrites()).toHaveLength(0);
  });

  it('does not answer the idempotency probe before authenticating', async () => {
    // The probe is the paymentId oracle. It must not run for an unsigned caller.
    await post({ event: 'payment.completed', paymentId: 'p-known' }, 'deadbeef');
    expect(idempotencyProbes()).toHaveLength(0);
  });

  it('does NOT leak whether a paymentId is already processed', async () => {
    alreadyProcessed = true;
    const known = await post({ event: 'payment.completed', paymentId: 'p-known' }, 'bad');
    alreadyProcessed = false;
    const unknown = await post({ event: 'payment.completed', paymentId: 'p-unknown' }, 'bad');

    // Identical outcome regardless of what we already hold.
    expect(known.status).toBe(unknown.status);
    expect(JSON.stringify(known.body)).toBe(JSON.stringify(unknown.body));
  });

  it('rejects a malformed body', async () => {
    const raw = '[]'; // array, not an event object
    const res = await request(app)
      .post('/api/webhooks/payment')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sign(raw))
      .send(raw);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(trustedWrites()).toHaveLength(0);
  });
});

describe('authenticated requests proceed normally', () => {
  it('accepts a valid signature and records the event', async () => {
    const body = { event: 'payment.completed', paymentId: 'p-ok' };
    const raw = JSON.stringify(body);
    const res = await request(app)
      .post('/api/webhooks/payment')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sign(raw))
      .send(raw);

    expect(res.status).toBeLessThan(500);
    // A trusted write happens only on the authenticated path.
    expect(trustedWrites().length).toBeGreaterThan(0);
  });

  it('preserves replay/idempotency for an authenticated caller', async () => {
    alreadyProcessed = true;
    const body = { event: 'payment.completed', paymentId: 'p-dup' };
    const raw = JSON.stringify(body);
    const res = await request(app)
      .post('/api/webhooks/payment')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sign(raw))
      .send(raw);

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toMatch(/Already processed/i);
    // Idempotent replay must not insert a duplicate trusted row.
    expect(trustedWrites()).toHaveLength(0);
    expect(idempotencyProbes().length).toBeGreaterThan(0);
  });
});
