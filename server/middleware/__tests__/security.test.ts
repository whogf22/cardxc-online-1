import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  securityHeaders,
  validateRequestSize,
  blockSuspiciousIPs,
  detectMaliciousInput,
  preventPathTraversal,
  requestFingerprint,
  recordFailedAttempt,
  clearFailedAttempts,
} from '../security';

// Mock logger
vi.mock('../logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock errorHandler
vi.mock('../errorHandler', () => ({
  AppError: class AppError extends Error {
    statusCode: number;
    code?: string;
    isOperational = true;
    constructor(message: string, statusCode: number, code?: string) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
    }
  },
}));

function createMockReq(overrides: any = {}) {
  return {
    path: '/api/test',
    method: 'GET',
    ip: '192.168.1.1',
    headers: {},
    body: {},
    query: {},
    params: {},
    socket: { remoteAddress: '192.168.1.1' },
    get: vi.fn().mockReturnValue('test-user-agent'),
    ...overrides,
  } as any;
}

function createMockRes() {
  const res: any = {
    setHeader: vi.fn(),
    removeHeader: vi.fn(),
  };
  return res;
}

describe('securityHeaders', () => {
  it('should set security headers', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    securityHeaders(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(res.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
    expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
    expect(res.removeHeader).toHaveBeenCalledWith('X-Powered-By');
    expect(next).toHaveBeenCalled();
  });
});

describe('validateRequestSize', () => {
  it('should skip for health checks', () => {
    const req = createMockReq({ path: '/api/health' });
    const res = createMockRes();
    const next = vi.fn();

    validateRequestSize(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should allow requests under size limit', () => {
    const req = createMockReq({ headers: { 'content-length': '1024' } });
    const res = createMockRes();
    const next = vi.fn();

    validateRequestSize(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should throw for oversized requests', () => {
    const req = createMockReq({ headers: { 'content-length': '200000' } });
    const res = createMockRes();
    const next = vi.fn();

    expect(() => validateRequestSize(req, res, next)).toThrow('Request payload too large');
  });
});

describe('blockSuspiciousIPs', () => {
  beforeEach(() => {
    clearFailedAttempts('10.0.0.1');
  });

  it('should allow legitimate IPs', () => {
    const req = createMockReq({ ip: '10.0.0.2' });
    const res = createMockRes();
    const next = vi.fn();

    blockSuspiciousIPs(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should block IPs with too many failed attempts', () => {
    const ip = '10.0.0.1';
    // Record 5 failed attempts
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt(ip);
    }

    const req = createMockReq({ ip, path: '/api/users' });
    const res = createMockRes();
    const next = vi.fn();

    expect(() => blockSuspiciousIPs(req, res, next)).toThrow('IP temporarily blocked');
  });

  it('should skip blocking for health checks', () => {
    const req = createMockReq({ path: '/api/health' });
    const res = createMockRes();
    const next = vi.fn();

    blockSuspiciousIPs(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('detectMaliciousInput', () => {
  it('should allow normal input', () => {
    const req = createMockReq({
      body: { name: 'John Doe', email: 'john@example.com' },
    });
    const res = createMockRes();
    const next = vi.fn();

    detectMaliciousInput(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should detect SQL injection in body', () => {
    const req = createMockReq({
      body: { name: "'; DROP TABLE users; --" },
    });
    const res = createMockRes();
    const next = vi.fn();

    expect(() => detectMaliciousInput(req, res, next)).toThrow('Invalid input detected');
  });

  it('should detect XSS in body', () => {
    const req = createMockReq({
      body: { name: '<script>alert("xss")</script>' },
    });
    const res = createMockRes();
    const next = vi.fn();

    expect(() => detectMaliciousInput(req, res, next)).toThrow('Invalid input detected');
  });

  it('should detect malicious query params', () => {
    const req = createMockReq({
      query: { search: 'SELECT * FROM users' },
    });
    const res = createMockRes();
    const next = vi.fn();

    expect(() => detectMaliciousInput(req, res, next)).toThrow('Invalid input detected');
  });

  it('should skip for health endpoint', () => {
    const req = createMockReq({
      path: '/api/health',
      body: { data: 'SELECT * FROM users' },
    });
    const res = createMockRes();
    const next = vi.fn();

    detectMaliciousInput(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('preventPathTraversal', () => {
  it('should allow normal paths', () => {
    const req = createMockReq({ path: '/api/users/123' });
    const res = createMockRes();
    const next = vi.fn();

    preventPathTraversal(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should detect ../ traversal', () => {
    const req = createMockReq({ path: '/api/../../../etc/passwd' });
    const res = createMockRes();
    const next = vi.fn();

    expect(() => preventPathTraversal(req, res, next)).toThrow('Invalid path');
  });

  it('should detect encoded traversal', () => {
    const req = createMockReq({ path: '/api/%2e%2e/secret' });
    const res = createMockRes();
    const next = vi.fn();

    expect(() => preventPathTraversal(req, res, next)).toThrow('Invalid path');
  });
});

describe('requestFingerprint', () => {
  it('should attach fingerprint to request', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    requestFingerprint(req, res, next);

    expect(req.securityFingerprint).toBeDefined();
    expect(req.securityFingerprint.ip).toBe('192.168.1.1');
    expect(req.securityFingerprint.method).toBe('GET');
    expect(req.securityFingerprint.path).toBe('/api/test');
    expect(next).toHaveBeenCalled();
  });
});

describe('recordFailedAttempt / clearFailedAttempts', () => {
  const ip = '172.16.0.99';

  beforeEach(() => {
    clearFailedAttempts(ip);
  });

  it('should track failed attempts', () => {
    recordFailedAttempt(ip);
    recordFailedAttempt(ip);

    // Should not block yet (under threshold)
    const req = createMockReq({ ip });
    const res = createMockRes();
    const next = vi.fn();
    blockSuspiciousIPs(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should clear failed attempts', () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(ip);
    clearFailedAttempts(ip);

    const req = createMockReq({ ip });
    const res = createMockRes();
    const next = vi.fn();
    blockSuspiciousIPs(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
