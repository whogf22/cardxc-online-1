/**
 * @vitest-environment node
 *
 * Tests for the DISABLE_BACKGROUND_JOBS kill switch.
 *
 * The switch is read by server/index.ts. When it is set to the exact value
 * "true", the application must not call initBackgroundJobs(), which is the
 * centralized entry point for all recurring/financial background jobs.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Express } from 'express';
import request from 'supertest';

const initBackgroundJobs = vi.fn();

const httpServer = {
  listen: vi.fn(function (this: typeof httpServer, ...args: unknown[]) {
    const cb = args.find((a) => typeof a === 'function') as (() => void) | undefined;
    if (cb) cb.call(this);
    return this;
  }),
  on: vi.fn(),
  close: vi.fn((cb?: () => void) => {
    if (cb) cb();
  }),
};

const createServer = vi.fn((_app: unknown) => httpServer);

const passThrough = (_req: unknown, _res: unknown, next: () => void) => next();

vi.doMock('../services/backgroundJobs', () => ({
  initBackgroundJobs,
}));

vi.doMock('dotenv/config', () => ({}));

vi.doMock('http', () => ({
  default: {
    createServer,
  },
  createServer,
}));

vi.doMock('../db/init', () => ({
  initializeDatabase: vi.fn(() => Promise.resolve()),
}));

vi.doMock('../db/pool', () => ({
  pool: {
    end: vi.fn(() => Promise.resolve()),
    query: vi.fn(),
    connect: vi.fn(() => Promise.resolve({ query: vi.fn(), release: vi.fn() })),
  },
  isDatabaseConnectionError: vi.fn(() => false),
}));

vi.doMock('../services/socketService', () => ({
  initSocketIO: vi.fn(),
}));

vi.doMock('../middleware/security', () => ({
  securityHeaders: passThrough,
  validateRequestSize: passThrough,
  blockSuspiciousIPs: passThrough,
  detectMaliciousInput: passThrough,
  preventPathTraversal: passThrough,
  requestFingerprint: passThrough,
  recordFailedAttempt: vi.fn(),
  clearFailedAttempts: vi.fn(),
  addToBlacklist: vi.fn(),
}));

vi.doMock('../middleware/securityLogger', () => ({
  securityLogger: passThrough,
}));

vi.doMock('../middleware/rateLimit', () => ({
  apiLimiter: passThrough,
  webhookLimiter: passThrough,
  sensitiveOpLimiter: passThrough,
  authLimiter: passThrough,
  passwordResetLimiter: passThrough,
  financialOpLimiter: passThrough,
  getRateLimitViolations: () => new Map<string, number>(),
  clearRateLimitViolations: () => undefined,
}));

describe('background job kill switch in server/index.ts', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function bootServerWithEnv(env: Record<string, string | undefined>) {
    // Required by validateEnvironment() in server/index.ts.
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db?sslmode=disable';
    process.env.JWT_SECRET = 'a'.repeat(64);
    process.env.NODE_ENV = 'test';
    process.env.PORT = '0';

    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    await import('../index.ts');
    // startServer() is called at the top level and is not awaited, so give its
    // microtasks (initializeDatabase + initBackgroundJobs check) time to run.
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  it('does not call initBackgroundJobs when DISABLE_BACKGROUND_JOBS=true', async () => {
    await bootServerWithEnv({ DISABLE_BACKGROUND_JOBS: 'true' });
    expect(initBackgroundJobs).not.toHaveBeenCalled();
  });

  it('calls initBackgroundJobs when DISABLE_BACKGROUND_JOBS is unset', async () => {
    await bootServerWithEnv({ DISABLE_BACKGROUND_JOBS: undefined });
    expect(initBackgroundJobs).toHaveBeenCalledTimes(1);
  });

  it('calls initBackgroundJobs when DISABLE_BACKGROUND_JOBS=false', async () => {
    await bootServerWithEnv({ DISABLE_BACKGROUND_JOBS: 'false' });
    expect(initBackgroundJobs).toHaveBeenCalledTimes(1);
  });

  it('still mounts KYC and Sumsub routes when DISABLE_BACKGROUND_JOBS=true', async () => {
    await bootServerWithEnv({ DISABLE_BACKGROUND_JOBS: 'true' });

    expect(createServer).toHaveBeenCalled();
    const app = createServer.mock.calls[0][0] as Express;
    expect(app).toBeTruthy();

    // Public health route is still mounted and returns 200.
    const healthRes = await request(app).get('/api/health');
    expect(healthRes.status).toBe(200);

    // KYC token route is still mounted. Without an auth cookie it returns 401
    // (route exists), not 404 (route missing).
    const kycRes = await request(app).post('/api/user/kyc/token');
    expect(kycRes.status).not.toBe(404);

    // Sumsub webhook route is still mounted. Without a signature it returns
    // 401 (route exists), not 404 (route missing).
    const webhookRes = await request(app).post('/api/webhooks/sumsub');
    expect(webhookRes.status).not.toBe(404);
  });
});
