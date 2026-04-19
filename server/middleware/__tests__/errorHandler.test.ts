import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError, errorHandler, notFoundHandler, asyncHandler } from '../errorHandler';

// Mock logger
vi.mock('../logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock pool
vi.mock('../../db/pool', () => ({
  isDatabaseConnectionError: (err: any) => err?.code === 'ECONNREFUSED',
}));

function createMockReq(overrides = {}) {
  return {
    path: '/api/test',
    method: 'GET',
    ip: '127.0.0.1',
    ...overrides,
  } as any;
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    _json: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res._json = data;
      return res;
    },
  };
  return res;
}

describe('AppError', () => {
  it('should create an operational error with status code and code', () => {
    const err = new AppError('Something went wrong', 400, 'BAD_REQUEST');
    expect(err.message).toBe('Something went wrong');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.isOperational).toBe(true);
    expect(err).toBeInstanceOf(Error);
  });

  it('should work without a code', () => {
    const err = new AppError('Not found', 404);
    expect(err.statusCode).toBe(404);
    expect(err.code).toBeUndefined();
  });
});

describe('errorHandler', () => {
  const next = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle database connection errors with 503', () => {
    const err = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
    const req = createMockReq();
    const res = createMockRes();

    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(503);
    expect(res._json.success).toBe(false);
    expect(res._json.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('should handle operational errors with their status code', () => {
    const err = new AppError('Bad input', 400, 'VALIDATION_ERROR');
    const req = createMockReq();
    const res = createMockRes();

    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res._json.success).toBe(false);
    expect(res._json.error.message).toBe('Bad input');
    expect(res._json.error.code).toBe('VALIDATION_ERROR');
  });

  it('should hide details of non-operational errors', () => {
    const err = new Error('Internal crash');
    const req = createMockReq();
    const res = createMockRes();

    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(500);
    expect(res._json.error.message).toBe('An unexpected error occurred');
    expect(res._json.error.code).toBe('INTERNAL_ERROR');
  });
});

describe('notFoundHandler', () => {
  it('should return 404 with route info', () => {
    const req = createMockReq({ method: 'POST', path: '/api/unknown' });
    const res = createMockRes();

    notFoundHandler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res._json.success).toBe(false);
    expect(res._json.error.code).toBe('NOT_FOUND');
  });
});

describe('asyncHandler', () => {
  it('should call the handler function', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = asyncHandler(handler);
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    await wrapped(req, res, next);

    expect(handler).toHaveBeenCalledWith(req, res, next);
  });

  it('should catch and forward errors to next', async () => {
    const error = new Error('async fail');
    const handler = vi.fn().mockRejectedValue(error);
    const wrapped = asyncHandler(handler);
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    await wrapped(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
