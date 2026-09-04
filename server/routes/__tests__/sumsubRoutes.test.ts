/**
 * @vitest-environment node
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { beforeAll, beforeEach, vi, describe, it, expect } from 'vitest';
import { AppError, errorHandler } from '../../middleware/errorHandler';

let currentUser: { id: string; email: string; role: string } | null = null;
let mockUserRecord: Record<string, unknown> | null = null;

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockCreateAuditLog = vi.fn().mockResolvedValue(undefined);

vi.mock('../../middleware/auth', async () => {
  const actual = await vi.importActual<typeof import('../../middleware/auth')>('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: express.Request & { user?: unknown }, _res: express.Response, next: express.NextFunction) => {
      if (!currentUser) {
        return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
      }
      (req as express.Request & { user: unknown }).user = currentUser;
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
}));

vi.mock('../../services/sumsubService', () => ({
  isEnabled: () => true,
  isConfigured: () => true,
  getOrCreateApplicant: vi.fn().mockResolvedValue({ id: 'app-1', inspectionId: 'insp-1' }),
  generateAccessToken: vi.fn().mockResolvedValue({ token: 'sdk-token-1', userId: 'user-1' }),
  verifyWebhookSignature: vi.fn(),
  mapSumsubStatus: vi.fn(),
}));

vi.mock('../../middleware/rateLimit', () => ({
  sensitiveOpLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  apiLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

let app: express.Express;

beforeAll(async () => {
  process.env.SUMSUB_ENABLED = 'true';
  process.env.SUMSUB_APP_TOKEN = 'test';
  process.env.SUMSUB_SECRET_KEY = 'test';
  process.env.SUMSUB_LEVEL_NAME = 'basic-kyc-level';
  process.env.SUMSUB_WEBHOOK_SECRET = 'test-webhook-secret';

  vi.resetModules();
  const { sumsubRouter } = await import('../sumsub');

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/user', sumsubRouter);
  app.use(errorHandler);
});

beforeEach(() => {
  currentUser = { id: 'user-1', email: 'user@test.com', role: 'USER' };
  mockUserRecord = {
    id: 'user-1',
    email: 'user@test.com',
    phone: null,
    kyc_status: 'not_started',
    kyc_rejection_reason: null,
    sumsub_applicant_id: null,
    sumsub_inspection_id: null,
  };
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockQueryOne.mockResolvedValue(mockUserRecord);
  mockCreateAuditLog.mockReset();
});

describe('sumsub user routes', () => {
  it('GET /api/user/kyc/config returns config when enabled', async () => {
    const res = await request(app).get('/api/user/kyc/config');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      enabled: true,
      levelName: 'basic-kyc-level',
      manualFallback: true,
    });
  });

  it('POST /api/user/kyc/token requires authentication', async () => {
    currentUser = null;
    const res = await request(app).post('/api/user/kyc/token');
    expect(res.status).toBe(401);
  });

  it('POST /api/user/kyc/token returns a token for an eligible user', async () => {
    mockUserRecord = {
      id: 'user-1',
      email: 'user@test.com',
      phone: null,
      kyc_status: 'not_started',
      kyc_rejection_reason: null,
      sumsub_applicant_id: null,
      sumsub_inspection_id: null,
    };
    mockQueryOne.mockResolvedValue(mockUserRecord);

    const res = await request(app).post('/api/user/kyc/token');
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBe('sdk-token-1');
  });

  it('POST /api/user/kyc/token rejects FINAL rejections', async () => {
    mockUserRecord = {
      id: 'user-1',
      email: 'user@test.com',
      phone: null,
      kyc_status: 'rejected',
      kyc_rejection_reason: 'FINAL: GRAPHIC_EDITOR, FORGERY',
      sumsub_applicant_id: 'app-1',
      sumsub_inspection_id: 'insp-1',
    };
    mockQueryOne.mockResolvedValue(mockUserRecord);

    const res = await request(app).post('/api/user/kyc/token');
    expect(res.status).toBe(403);
    expect(res.body?.error?.code).toBe('KYC_FINAL_REJECTION');
  });

  it('POST /api/user/kyc/token does not move a fresh user to pending when storing the applicant mapping', async () => {
    mockUserRecord = {
      id: 'user-1',
      email: 'user@test.com',
      phone: null,
      kyc_status: 'not_started',
      kyc_rejection_reason: null,
      sumsub_applicant_id: null,
      sumsub_inspection_id: null,
    };
    mockQueryOne.mockResolvedValue(mockUserRecord);

    const res = await request(app).post('/api/user/kyc/token');
    expect(res.status).toBe(200);

    const updateCalls = mockQuery.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('UPDATE users')
    );
    expect(updateCalls).toHaveLength(1);
    const [updateSql] = updateCalls[0];
    expect(updateSql).not.toMatch(/kyc_status/);
    expect(updateSql).toMatch(/sumsub_applicant_id\s*=\s*\$1/);
  });

  it('POST /api/user/kyc/token allows RETRY rejections to request a new token', async () => {
    mockUserRecord = {
      id: 'user-1',
      email: 'user@test.com',
      phone: null,
      kyc_status: 'rejected',
      kyc_rejection_reason: 'RETRY: GRAPHIC_EDITOR',
      sumsub_applicant_id: 'app-1',
      sumsub_inspection_id: 'insp-1',
    };
    mockQueryOne.mockResolvedValue(mockUserRecord);

    const res = await request(app).post('/api/user/kyc/token');
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBe('sdk-token-1');
  });
});
