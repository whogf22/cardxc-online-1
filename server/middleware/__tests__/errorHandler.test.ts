/**
 * @vitest-environment node
 */
import { beforeEach, vi, describe, it, expect } from 'vitest';

vi.mock('../../middleware/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../db/pool', () => ({
  isDatabaseConnectionError: vi.fn(),
}));

import { AppError, errorHandler, notFoundHandler, asyncHandler } from '../errorHandler';
import { isDatabaseConnectionError } from '../../db/pool';

const mockIsDatabaseConnectionError = isDatabaseConnectionError as ReturnType<typeof vi.fn>;

function createMockRes(): any {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

function createMockReq(overrides: Record<string, any> = {}): any {
  return {
    path: '/api/test',
    method: 'GET',
    ip: '127.0.0.1',
    ...overrides,
  };
}

describe('errorHandler middleware', () => {
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDatabaseConnectionError.mockReturnValue(false);
    mockNext = vi.fn();
  });

  describe('AppError', () => {
    it('has correct statusCode, message, isOperational=true, and code', () => {
      const error = new AppError('Test error', 400, 'TEST_CODE');

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Test error');
      expect(error.isOperational).toBe(true);
      expect(error.code).toBe('TEST_CODE');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('errorHandler', () => {
    it('responds with 400 and error message for AppError(400)', () => {
      const err = new AppError('Bad request', 400, 'BAD_REQUEST');
      const req = createMockReq();
      const res = createMockRes();

      errorHandler(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Bad request',
            code: 'BAD_REQUEST',
          }),
        })
      );
    });

    it('responds with 500 and generic message for non-operational Error', () => {
      const err = new Error('Something unexpected');
      const req = createMockReq();
      const res = createMockRes();

      errorHandler(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'An unexpected error occurred',
            code: 'INTERNAL_ERROR',
          }),
        })
      );
    });

    it('responds with 503 SERVICE_UNAVAILABLE for database connection error', () => {
      mockIsDatabaseConnectionError.mockReturnValue(true);
      const err = new Error('ECONNREFUSED');
      const req = createMockReq();
      const res = createMockRes();

      errorHandler(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'SERVICE_UNAVAILABLE',
          }),
        })
      );
    });
  });

  describe('notFoundHandler', () => {
    it('responds with 404 and route info', () => {
      const req = createMockReq({ method: 'GET', path: '/api/nonexistent' });
      const res = createMockRes();

      notFoundHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: expect.stringContaining('GET'),
            code: 'NOT_FOUND',
          }),
        })
      );
    });
  });

  describe('asyncHandler', () => {
    it('catches rejected promise and calls next(error)', async () => {
      const thrownError = new Error('async failure');
      const handler = asyncHandler(async () => {
        throw thrownError;
      });

      const req = createMockReq();
      const res = createMockRes();

      await handler(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(thrownError);
    });
  });
});
