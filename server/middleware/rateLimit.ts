import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';
import { logSecurityEvent } from './securityLogger';

const isDev = process.env.NODE_ENV !== 'production';
const trustProxy = process.env.TRUST_PROXY === 'true' || !!process.env.REPL_ID;

// Store rate limit violations for security monitoring with timestamps
const rateLimitViolations = new Map<string, { count: number; firstSeen: number }>();

// Periodically clean up stale rate limit violations to prevent memory leaks (every 10 minutes)
const VIOLATION_TTL_MS = 60 * 60 * 1000; // 1 hour
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitViolations) {
    if (now - entry.firstSeen > VIOLATION_TTL_MS) {
      rateLimitViolations.delete(ip);
    }
  }
}, 10 * 60 * 1000).unref();

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
      trustProxy,
      ip: !trustProxy,
    },
    handler: (req: any, res: any) => {
      const ip = ipKeyGenerator(req, res);
      const existing = rateLimitViolations.get(ip);
      const count = existing ? existing.count + 1 : 1;
      rateLimitViolations.set(ip, { count, firstSeen: existing?.firstSeen ?? Date.now() });
      
      // Log security event
      logSecurityEvent(
        'RATE_LIMIT_EXCEEDED',
        count > 5 ? 'high' : 'medium',
        req as any,
        { 
          limit: options.max,
          window: options.windowMs,
          violations: count,
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
    const ip = ipKeyGenerator(req, req.res as any);
    const ipStr = typeof ip === 'string' ? ip : String(ip || '');
    return ipStr === '127.0.0.1' || ipStr === '::1' || ipStr.startsWith('172.') || ipStr.startsWith('10.');
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

// Stricter rate limiter for payment webhook (per IP, reduce abuse; allows retries)
export const webhookLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many webhook requests.',
  code: 'RATE_LIMIT_EXCEEDED',
});

export function getRateLimitViolations(): Map<string, number> {
  const result = new Map<string, number>();
  for (const [ip, entry] of rateLimitViolations) {
    result.set(ip, entry.count);
  }
  return result;
}

export function clearRateLimitViolations(ip?: string): void {
  if (ip) {
    rateLimitViolations.delete(ip);
  } else {
    rateLimitViolations.clear();
  }
}
