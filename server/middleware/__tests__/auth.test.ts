// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../errorHandler';

vi.mock('jsonwebtoken', () => {
  const verify = vi.fn();
  return { default: { verify }, verify };
});

vi.mock('../../db/pool', () => ({
  queryOne: vi.fn(),
}));

import jwt from 'jsonwebtoken';
import { queryOne } from '../../db/pool';
import { authenticate, requireRole, requireAdmin, requireSuperAdmin } from '../auth';

const mockVerify = (jwt as any).verify as ReturnType<typeof vi.fn>;
const mockQueryOne = queryOne as ReturnType<typeof vi.fn>;

describe('auth middleware', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = { cookies: {}, headers: {}, user: undefined } as any;
    mockRes = {} as any;
    mockNext = vi.fn();
  });

  describe('authenticate', () => {
    it('calls next with AppError 401 UNAUTHORIZED when no token is provided', async () => {
      await authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('calls next with AppError 401 INVALID_TOKEN when JWT verification fails', async () => {
      mockReq.cookies.auth_token = 'bad-token';
      mockVerify.mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });

    it('calls next with AppError 401 SESSION_INVALID when no session found in DB', async () => {
      mockReq.cookies.auth_token = 'valid-token';
      mockVerify.mockReturnValue({ sessionId: 'sess-1', userId: 'user-1' });
      mockQueryOne.mockResolvedValueOnce(null);

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('SESSION_INVALID');
    });

    it('calls next with AppError 403 ACCOUNT_INACTIVE when account is not active', async () => {
      mockReq.cookies.auth_token = 'valid-token';
      mockVerify.mockReturnValue({ sessionId: 'sess-1', userId: 'user-1' });
      mockQueryOne.mockResolvedValueOnce({
        id: 'sess-1',
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'USER',
        account_status: 'suspended',
      });

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('ACCOUNT_INACTIVE');
    });

    it('sets req.user and calls next() for valid JWT + active session + active account', async () => {
      mockReq.cookies.auth_token = 'valid-token';
      mockVerify.mockReturnValue({ sessionId: 'sess-1', userId: 'user-1' });
      mockQueryOne
        .mockResolvedValueOnce({
          id: 'sess-1',
          user_id: 'user-1',
          email: 'test@example.com',
          role: 'USER',
          account_status: 'active',
        })
        .mockResolvedValueOnce(null); // UPDATE last_used_at

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.user).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        role: 'USER',
        sessionId: 'sess-1',
      });
      // Verify session last_used_at was updated
      expect(mockQueryOne).toHaveBeenCalledTimes(2);
      expect(mockQueryOne.mock.calls[1][0]).toContain('UPDATE sessions SET last_used_at');
    });

    it('extracts token from Authorization header (Bearer)', async () => {
      mockReq.headers.authorization = 'Bearer header-token';
      mockVerify.mockReturnValue({ sessionId: 'sess-2', userId: 'user-2' });
      mockQueryOne
        .mockResolvedValueOnce({
          id: 'sess-2',
          user_id: 'user-2',
          email: 'header@example.com',
          role: 'SUPER_ADMIN',
          account_status: 'active',
        })
        .mockResolvedValueOnce(null);

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockVerify).toHaveBeenCalledWith('header-token', expect.any(String));
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.user).toEqual({
        id: 'user-2',
        email: 'header@example.com',
        role: 'SUPER_ADMIN',
        sessionId: 'sess-2',
      });
    });
  });

  describe('requireRole', () => {
    it('calls next with AppError 401 when req.user is not set', () => {
      const middleware = requireRole('USER');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(401);
    });

    it('calls next with AppError 403 FORBIDDEN when user role is not in allowed roles', () => {
      mockReq.user = { id: 'u1', email: 'a@b.com', role: 'USER', sessionId: 's1' };
      const middleware = requireRole('SUPER_ADMIN');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });

    it('calls next() when user role matches an allowed role', () => {
      mockReq.user = { id: 'u1', email: 'a@b.com', role: 'SUPER_ADMIN', sessionId: 's1' };
      const middleware = requireRole('USER', 'SUPER_ADMIN');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('requireAdmin', () => {
    it('calls next with AppError 403 when user has USER role', () => {
      mockReq.user = { id: 'u1', email: 'a@b.com', role: 'USER', sessionId: 's1' };
      requireAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(403);
    });

    it('calls next() when user has SUPER_ADMIN role', () => {
      mockReq.user = { id: 'u1', email: 'a@b.com', role: 'SUPER_ADMIN', sessionId: 's1' };
      requireAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('requireSuperAdmin', () => {
    it('calls next() when user has SUPER_ADMIN role', () => {
      mockReq.user = { id: 'u1', email: 'a@b.com', role: 'SUPER_ADMIN', sessionId: 's1' };
      requireSuperAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});
