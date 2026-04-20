/**
 * @vitest-environment node
 * Auth middleware tests
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { beforeEach, beforeAll, vi, describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';

const mockQueryOne = vi.fn();

vi.mock('../../db/pool', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  query: vi.fn(),
  isDatabaseConnectionError: () => false,
}));

const TEST_SECRET = 'test-jwt-secret';

let authenticate: typeof import('../auth').authenticate;
let requireRole: typeof import('../auth').requireRole;
let requireAdmin: typeof import('../auth').requireAdmin;
let AppError: typeof import('../errorHandler').AppError;

beforeAll(async () => {
  process.env.SESSION_SECRET = TEST_SECRET;
  process.env.NODE_ENV = 'test';
  vi.resetModules();
  const authMod = await import('../auth');
  const errMod = await import('../errorHandler');
  authenticate = authMod.authenticate;
  requireRole = authMod.requireRole;
  requireAdmin = authMod.requireAdmin;
  AppError = errMod.AppError;
});

beforeEach(() => {
  mockQueryOne.mockReset();
});

function buildAuthApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.get('/protected', authenticate, (req, res) => {
    res.json({ success: true, user: (req as any).user });
  });
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.statusCode || 500).json({ success: false, error: err.message, code: err.code });
  });
  return app;
}

function makeToken(payload: object, secret = TEST_SECRET) {
  return jwt.sign(payload, secret);
}

describe('authenticate middleware', () => {
  it('returns 401 when no token provided', async () => {
    const app = buildAuthApp();
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for invalid token', async () => {
    const app = buildAuthApp();
    const res = await request(app).get('/protected')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('returns 401 for expired session', async () => {
    const token = makeToken({ userId: 'u1', sessionId: 'sess-1' });
    mockQueryOne
      .mockResolvedValueOnce(null)  // session not found
      .mockResolvedValue(undefined);
    const app = buildAuthApp();
    const res = await request(app).get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SESSION_INVALID');
  });

  it('returns 403 for inactive account', async () => {
    const token = makeToken({ userId: 'u1', sessionId: 'sess-1' });
    mockQueryOne
      .mockResolvedValueOnce({ id: 'sess-1', email: 'test@example.com', role: 'USER', account_status: 'suspended' })
      .mockResolvedValue(undefined);
    const app = buildAuthApp();
    const res = await request(app).get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_INACTIVE');
  });

  it('attaches user to request on success', async () => {
    const token = makeToken({ userId: 'u1', sessionId: 'sess-1' });
    mockQueryOne
      .mockResolvedValueOnce({ id: 'sess-1', email: 'test@example.com', role: 'USER', account_status: 'active' })
      .mockResolvedValue(undefined);
    const app = buildAuthApp();
    const res = await request(app).get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.id).toBe('u1');
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.user.role).toBe('USER');
  });

  it('accepts token from cookie', async () => {
    const token = makeToken({ userId: 'u2', sessionId: 'sess-2' });
    mockQueryOne
      .mockResolvedValueOnce({ id: 'sess-2', email: 'cookie@example.com', role: 'USER', account_status: 'active' })
      .mockResolvedValue(undefined);
    const app = buildAuthApp();
    const res = await request(app).get('/protected')
      .set('Cookie', `auth_token=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('cookie@example.com');
  });
});

describe('requireRole middleware', () => {
  function buildRoleApp(roles: ('USER' | 'SUPER_ADMIN')[]) {
    const app = express();
    app.use(express.json());
    app.get('/admin', (req, _res, next) => {
      (req as any).user = { id: 'u1', email: 'a@b.com', role: 'USER', sessionId: 's1' };
      next();
    }, requireRole(...roles), (req, res) => {
      res.json({ success: true });
    });
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(err.statusCode || 500).json({ success: false, code: err.code });
    });
    return app;
  }

  it('allows access when user has the required role', async () => {
    const app = buildRoleApp(['USER']);
    const res = await request(app).get('/admin');
    expect(res.status).toBe(200);
  });

  it('denies access when user lacks the required role', async () => {
    const app = buildRoleApp(['SUPER_ADMIN']);
    const res = await request(app).get('/admin');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('allows access when user matches one of multiple roles', async () => {
    const app = buildRoleApp(['USER', 'SUPER_ADMIN']);
    const res = await request(app).get('/admin');
    expect(res.status).toBe(200);
  });

  it('returns 401 when req.user is not set', async () => {
    const app = express();
    app.use(express.json());
    app.get('/admin', requireRole('USER'), (req, res) => {
      res.json({ success: true });
    });
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(err.statusCode || 500).json({ success: false, code: err.code });
    });
    const res = await request(app).get('/admin');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});

describe('requireAdmin middleware', () => {
  it('allows SUPER_ADMIN through', async () => {
    const app = express();
    app.use(express.json());
    app.get('/admin', (req, _res, next) => {
      (req as any).user = { id: 'a1', email: 'admin@b.com', role: 'SUPER_ADMIN', sessionId: 's1' };
      next();
    }, requireAdmin, (req, res) => {
      res.json({ success: true });
    });
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(err.statusCode || 500).json({ success: false, code: err.code });
    });
    const res = await request(app).get('/admin');
    expect(res.status).toBe(200);
  });

  it('blocks USER role', async () => {
    const app = express();
    app.use(express.json());
    app.get('/admin', (req, _res, next) => {
      (req as any).user = { id: 'u1', email: 'user@b.com', role: 'USER', sessionId: 's1' };
      next();
    }, requireAdmin, (req, res) => {
      res.json({ success: true });
    });
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(err.statusCode || 500).json({ success: false, code: err.code });
    });
    const res = await request(app).get('/admin');
    expect(res.status).toBe(403);
  });
});
