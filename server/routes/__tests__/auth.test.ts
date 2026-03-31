/**
 * @vitest-environment node
 */
import express from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, vi, describe, it, expect } from 'vitest';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockClient = { query: vi.fn() };
const mockTransaction = vi.fn(async (cb: any) => cb(mockClient));
const mockCreateAuditLog = vi.fn().mockResolvedValue(undefined);
const mockCheckLoginVelocity = vi.fn().mockResolvedValue({ allowed: true });
const mockRunFraudChecks = vi.fn().mockResolvedValue(undefined);
const mockSendWelcomeEmail = vi.fn().mockResolvedValue(undefined);
const mockSendPasswordResetEmail = vi.fn().mockResolvedValue(undefined);
const mockRecordFailedAttempt = vi.fn();
const mockClearFailedAttempts = vi.fn();
const mockLogSecurityEvent = vi.fn();
const mockBcryptHash = vi.fn();
const mockBcryptCompare = vi.fn();
const mockJwtSign = vi.fn().mockReturnValue('mock-jwt-token');
const mockJwtVerify = vi.fn();
const mockUuidV4 = vi.fn().mockReturnValue('mock-uuid-1234');

vi.mock('../../db/pool', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  transaction: (...args: unknown[]) => mockTransaction(...args),
  isDatabaseConnectionError: () => false,
}));

vi.mock('../../middleware/auth', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as any).user = { id: 'user-id-1', role: 'USER', sessionId: 'session-1' };
    next();
  },
  AuthenticatedRequest: {},
}));

vi.mock('../../middleware/rateLimit', () => ({
  authLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  passwordResetLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../services/auditService', () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

vi.mock('../../services/fraudService', () => ({
  checkLoginVelocity: (...args: unknown[]) => mockCheckLoginVelocity(...args),
  runFraudChecks: (...args: unknown[]) => mockRunFraudChecks(...args),
}));

vi.mock('../../services/twoFactorService', () => ({
  generateTwoFactorSecret: vi.fn().mockResolvedValue({ secret: 's', qrCode: 'qr', otpauthUrl: 'url' }),
  verifyAndEnableTwoFactor: vi.fn().mockResolvedValue(true),
  verifyTwoFactorToken: vi.fn().mockResolvedValue(true),
  disableTwoFactor: vi.fn().mockResolvedValue(undefined),
  isTwoFactorEnabled: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../services/emailService', () => ({
  sendWelcomeEmail: (...args: unknown[]) => mockSendWelcomeEmail(...args),
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
}));

vi.mock('../../middleware/security', () => ({
  recordFailedAttempt: (...args: unknown[]) => mockRecordFailedAttempt(...args),
  clearFailedAttempts: (...args: unknown[]) => mockClearFailedAttempts(...args),
}));

vi.mock('../../middleware/securityLogger', () => ({
  logSecurityEvent: (...args: unknown[]) => mockLogSecurityEvent(...args),
}));

vi.mock('../../middleware/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: (...args: unknown[]) => mockBcryptHash(...args),
    compare: (...args: unknown[]) => mockBcryptCompare(...args),
  },
  hash: (...args: unknown[]) => mockBcryptHash(...args),
  compare: (...args: unknown[]) => mockBcryptCompare(...args),
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: (...args: unknown[]) => mockJwtSign(...args),
    verify: (...args: unknown[]) => mockJwtVerify(...args),
  },
  sign: (...args: unknown[]) => mockJwtSign(...args),
  verify: (...args: unknown[]) => mockJwtVerify(...args),
}));

vi.mock('uuid', () => ({
  v4: (...args: unknown[]) => mockUuidV4(...args),
}));

let app: express.Express;

beforeAll(async () => {
  vi.resetModules();
  const authModule = await import('../auth');
  const errMiddleware = await import('../../middleware/errorHandler');
  const cookieParser = (await import('cookie-parser')).default;
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authModule.authRouter);
  app.use(errMiddleware.errorHandler);
});

