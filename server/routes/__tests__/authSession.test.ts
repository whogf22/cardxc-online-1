/**
 * @vitest-environment node
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeAll, beforeEach, vi, describe, it, expect } from 'vitest';

const mockQueryOne = vi.fn();

vi.mock('../../db/pool', () => ({
  query: vi.fn(),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  transaction: (fn: (client: { query: typeof vi.fn }) => Promise<unknown>) => fn({ query: vi.fn() }),
  isDatabaseConnectionError: () => false,
}));

vi.mock('../../services/auditService', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

let app: express.Express;

function createToken(userId: string, sessionId: string) {
  return jwt.sign({ userId, sessionId }, process.env.JWT_SECRET as string, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests-only-must-be-very-long';
  vi.resetModules();
  const { authRouter } = await import('../auth');

  app = express();
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
});

beforeEach(() => {
  mockQueryOne.mockReset();
});

describe('auth session endpoint', () => {
  it('returns has_sumsub_applicant=true without exposing sumsub_applicant_id', async () => {
    const token = createToken('user-1', 'session-1');

    mockQueryOne
      .mockResolvedValueOnce({ id: 'session-1' }) // session lookup
      .mockResolvedValueOnce({
        id: 'user-1',
        email: 'user@example.com',
        full_name: 'User',
        role: 'USER',
        kyc_status: 'not_started',
        kyc_rejection_reason: null,
        account_status: 'active',
        sumsub_applicant_id: 'app-abc',
      });

    const res = await request(app)
      .get('/api/auth/session')
      .set('Cookie', [`auth_token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      full_name: 'User',
      role: 'USER',
      kyc_status: 'not_started',
      kyc_rejection_type: null,
      account_status: 'active',
      has_sumsub_applicant: true,
    });
    expect(res.body.data.user).not.toHaveProperty('sumsub_applicant_id');
  });

  it('returns has_sumsub_applicant=false when the user has no applicant mapping', async () => {
    const token = createToken('user-2', 'session-2');

    mockQueryOne
      .mockResolvedValueOnce({ id: 'session-2' })
      .mockResolvedValueOnce({
        id: 'user-2',
        email: 'user2@example.com',
        full_name: 'User Two',
        role: 'USER',
        kyc_status: 'not_started',
        kyc_rejection_reason: null,
        account_status: 'active',
        sumsub_applicant_id: null,
      });

    const res = await request(app)
      .get('/api/auth/session')
      .set('Cookie', [`auth_token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.data.user.has_sumsub_applicant).toBe(false);
    expect(res.body.data.user).not.toHaveProperty('sumsub_applicant_id');
  });
});
