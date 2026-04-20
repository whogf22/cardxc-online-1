/**
 * @vitest-environment node
 * Server middleware errorHandler tests
 */
import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('../../db/pool', () => ({
  isDatabaseConnectionError: (err: any) => {
    return err?.code === 'ECONNREFUSED' || (err?.message || '').includes('connection refused');
  },
  query: vi.fn(),
  queryOne: vi.fn(),
}));

let AppError: typeof import('../errorHandler').AppError;
let errorHandler: typeof import('../errorHandler').errorHandler;
let notFoundHandler: typeof import('../errorHandler').notFoundHandler;
let asyncHandler: typeof import('../errorHandler').asyncHandler;

beforeAll(async () => {
  const mod = await import('../errorHandler');
  AppError = mod.AppError;
  errorHandler = mod.errorHandler;
  notFoundHandler = mod.notFoundHandler;
  asyncHandler = mod.asyncHandler;
});

function buildApp(throwErr: Error | null = null, isAsync = false) {
  const app = express();
  app.use(express.json());

  if (throwErr) {
    if (isAsync) {
      app.get('/test', asyncHandler(async () => { throw throwErr; }));
    } else {
      app.get('/test', (_req, _res, next) => next(throwErr));
    }
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('AppError', () => {
  it('creates an AppError with statusCode and code', () => {
    const err = new AppError('Not found', 404, 'NOT_FOUND');
    expect(err.message).toBe('Not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.isOperational).toBe(true);
  });

  it('is an instance of Error', () => {
    const err = new AppError('Test', 400);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });
});

describe('errorHandler middleware', () => {
  it('returns 503 for database connection errors', async () => {
    const dbErr = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
    const app = buildApp(dbErr);
    const res = await request(app).get('/test');
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('returns the AppError statusCode for operational errors', async () => {
    const appErr = new AppError('Forbidden', 403, 'FORBIDDEN');
    const app = buildApp(appErr);
    const res = await request(app).get('/test');
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Forbidden');
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 500 INTERNAL_ERROR for non-operational errors', async () => {
    const genericErr = new Error('Something broke');
    const app = buildApp(genericErr);
    const res = await request(app).get('/test');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).toBe('An unexpected error occurred');
  });
});

describe('notFoundHandler', () => {
  it('returns 404 with NOT_FOUND code', async () => {
    const app = buildApp();
    const res = await request(app).get('/no-such-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('includes method and path in message', async () => {
    const app = buildApp();
    const res = await request(app).get('/no-such-route');
    expect(res.body.error.message).toContain('GET');
    expect(res.body.error.message).toContain('/no-such-route');
  });
});

describe('asyncHandler', () => {
  it('passes async errors to next', async () => {
    const appErr = new AppError('Async fail', 422, 'VALIDATION_ERROR');
    const app = buildApp(appErr, true);
    const res = await request(app).get('/test');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('calls next with error when async function throws', async () => {
    const genericErr = new Error('async boom');
    const app = buildApp(genericErr, true);
    const res = await request(app).get('/test');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
