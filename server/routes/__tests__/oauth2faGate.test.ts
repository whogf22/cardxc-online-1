/**
 * @vitest-environment node
 *
 * Regression: the Google OAuth callback must NOT establish an authenticated
 * session for a 2FA-enabled account (OAuth alone must not bypass 2FA).
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { beforeAll, beforeEach, afterEach, vi, describe, it, expect } from 'vitest';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();

vi.mock('../../db/pool', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  transaction: vi.fn(),
  isDatabaseConnectionError: () => false,
}));
vi.mock('../../services/auditService', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../services/fraudService', () => ({
  runFraudChecks: vi.fn().mockResolvedValue(undefined),
  checkLoginVelocity: vi.fn().mockResolvedValue({ allowed: true }),
}));
vi.mock('../../services/emailService', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../middleware/securityLogger', () => ({ logSecurityEvent: vi.fn() }));
vi.mock('../../middleware/security', () => ({
  recordFailedAttempt: vi.fn(),
  clearFailedAttempts: vi.fn(),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  requestLogger: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

let app: express.Express;

beforeAll(async () => {
  process.env.GOOGLE_CLIENT_ID = 'gid';
  process.env.GOOGLE_CLIENT_SECRET = 'gsecret';
  process.env.SESSION_SECRET = 'x'.repeat(48);
  vi.resetModules();
  const auth = await import('../auth');
  app = express();
  app.use(cookieParser());
  app.use('/api/auth', auth.authRouter);
});

beforeEach(() => {
  mockQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 1 });
  mockQueryOne.mockReset();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).includes('oauth2.googleapis.com/token')) {
      return { ok: true, text: async () => '', json: async () => ({ access_token: 'at' }) } as any;
    }
    if (String(url).includes('googleapis.com/oauth2/v2/userinfo')) {
      return { ok: true, json: async () => ({ email: 'u@x.com', name: 'U', picture: '' }) } as any;
    }
    return { ok: false, text: async () => '', json: async () => ({}) } as any;
  }));
});

afterEach(() => vi.unstubAllGlobals());

function callback() {
  return request(app)
    .get('/api/auth/google/callback?code=abc&state=st')
    .set('Cookie', 'oauth_state=st');
}

describe('Google OAuth callback — 2FA gate', () => {
  it('does NOT issue a session when the account has 2FA enabled', async () => {
    mockQueryOne.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users WHERE email')) {
        return { id: 'user-1', email: 'u@x.com', role: 'USER', account_status: 'active', two_factor_enabled: true };
      }
      return null;
    });

    const res = await callback();

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('require_2fa=1');
    const setCookie = String(res.headers['set-cookie'] || '');
    expect(setCookie).not.toContain('auth_token=');
  });

  it('issues a session normally when 2FA is not enabled', async () => {
    mockQueryOne.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users WHERE email')) {
        return { id: 'user-2', email: 'u@x.com', role: 'USER', account_status: 'active', two_factor_enabled: false };
      }
      return null;
    });

    const res = await callback();

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/dashboard');
    const setCookie = String(res.headers['set-cookie'] || '');
    expect(setCookie).toContain('auth_token=');
  });
});
