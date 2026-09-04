/**
 * @vitest-environment node
 *
 * KYC admin route authorization and source-of-truth tests.
 *
 * Invariant: KYC approval must only originate from verified Sumsub webhooks.
 * Admin routes may reject/expire/reset KYC, but they must never set it to
 * 'approved', even when called by a SUPER_ADMIN.
 */
import express from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { errorHandler } from '../../middleware/errorHandler';

let currentRole: 'USER' | 'SUPER_ADMIN' = 'SUPER_ADMIN';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockCreateAuditLog = vi.fn().mockResolvedValue(undefined);

vi.mock('../../middleware/auth', async () => {
  const actual = await vi.importActual<typeof import('../../middleware/auth')>('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: express.Request & { user?: unknown }, _res: express.Response, next: express.NextFunction) => {
      (req as express.Request & { user: unknown }).user = {
        id: 'admin-1',
        email: 'admin@test.com',
        role: currentRole,
      };
      next();
    },
  };
});

vi.mock('../../db/pool', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  transaction: (fn: (client: { query: typeof mockQuery }) => Promise<unknown>) => fn({ query: mockQuery }),
  isDatabaseConnectionError: () => false,
}));

vi.mock('../../services/auditService', () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
  getAuditLogs: () => Promise.resolve([]),
  exportAuditLogsToCSV: () => Promise.resolve(''),
}));

vi.mock('../../middleware/rateLimit', () => ({
  getRateLimitViolations: () => Promise.resolve([]),
  clearRateLimitViolations: () => Promise.resolve(0),
}));

vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../middleware/securityLogger', () => ({
  getSecurityEvents: () => Promise.resolve([]),
  getSecurityEventsByType: () => Promise.resolve([]),
  getSecurityEventsByIP: () => Promise.resolve([]),
}));

vi.mock('../../services/fraudService', () => ({
  runFraudChecks: () => Promise.resolve({ passed: true, flags: [], score: 0 }),
  getFraudFlags: () => Promise.resolve([]),
  getUserTransactionLimits: () => Promise.resolve({}),
  clearFraudFlag: () => Promise.resolve(true),
  checkLoginVelocity: () => Promise.resolve({ allowed: true }),
}));

vi.mock('../../services/stripeService', () => ({
  isStripeConfigured: () => false,
  createPaymentIntent: () => Promise.resolve({ client_secret: '' }),
  confirmPaymentIntent: () => Promise.resolve({}),
  getPaymentIntent: () => Promise.resolve({}),
  createCheckoutSession: () => Promise.resolve({}),
  getCheckoutSession: () => Promise.resolve({}),
  constructWebhookEvent: () => ({ type: '' }),
  getStripePublishableKey: () => undefined,
}));

vi.mock('../../services/fluzClient', () => ({
  isFluzConfigured: () => false,
  getFluzBaseUrl: () => '',
  validateFluzAuthHeaderFormat: () => ({ valid: true, format: 'basic' }),
  detectFluzEnvironmentMismatch: () => {},
  getFluzBalance: () => Promise.resolve({ balance_cents: 0 }),
  createFluzOrder: () => Promise.resolve({}),
  getFluzProducts: () => Promise.resolve({ items: [], total: 0 }),
  getFluzProductDetails: () => Promise.resolve({}),
  testFluzConnection: () => Promise.resolve({ success: true }),
}));

let app: express.Express;

beforeAll(async () => {
  vi.resetModules();
  const { adminRouter } = await import('../admin');

  app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);
  app.use(errorHandler);
});

beforeEach(() => {
  currentRole = 'SUPER_ADMIN';
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockCreateAuditLog.mockReset();
});

describe('Admin KYC status route', () => {
  it('rejects SUPER_ADMIN setting status to approved', async () => {
    mockQueryOne.mockResolvedValue({ kyc_status: 'pending', kyc_provider: 'sumsub' });
    mockQuery.mockResolvedValue([]);

    const res = await request(app)
      .put('/api/admin/users/user-1/kyc-status')
      .send({ status: 'approved' });

    expect(res.status).toBe(403);
    expect(res.body?.error?.code).toBe('KYC_APPROVE_FORBIDDEN');
  });

  it('allows SUPER_ADMIN to reject a user', async () => {
    mockQueryOne.mockResolvedValue({ kyc_status: 'pending', kyc_provider: 'sumsub' });
    mockQuery.mockResolvedValue([]);

    const res = await request(app)
      .put('/api/admin/users/user-1/kyc-status')
      .send({ status: 'rejected', reason: 'Manual review' });

    expect(res.status).toBe(200);

    const updateCall = mockQuery.mock.calls.find((call) =>
      (call[0] as string).includes('UPDATE users')
    );
    expect(updateCall).toBeTruthy();
    expect(updateCall[1]).toEqual(expect.arrayContaining(['rejected']));
  });

  it('forbids non-admin users from calling the route', async () => {
    currentRole = 'USER';

    const res = await request(app)
      .put('/api/admin/users/user-1/kyc-status')
      .send({ status: 'rejected' });

    expect(res.status).toBe(403);
  });
});
