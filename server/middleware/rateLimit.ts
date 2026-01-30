import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request, Response } from 'express';
import { logSecurityEvent } from './securityLogger';

const isDev = process.env.NODE_ENV !== 'production';

// Store rate limit violations for security monitoring
const rateLimitViolations = new Map<string, number>();

const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message: string;
  code: string;
  skip?: (req: Request) => boolean;
  keyGenerator?: (req: Request) => string;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      success: false,
      error: {
        message: options.message,
        code: options.code,
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: options.skip,
    keyGenerator: options.keyGenerator || ((req: any) => {
      return ipKeyGenerator(req, req.res);
    }),
    validate: {
      trustProxy: false,
      ip: false,
    },
    handler: (req: any, res: any) => {
      const ip = ipKeyGenerator(req, res);
      const violations = (rateLimitViolations.get(ip) || 0) + 1;
      rateLimitViolations.set(ip, violations);
      
      // Log security event
      logSecurityEvent(
        'RATE_LIMIT_EXCEEDED',
        violations > 5 ? 'high' : 'medium',
        req as any,
        { 
          limit: options.max,
          window: options.windowMs,
          violations,
          endpoint: req.path,
        }
      );
      
      res.status(429).json({
        success: false,
        error: {
          message: options.message,
          code: options.code,
        }
      });
    },
  });
};

export const authLimiter = createRateLimiter({
  windowMs: isDev ? 1 * 60 * 1000 : 15 * 60 * 1000,
  max: isDev ? 50 : 5, // Reduced from 10 to 5 for better security
  message: 'Too many login attempts. Please try again later.',
  code: 'RATE_LIMITED',
  skip: (req: any) => {
    if (!isDev) return false;
    const ip = ipKeyGenerator(req, req.res as any) as any;
    return ip === '127.0.0.1' || ip === '::1' || ip.startsWith('172.') || ip.startsWith('10.');
  },
});

export const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many requests. Please slow down.',
  code: 'RATE_LIMIT_EXCEEDED',
});

export const sensitiveOpLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many sensitive operations. Please wait.',
  code: 'RATE_LIMIT_EXCEEDED',
});

// Stricter rate limiter for financial operations
export const financialOpLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5, // Very strict for financial operations
  message: 'Too many financial operations. Please wait.',
  code: 'RATE_LIMIT_EXCEEDED',
});

// Rate limiter for password reset
export const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 password reset attempts per hour
  message: 'Too many password reset attempts. Please try again later.',
  code: 'RATE_LIMIT_EXCEEDED',
});

export function getRateLimitViolations(): Map<string, number> {
  return new Map(rateLimitViolations);
}

export function clearRateLimitViolations(ip?: string): void {
  if (ip) {
    rateLimitViolations.delete(ip);
  } else {
    rateLimitViolations.clear();
  }
}
