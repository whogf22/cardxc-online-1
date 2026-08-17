/**
 * @vitest-environment node
 *
 * Verifies KYC is mandatory for Stripe checkout in production (and remains
 * optional outside production unless opted in).
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, afterEach, beforeAll, vi, describe, it, expect } from 'vitest';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockCreateAuditLog = vi.fn().mockResolvedValue(undefined);
const mockCreateCheckoutSession = vi.fn();

vi.mock('../../db/pool', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  transaction: vi.fn(),
  isDatabaseConnectionError: () => false,
}));
vi.mock('../../services/auditService', () => ({ createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args) }));
vi.mock('../../services/stripeService', () => ({
  isStripeConfigured: () => true,
  getStripePublishableKey: () => 'pk_test_x',
  createCheckoutSession: (...args: unknown[]) => mockCreateCheckoutSession(...args),
  getCheckoutSession: vi.fn(),
  constructWebhookEvent: vi.fn(),
}));
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as any).user = { id: 'user-1', role: 'USER' };
    next();
  },
  requireSuperAdmin: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  AuthenticatedRequest: {},
}));
vi.mock('../../middleware/rateLimit', () => ({
  sensitiveOpLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

let app: express.Express;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

beforeAll(async () => {
  vi.resetModules();
  const cardCheckout = await import('../cardCheckout');
  const errMiddleware = await import('../../middleware/errorHandler');
  app = express();
  app.use(express.json());
  app.use('/api/checkout', cardCheckout.cardCheckoutRouter);
  app.use(errMiddleware.errorHandler);
});

beforeEach(() => {
  mockQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 1 });
  mockQueryOne.mockReset();
  mockCreateAuditLog.mockReset().mockResolvedValue(undefined);
  mockCreateCheckoutSession.mockReset().mockResolvedValue({ clientSecret: 'cs_secret', sessionId: 'cs_test_1' });
});

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  delete process.env.REQUIRE_KYC_FOR_CARD_CHECKOUT;
});

function postSession() {
  return request(app)
    .post('/api/checkout/stripe-session')
    .set('Content-Type', 'application/json')
    .send({ amount: 150, currency: 'USD' });
}

describe('POST /api/checkout/stripe-session — KYC gating', () => {
  it('blocks checkout in production when KYC is not approved', async () => {
    process.env.NODE_ENV = 'production';
    mockQueryOne.mockResolvedValueOnce({ email_verified: true, kyc_status: 'pending', email: 'u@x.com' });

    const res = await postSession();

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('KYC_REQUIRED');
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
  });

  it('allows checkout in production when KYC is approved', async () => {
    process.env.NODE_ENV = 'production';
    mockQueryOne
      .mockResolvedValueOnce({ email_verified: true, kyc_status: 'approved', email: 'u@x.com' })
      .mockResolvedValueOnce({ id: 'order-1' });

    const res = await postSession();

    expect(res.status).toBe(201);
    expect(mockCreateCheckoutSession).toHaveBeenCalled();
  });

  it('does not require KYC outside production by default', async () => {
    process.env.NODE_ENV = 'development';
    mockQueryOne
      .mockResolvedValueOnce({ email_verified: true, kyc_status: 'pending', email: 'u@x.com' })
      .mockResolvedValueOnce({ id: 'order-1' });

    const res = await postSession();

    expect(res.status).toBe(201);
    expect(mockCreateCheckoutSession).toHaveBeenCalled();
  });
});