beforeEach(() => {
  mockQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 1 });
  mockQueryOne.mockReset();
  mockClient.query.mockReset().mockResolvedValue({ rows: [{ id: 'new-user-id' }], rowCount: 1 });
  mockTransaction.mockReset().mockImplementation(async (cb: any) => cb(mockClient));
  mockCreateAuditLog.mockReset().mockResolvedValue(undefined);
  mockCheckLoginVelocity.mockReset().mockResolvedValue({ allowed: true });
  mockRunFraudChecks.mockReset().mockResolvedValue(undefined);
  mockSendWelcomeEmail.mockReset().mockResolvedValue(undefined);
  mockSendPasswordResetEmail.mockReset().mockResolvedValue(undefined);
  mockRecordFailedAttempt.mockReset();
  mockClearFailedAttempts.mockReset();
  mockLogSecurityEvent.mockReset();
  mockBcryptHash.mockReset().mockResolvedValue('hashed-password');
  mockBcryptCompare.mockReset();
  mockJwtSign.mockReset().mockReturnValue('mock-jwt-token');
  mockJwtVerify.mockReset();
  mockUuidV4.mockReset().mockReturnValue('mock-uuid-1234');
});

describe('auth routes', () => {
  describe('POST /api/auth/signup', () => {
    it('returns 201 and creates a user with valid data', async () => {
      mockQueryOne.mockResolvedValueOnce(null); // no existing user
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ id: 'new-user-id', email: 'test@example.com', full_name: 'Test User', role: 'USER' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // wallet insert
      // createSession: INSERT INTO sessions
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });

      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'password123',
          fullName: 'Test User',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.token).toBeDefined();
    });

    it('returns 409 EMAIL_EXISTS when email is already registered', async () => {
      mockQueryOne.mockResolvedValueOnce({ id: 'existing-user' });

      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'existing@example.com',
          password: 'password123',
          fullName: 'Test User',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('EMAIL_EXISTS');
    });
  });

  describe('POST /api/auth/signin', () => {
    const validUser = {
      id: 'user-id-1',
      email: 'test@example.com',
      password_hash: 'hashed-pw',
      full_name: 'Test User',
      role: 'USER',
      account_status: 'active',
      kyc_status: 'pending',
      locked_until: null,
      failed_login_attempts: 0,
      two_factor_enabled: false,
    };

    it('returns 200 with user and token for valid credentials', async () => {
      mockQueryOne.mockResolvedValueOnce(validUser);
      mockBcryptCompare.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/auth/signin')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.token).toBeDefined();
      expect(mockClearFailedAttempts).toHaveBeenCalled();
    });

    it('returns 401 INVALID_CREDENTIALS for wrong password', async () => {
      mockQueryOne.mockResolvedValueOnce(validUser);
      mockBcryptCompare.mockResolvedValue(false);

      const res = await request(app)
        .post('/api/auth/signin')
        .send({ email: 'test@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error?.code).toBe('INVALID_CREDENTIALS');
      expect(mockRecordFailedAttempt).toHaveBeenCalled();
    });

    it('returns 423 ACCOUNT_LOCKED when account is locked', async () => {
      mockQueryOne.mockResolvedValueOnce({
        ...validUser,
        locked_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      const res = await request(app)
        .post('/api/auth/signin')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(423);
      expect(res.body.error?.code).toBe('ACCOUNT_LOCKED');
    });

    it('locks account on 5th wrong password attempt', async () => {
      mockQueryOne.mockResolvedValueOnce({
        ...validUser,
        failed_login_attempts: 4,
      });
      mockBcryptCompare.mockResolvedValue(false);

      const res = await request(app)
        .post('/api/auth/signin')
        .send({ email: 'test@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      // The update query should set locked_until to a non-null value
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET failed_login_attempts'),
        expect.arrayContaining([5, expect.any(Date), validUser.id])
      );
    });
  });

  describe('POST /api/auth/signout', () => {
    it('clears cookie and returns success', async () => {
      // jwt.verify should throw for invalid/missing token so the catch block runs
      mockJwtVerify.mockImplementation(() => { throw new Error('jwt malformed'); });

      const res = await request(app)
        .post('/api/auth/signout');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Logged out');
    });
  });

  describe('POST /api/auth/password-reset/request', () => {
    it('returns 200 for valid email', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'user-1',
        email: 'test@example.com',
        full_name: 'Test User',
      });

      const res = await request(app)
        .post('/api/auth/password-reset/request')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockSendPasswordResetEmail).toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/password-reset/confirm', () => {
    it('resets password with valid token', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'reset-token-id',
        user_id: 'user-1',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        used_at: null,
        email: 'test@example.com',
      });

      const res = await request(app)
        .post('/api/auth/password-reset/confirm')
        .send({
          token: 'valid-reset-token-hex',
          password: 'newpassword123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Should update password
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET password_hash'),
        expect.arrayContaining(['hashed-password', 'user-1'])
      );
      // Should mark token as used
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE password_reset_tokens SET used_at'),
        expect.arrayContaining(['reset-token-id'])
      );
    });
  });
});
