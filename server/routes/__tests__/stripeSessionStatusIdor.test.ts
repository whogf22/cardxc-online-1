/**
 * @vitest-environment node
 *
 * Regression: GET /api/checkout/stripe-session/:sessionId/status must enforce
 * order ownership (no IDOR). A user may only read the status of a session tied
 * to one of their own orders.
 */
import express from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, vi, describe, it, expect } from 'vitest';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockGetCheckoutSession = vi.fn();

vi.mock('../../db/pool', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  transaction: vi.fn(),
  isDatabaseConnectionError: () => false,
}));
vi.mock('../../services/auditService', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../services/stripeService', () => ({
  isStripeConfigured: () => true,
  getStripePublishableKey: () => 'pk_test_x',
  createCheckoutSession: vi.fn(),
  getCheckoutSession: (...a: unknown[]) => mockGetCheckoutSession(...a),
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
  mockGetCheckoutSession.mockReset().mockResolvedValue({ status: 'complete', payment_status: 'paid' });
});

describe('GET /api/checkout/stripe-session/:sessionId/status — ownership', () => {
  it('returns 404 when the session belongs to another user (no IDOR leak)', async () => {
    mockQueryOne.mockResolvedValueOnce({ user_id: 'someone-else', target_user_id: null, created_by_user_id: 'someone-else' });
    const res = await request(app).get('/api/checkout/stripe-session/cs_test_1/status');
    expect(res.status).toBe(404);
    expect(mockGetCheckoutSession).not.toHaveBeenCalled();
  });

  it('returns 404 when no order matches the session id', async () => {
    mockQueryOne.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/checkout/stripe-session/cs_unknown/status');
    expect(res.status).toBe(404);
    expect(mockGetCheckoutSession).not.toHaveBeenCalled();
  });

  it('returns 200 for the owner', async () => {
    mockQueryOne.mockResolvedValueOnce({ user_id: 'user-1', target_user_id: null, created_by_user_id: 'user-1' });
    const res = await request(app).get('/api/checkout/stripe-session/cs_test_1/status');
    expect(res.status).toBe(200);
    expect(res.body.data.paymentStatus).toBe('paid');
    expect(mockGetCheckoutSession).toHaveBeenCalledWith('cs_test_1');
  });
});
