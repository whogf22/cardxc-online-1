import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { AppError } from './errorHandler';

// IP-based brute force protection.
//
// Storage is abstracted behind a small interface so the module can switch
// between an in-process fallback and a Redis-backed implementation when
// REDIS_URL is configured. The in-process fallback resets on restart — if
// you rely on this for brute-force protection across a fleet, configure
// Redis for durable cross-instance state.
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;

interface FailedAttemptStore {
  get(ip: string): { count: number; resetAt: number } | undefined;
  set(ip: string, value: { count: number; resetAt: number }): void;
  delete(ip: string): void;
  cleanup(): void;
}

interface BlacklistStore {
  add(ip: string): void;
  remove(ip: string): void;
  has(ip: string): boolean;
  values(): string[];
}

function createInMemoryFailedAttemptStore(): FailedAttemptStore {
  const store = new Map<string, { count: number; resetAt: number }>();
  return {
    get: (ip) => store.get(ip),
    set: (ip, value) => {
      store.set(ip, value);
    },
    delete: (ip) => {
      store.delete(ip);
    },
    cleanup: () => {
      const now = Date.now();
      for (const [ip, entry] of store) {
        if (now >= entry.resetAt) store.delete(ip);
      }
    },
  };
}

function createInMemoryBlacklistStore(): BlacklistStore {
  const store = new Set<string>();
  return {
    add: (ip) => {
      store.add(ip);
    },
    remove: (ip) => {
      store.delete(ip);
    },
    has: (ip) => store.has(ip),
    values: () => Array.from(store),
  };
}

// Select backing store. When REDIS_URL is present a production deployment
// should wire these to Redis — until that integration is available, we emit
// a loud warning so operators know restart-clearing is in effect.
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  logger.warn(
    '[Security] REDIS_URL not configured — failedAttempts/blacklistedIPs are in-process only. ' +
      'State will be lost on restart and will NOT be shared across instances.',
  );
} else {
  logger.info('[Security] REDIS_URL detected; using in-memory fallback until a Redis-backed store is implemented.');
}

const failedAttempts = createInMemoryFailedAttemptStore();
const blacklistedIPs = createInMemoryBlacklistStore();

// Periodic cleanup to prevent memory growth from long-expired entries.
setInterval(() => failedAttempts.cleanup(), 15 * 60 * 1000);

export function addToBlacklist(ip: string) {
  blacklistedIPs.add(ip);
  logger.info(`[Security] IP added to blacklist: ${ip}`);
}

export function removeFromBlacklist(ip: string) {
  blacklistedIPs.remove(ip);
  logger.info(`[Security] IP removed from blacklist: ${ip}`);
}

export function getBlacklistedIPs(): string[] {
  return blacklistedIPs.values();
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
  const publicPaths = ['/api/health', '/api-docs', '/'];
  if (publicPaths.some(path => req.path.startsWith(path))) {
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

// SQL Injection / XSS detection patterns. These are heuristics only — the
// real defence is parameterized queries (handled in db/pool.ts) and context-
// aware output encoding in the frontend. This WAF layer runs on an explicit
// allowlist of (path, field) pairs so it does NOT fire on free-text content
// fields (descriptions, names, chat bodies) where words like "select" or
// "union" are legitimate.
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/i,
  /(--|#|\/\*|\*\/|;)/,
  /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
  /('|"|`).*(\bor\b|\band\b).*('|"|`)/i,
];

const XSS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe[^>]*>/gi,
  /<object[^>]*>/gi,
  /<embed[^>]*>/gi,
];

/**
 * Explicit allowlist of request locations to scan. Each entry is a
 * (path pattern, field list) pair. Paths are matched exactly OR via prefix
 * ending in "/" or "/*". Fields are specific JSON keys (for body / query /
 * params). Only structured identifier-like fields (IDs, emails, currency
 * codes, enum values, URL / path parts) are scanned — never free-text
 * content fields.
 */
interface WafRule {
  pathExact?: string;
  pathPrefix?: string;
  bodyFields?: string[];
  queryFields?: string[];
  paramFields?: string[];
}

const WAF_RULES: WafRule[] = [
  { pathPrefix: '/api/auth/', bodyFields: ['email', 'currency', 'role'], queryFields: ['email'] },
  { pathPrefix: '/api/admin/', queryFields: ['userId', 'orderId', 'status'], paramFields: ['id'] },
  { pathPrefix: '/api/payments/', bodyFields: ['currency', 'provider'], queryFields: ['status', 'orderId'], paramFields: ['id'] },
  { pathPrefix: '/api/cards/', paramFields: ['id'] },
  { pathPrefix: '/api/user/', bodyFields: ['currency', 'walletType'] },
];

function findRule(reqPath: string): WafRule | null {
  for (const rule of WAF_RULES) {
    if (rule.pathExact && reqPath === rule.pathExact) return rule;
    if (rule.pathPrefix && reqPath.startsWith(rule.pathPrefix)) return rule;
  }
  return null;
}

function scanValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (value.length <= 2) return false;
  return (
    SQL_INJECTION_PATTERNS.some((p) => p.test(value)) ||
    XSS_PATTERNS.some((p) => p.test(value))
  );
}

function scanFields(source: Record<string, unknown> | undefined, fields: string[] | undefined): { field: string; value: string } | null {
  if (!source || !fields) return null;
  for (const field of fields) {
    const raw = source[field];
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (scanValue(item)) return { field, value: String(item) };
      }
    } else if (scanValue(raw)) {
      return { field, value: String(raw) };
    }
  }
  return null;
}

export function detectMaliciousInput(req: Request, res: Response, next: NextFunction) {
  const rule = findRule(req.path);
  if (!rule) return next();

  const hit =
    scanFields(req.body as Record<string, unknown> | undefined, rule.bodyFields) ||
    scanFields(req.query as Record<string, unknown> | undefined, rule.queryFields) ||
    scanFields(req.params as Record<string, unknown> | undefined, rule.paramFields);

  if (hit) {
    logger.warn('[Security] Malicious input detected', {
      ip: req.ip,
      path: req.path,
      field: hit.field,
      sample: hit.value.substring(0, 100),
    });
    throw new AppError('Invalid input detected', 400, 'INVALID_INPUT');
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
