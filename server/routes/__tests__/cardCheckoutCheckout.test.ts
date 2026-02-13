/**
 * @vitest-environment node
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, beforeAll, vi, describe, it, expect } from 'vitest';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockCreateFluzOrder = vi.fn();
const mockCreateAuditLog = vi.fn().mockResolvedValue(undefined);

vi.mock('../../db/pool', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  transaction: vi.fn(),
  isDatabaseConnectionError: () => false,
}));
vi.mock('../../services/auditService', () => ({ createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args) }));
vi.mock('../../services/fluzClient', () => ({
  isFluzConfigured: () => true,
  createFluzOrder: (...args: unknown[]) => mockCreateFluzOrder(...args),
  getFluzBaseUrl: () => 'https://test.fluz.example/runa',
  validateFluzAuthHeaderFormat: () => ({ valid: true, format: 'ok' }),
  detectFluzEnvironmentMismatch: () => {},
  testFluzConnection: () => Promise.resolve({ success: true }),
}));
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as any).user = { id: 'user-id-1', role: 'USER' };
    next();
  },
  requireSuperAdmin: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  AuthenticatedRequest: {},
}));
vi.mock('../../middleware/rateLimit', () => ({
  sensitiveOpLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

let cardCheckoutRouter: express.Router;
let app: express.Express;

beforeAll(async () => {
  vi.resetModules();
  const cardCheckout = await import('../cardCheckout');
  const errMiddleware = await import('../../middleware/errorHandler');
  cardCheckoutRouter = cardCheckout.cardCheckoutRouter;
  app = express();
  app.use(express.json());
  app.use('/api/checkout', cardCheckoutRouter);
  app.use(errMiddleware.errorHandler);
});

beforeEach(() => {
  mockQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 1 });
  mockQueryOne.mockReset();
  mockCreateFluzOrder.mockReset();
  mockCreateAuditLog.mockReset();
});

describe('POST /api/checkout/card', () => {
  it('returns 201 and checkoutUrl when Fluz order is created', async () => {
    const orderId = 'order-uuid-123';
    mockQueryOne
      .mockResolvedValueOnce({ email_verified: true, kyc_status: 'pending' })
      .mockResolvedValueOnce({ id: orderId })
      .mockResolvedValue({ rows: [], rowCount: 1 });
    mockCreateFluzOrder.mockResolvedValue({
      id: 'fluz-ord-1',
      status: 'IN_PROGRESS',
      items: [{ payout_link: 'https://pay.example/checkout' }],
    });

    const res = await request(app)
      .post('/api/checkout/card')
      .set('Content-Type', 'application/json')
      .send({
        amount: 100,
        currency: 'USD',
        merchantName: 'Test Merchant',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.checkoutUrl).toBe('https://pay.example/checkout');

    expect(mockQueryOne).toHaveBeenCalledWith(
      expect.stringContaining('SELECT email_verified, kyc_status'),
      ['user-id-1']
    );
    expect(mockQueryOne).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO card_orders'),
      expect.arrayContaining(['user-id-1', 'user-id-1', 'user-id-1', 10000, 'USD', 'Test Merchant'])
    );
    expect(mockCreateFluzOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_method: { type: 'ACCOUNT_BALANCE', currency: 'USD' },
        items: expect.arrayContaining([
          expect.objectContaining({
            face_value: 100,
            external_ref: orderId,
            products: { type: 'SINGLE', value: '1800FL-US' },
          }),
        ]),
      }),
      orderId
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE card_orders'),
      expect.arrayContaining(['fluz-ord-1', 'https://pay.example/checkout', orderId])
    );
  });

  it('returns 403 EMAIL_VERIFICATION_REQUIRED when user email is not verified', async () => {
    mockQueryOne.mockResolvedValueOnce({ email_verified: false, kyc_status: 'pending' });

    const res = await request(app)
      .post('/api/checkout/card')
      .set('Content-Type', 'application/json')
      .send({
        amount: 100,
        currency: 'USD',
        merchantName: 'Test Merchant',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error?.code).toBe('EMAIL_VERIFICATION_REQUIRED');
    expect(res.body.error?.message).toMatch(/verify your email/i);
    expect(mockCreateFluzOrder).not.toHaveBeenCalled();
  });
});
