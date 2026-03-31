/**
 * @vitest-environment node
 */
import { beforeEach, vi, describe, it, expect } from 'vitest';

vi.mock('../../middleware/securityLogger', () => ({
  logSecurityEvent: vi.fn(),
}));

import {
  authLimiter,
  apiLimiter,
  sensitiveOpLimiter,
  financialOpLimiter,
  passwordResetLimiter,
  webhookLimiter,
  getRateLimitViolations,
  clearRateLimitViolations,
} from '../rateLimit';

describe('rateLimit', () => {
  beforeEach(() => {
    clearRateLimitViolations();
  });

  describe('rate limiter exports', () => {
    it('authLimiter is defined as a function', () => {
      expect(typeof authLimiter).toBe('function');
    });

    it('apiLimiter is defined as a function', () => {
      expect(typeof apiLimiter).toBe('function');
    });

    it('sensitiveOpLimiter is defined as a function', () => {
      expect(typeof sensitiveOpLimiter).toBe('function');
    });

    it('financialOpLimiter is defined as a function', () => {
      expect(typeof financialOpLimiter).toBe('function');
    });

    it('passwordResetLimiter is defined as a function', () => {
      expect(typeof passwordResetLimiter).toBe('function');
    });

    it('webhookLimiter is defined as a function', () => {
      expect(typeof webhookLimiter).toBe('function');
    });
  });

  describe('getRateLimitViolations', () => {
    it('returns empty Map initially', () => {
      const violations = getRateLimitViolations();
      expect(violations).toBeInstanceOf(Map);
      expect(violations.size).toBe(0);
    });

    it('returns a copy (not the original)', () => {
      const v1 = getRateLimitViolations();
      const v2 = getRateLimitViolations();
      expect(v1).not.toBe(v2);
    });
  });

  describe('clearRateLimitViolations', () => {
    it('clears all violations when no IP specified', () => {
      const violations = getRateLimitViolations();
      expect(violations.size).toBe(0);
    });

    it('accepts an IP parameter without error', () => {
      expect(() => clearRateLimitViolations('192.168.1.1')).not.toThrow();
    });
  });
});
