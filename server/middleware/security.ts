import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { AppError } from './errorHandler';

// IP-based brute force protection
const failedAttempts = new Map<string, { count: number; resetAt: number }>();
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;

// IP blacklist for admin-managed blocking
const blacklistedIPs = new Set<string>();

export function addToBlacklist(ip: string) {
  blacklistedIPs.add(ip);
  logger.info(`[Security] IP added to blacklist: ${ip}`);
}

export function removeFromBlacklist(ip: string) {
  blacklistedIPs.delete(ip);
  logger.info(`[Security] IP removed from blacklist: ${ip}`);
}

export function getBlacklistedIPs(): string[] {
  return Array.from(blacklistedIPs);
}

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove server header
  res.removeHeader('X-Powered-By');
  
  // HSTS (only in production with HTTPS)
  if (process.env.NODE_ENV === 'production' && req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  next();
}

export function validateRequestSize(req: Request, res: Response, next: NextFunction) {
  // Skip size validation for health checks
  if (req.path === '/api/health' || req.path.startsWith('/api-docs')) {
    return next();
  }
  
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  const MAX_SIZE = 100 * 1024; // 100KB
  
  if (contentLength > MAX_SIZE) {
    logger.warn(`[Security] Request too large from ${req.ip}: ${contentLength} bytes`);
    throw new AppError('Request payload too large', 413, 'PAYLOAD_TOO_LARGE');
  }
  
  next();
}

export function blockSuspiciousIPs(req: Request, res: Response, next: NextFunction) {
  // Skip blocking for health checks and public endpoints
  const publicPaths = ['/api/health', '/api-docs'];
  if (publicPaths.some(path => req.path.startsWith(path)) || req.path === '/') {
    return next();
  }
  
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const attempt = failedAttempts.get(ip);
  
  if (attempt) {
    if (Date.now() < attempt.resetAt) {
      if (attempt.count >= MAX_FAILED_ATTEMPTS) {
        logger.warn(`[Security] Blocked suspicious IP: ${ip} (${attempt.count} failed attempts)`);
        throw new AppError('IP temporarily blocked due to suspicious activity', 429, 'IP_BLOCKED');
      }
    } else {
      // Reset expired block
      failedAttempts.delete(ip);
    }
  }
  
  next();
}

export function recordFailedAttempt(ip: string) {
  const existing = failedAttempts.get(ip);
  const count = existing ? existing.count + 1 : 1;
  
  failedAttempts.set(ip, {
    count,
    resetAt: Date.now() + BLOCK_DURATION_MS,
  });
  
  // Clean up old entries periodically
  if (count === 1) {
    setTimeout(() => {
      const entry = failedAttempts.get(ip);
      if (entry && Date.now() >= entry.resetAt) {
        failedAttempts.delete(ip);
      }
    }, BLOCK_DURATION_MS);
  }
}

export function clearFailedAttempts(ip: string) {
  failedAttempts.delete(ip);
}

// SQL Injection detection patterns
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/i,
  /(--|#|\/\*|\*\/|;)/,
  /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
  /('|"|`).*(\bor\b|\band\b).*('|"|`)/i,
];

// XSS detection patterns
const XSS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe[^>]*>/gi,
  /<object[^>]*>/gi,
  /<embed[^>]*>/gi,
];

export function detectMaliciousInput(req: Request, res: Response, next: NextFunction) {
  // Skip detection for health checks and public endpoints
  const publicPaths = ['/api/health', '/api-docs'];
  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }
  
  const checkValue = (value: any, path: string): boolean => {
    if (typeof value === 'string') {
      if (value.length > 2) {
        const sqlMatch = SQL_INJECTION_PATTERNS.some(pattern => pattern.test(value));
        const xssMatch = XSS_PATTERNS.some(pattern => pattern.test(value));
        
        if (sqlMatch || xssMatch) {
          logger.warn(`[Security] Malicious input detected from ${req.ip} at ${path}: ${value.substring(0, 100)}`);
          return true;
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const key in value) {
        if (checkValue(value[key], `${path}.${key}`)) {
          return true;
        }
      }
    }
    return false;
  };
  
  // Check body
  if (req.body && typeof req.body === 'object') {
    if (checkValue(req.body, 'body')) {
      throw new AppError('Invalid input detected', 400, 'INVALID_INPUT');
    }
  }
  
  // Check query params
  if (req.query && typeof req.query === 'object') {
    if (checkValue(req.query, 'query')) {
      throw new AppError('Invalid input detected', 400, 'INVALID_INPUT');
    }
  }
  
  // Check params
  if (req.params && typeof req.params === 'object') {
    if (checkValue(req.params, 'params')) {
      throw new AppError('Invalid input detected', 400, 'INVALID_INPUT');
    }
  }
  
  next();
}

// Path traversal detection
export function preventPathTraversal(req: Request, res: Response, next: NextFunction) {
  const suspicious = ['../', '..\\', '%2e%2e', '%2e%2e%2f', '..%2f', '%252e', '%c0%ae', '%c1%9c', '....//'];
  let path: string;
  try {
    path = decodeURIComponent(req.path).toLowerCase();
  } catch {
    path = req.path.toLowerCase();
  }
  const rawPath = req.path.toLowerCase();
  
  if (suspicious.some(pattern => path.includes(pattern) || rawPath.includes(pattern))) {
    logger.warn(`[Security] Path traversal attempt from ${req.ip}: ${req.path}`);
    throw new AppError('Invalid path', 400, 'INVALID_PATH');
  }
  
  next();
}

// Request fingerprinting for anomaly detection
export function requestFingerprint(req: Request, res: Response, next: NextFunction) {
  const fingerprint = {
    ip: req.ip || req.socket?.remoteAddress || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
    method: req.method,
    path: req.path,
    timestamp: Date.now(),
  };
  
  // Store in request for logging
  (req as any).securityFingerprint = fingerprint;
  
  next();
}
