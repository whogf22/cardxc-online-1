import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import { logger, requestLogger } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimit';
import {
  securityHeaders,
  validateRequestSize,
  blockSuspiciousIPs,
  detectMaliciousInput,
  preventPathTraversal,
  requestFingerprint,
} from './middleware/security';
import { webhookLimiter } from './middleware/rateLimit';
import { securityLogger } from './middleware/securityLogger';
import { authRouter } from './routes/auth';
import { userRouter } from './routes/user';
import { adminRouter } from './routes/admin';
import { transactionRouter } from './routes/transactions';
import { healthRouter } from './routes/health';
import { aiRouter } from './routes/ai';
import { paymentsRouter } from './routes/payments';
import { cardsRouter } from './routes/cards';
import { savingsRouter } from './routes/savings';
import { rewardsRouter } from './routes/rewards';
import { cardCheckoutRouter, paymentWebhookRouter, paymentAdminRouter } from './routes/cardCheckout';
import { legalRouter } from './routes/legal';
import { supportRouter } from './routes/support';
import { giftCardsRouter } from './routes/giftCards';
import { withdrawalRouter } from './routes/withdrawal';
import { cryptoRouter } from './routes/crypto';
import { swapRouter } from './routes/swap';
import { fluzRouter } from './routes/fluz';
import { depositOtpRouter } from './routes/depositOtp';
import { insightsRouter } from './routes/insights';
import { referralsRouter } from './routes/referrals';
import { notificationsRouter } from './routes/notifications';
import { preferencesRouter } from './routes/preferences';
import { adminAnalyticsRouter } from './routes/adminAnalytics';
import { adminSecurityRouter } from './routes/adminSecurity';
import { initializeDatabase } from './db/init';
import { pool } from './db/pool';
import { swaggerSpec } from './config/swagger';
import { initBackgroundJobs } from './services/backgroundJobs';
import { initSocketIO } from './services/socketService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function validateEnvironment() {
  const required = ['DATABASE_URL'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`[FATAL] Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  // SESSION_SECRET / JWT_SECRET is mandatory. getJwtSecret() (from
  // ./lib/jwtSecret) throws on first access if missing or too short, so the
  // validation happens the moment any JWT call site runs. We intentionally
  // do not fall back to warn-only behaviour here.
  if (!process.env.SESSION_SECRET && !process.env.JWT_SECRET) {
    console.error('[FATAL] SESSION_SECRET (or JWT_SECRET) must be set (min 32 chars)');
    process.exit(1);
  }
}

validateEnvironment();

const app = express();

// Trust first proxy when behind Replit/load balancer (for correct req.ip and rate limiting)
if (process.env.TRUST_PROXY === 'true' || process.env.REPL_ID) {
  app.set('trust proxy', 1);
}

const isProduction = process.env.NODE_ENV === 'production';
const MCP_PORT = parseInt(process.env.MCP_PORT || '8080', 10);

// Port resolution:
// - Production: Always use port 5000 (required for deployment)
// - Development on Replit: Use port 3001 so Vite can use 5000
const PORT = isProduction 
  ? 5000 
  : (process.env.REPL_ID ? 3001 : parseInt(process.env.PORT || '5000', 10));

if (!isProduction && process.env.REPL_ID) {
  logger.info('Development mode: using port 3001 for API so Vite can use 5000');
}

const allowedOrigins = [
  'http://localhost:5000',
  'http://localhost:5173',
  process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '',
  ...(process.env.REPLIT_DOMAINS || '')
    .split(',')
    .map(d => d.trim())
    .filter(Boolean)
    .map(d => (d.startsWith('http') ? d : `https://${d}`)),
].filter(Boolean);

// Enhanced security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // TODO: migrate remaining inline scripts (primarily the Vite HMR
      // bootstrap in dev and any third-party embeds) to nonce-based CSP so
      // 'unsafe-inline' can be dropped. 'unsafe-eval' is removed because no
      // current script path requires eval().
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://api.fontshare.com", "https://fonts.googleapis.com", "https://js.stripe.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://api.fontshare.com", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://api.fontshare.com", "https://fonts.gstatic.com", "https://cdn.fontshare.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://api.exchangerate-api.com", "https://api.stripe.com", "https://hooks.stripe.com", "wss://cardxc.online", "wss://www.cardxc.online", "ws://localhost:5000", "ws://localhost:5173"],
      workerSrc: ["'self'", "blob:"],
      frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// Additional security middleware (applied after routes to avoid blocking health checks)
// Note: Some middleware is applied conditionally in routes

app.use(cors({
  origin: (origin, callback) => {
    // Exact-match allowlist only. We intentionally do NOT allow arbitrary
    // subdomain matches — a compromised subdomain must not silently gain
    // cross-origin credentials. Add required subdomains explicitly to
    // REPLIT_DOMAINS / allowedOrigins.
    if (!origin) {
      return callback(null, true);
    }
    const cleanOrigin = origin.replace(/^https?:\/\//, '');
    const matched = allowedOrigins.some(allowed => {
      const cleanAllowed = allowed.replace(/^https?:\/\//, '');
      return cleanOrigin === cleanAllowed;
    });
    callback(null, matched);
  },
  credentials: true,
}));

// Body parsing: raw for payment webhook (signature verification), JSON for all other requests
app.use((req, res, next) => {
  const webhookPath = req.method === 'POST' ? req.originalUrl?.split('?')[0] : '';
  const isPaymentWebhook = webhookPath === '/api/webhooks/payment';
  const isStripeWebhook = webhookPath === '/api/webhooks/stripe';
  if (isPaymentWebhook || isStripeWebhook) {
    return express.raw({ type: 'application/json', limit: '100kb' })(req, res, (err: Error) => {
      if (err) return next(err);
      const raw = req.body as Buffer;
      (req as express.Request & { rawBody?: Buffer }).rawBody = raw;
      try {
        (req as any).body = raw.length ? JSON.parse(raw.toString('utf8')) : {};
      } catch (e) {
        return next(e);
      }
      next();
    });
  }
  return express.json({
    limit: '50kb',
    strict: true,
    type: 'application/json',
  })(req, res, next);
});
app.use(express.urlencoded({
  extended: false,
  limit: '10kb',
  parameterLimit: 20, // Limit number of parameters
}));
app.use(cookieParser());
app.use(requestLogger);

// Security headers - always applied
app.use(securityHeaders);
app.use(requestFingerprint);
app.use(securityLogger);

const mcpProxyPaths = ['/mcp', '/auth/token', '/execute', '/tools', '/health/auth', '/.well-known/mcp.json'];

// MCP proxy is internal-only. Accept requests only from loopback IPs or with
// a valid X-MCP-Auth header matching process.env.MCP_INTERNAL_TOKEN. External
// clients must never reach the MCP service directly via this proxy.
const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function isMcpRequestAuthorized(req: express.Request): boolean {
  const remoteIp = req.ip || req.socket?.remoteAddress || '';
  if (LOOPBACK_IPS.has(remoteIp)) {
    return true;
  }
  const token = process.env.MCP_INTERNAL_TOKEN;
  if (token) {
    const header = req.get('X-MCP-Auth');
    if (header && header === token) {
      return true;
    }
  }
  return false;
}

function proxyToMcp(req: express.Request, res: express.Response) {
  if (!isMcpRequestAuthorized(req)) {
    logger.warn('mcp_proxy_unauthorized', { ip: req.ip, path: req.originalUrl });
    return res.status(403).json({ error: 'Forbidden: MCP proxy is internal-only' });
  }
  const options: http.RequestOptions = {
    hostname: '127.0.0.1',
    port: MCP_PORT,
    path: req.originalUrl,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${MCP_PORT}` },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    logger.error('MCP proxy error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'MCP server unavailable' });
    }
  });

  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const body = JSON.stringify(req.body);
    proxyReq.setHeader('content-type', 'application/json');
    proxyReq.setHeader('content-length', Buffer.byteLength(body));
    proxyReq.write(body);
  }

  proxyReq.end();
}

for (const mcpPath of mcpProxyPaths) {
  app.all(mcpPath, proxyToMcp);
}
app.all('/mcp/manifest', proxyToMcp);
app.all('/mcp/tools', proxyToMcp);
app.all('/mcp/tools/list', proxyToMcp);
app.all('/mcp/tools/call', proxyToMcp);
app.all('/mcp/initialize', proxyToMcp);

// Health endpoint - MUST be registered BEFORE rate limiting and security checks
app.use('/api/health', healthRouter);

// Swagger UI is NOT exposed publicly in production. In non-production it is
// mounted under /api-docs for developer convenience.
if (!isProduction) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// Rate limiting - applied to all /api routes except health
app.use('/api', apiLimiter);

// Apply security checks with a strict, exact-match bypass allowlist.
// Previously `publicPaths.some(startsWith)` matched every path because '/'
// is a prefix of everything; only explicit system endpoints may skip.
const SECURITY_BYPASS_EXACT = new Set([
  '/api/health',
  '/api/metrics',
]);

function shouldBypassSecurityChecks(reqPath: string): boolean {
  if (SECURITY_BYPASS_EXACT.has(reqPath)) return true;
  if (reqPath === '/') return true;
  if (reqPath.startsWith('/api/mcp')) return true;
  return false;
}

app.use((req, res, next) => {
  if (shouldBypassSecurityChecks(req.path)) {
    return next();
  }
  validateRequestSize(req, res, () => {
    blockSuspiciousIPs(req, res, () => {
      detectMaliciousInput(req, res, () => {
        preventPathTraversal(req, res, next);
      });
    });
  });
});
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/admin', adminRouter);
app.use('/api/transactions', transactionRouter);
app.use('/api/ai', aiRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/cards', cardsRouter);
app.use('/api/savings', savingsRouter);
app.use('/api/rewards', rewardsRouter);
app.use('/api/checkout', cardCheckoutRouter);
app.use((req, res, next) => {
  const path = req.method === 'POST' ? req.originalUrl?.split('?')[0] : '';
  if (path === '/api/webhooks/payment' || path === '/api/webhooks/stripe') {
    return webhookLimiter(req, res, next);
  }
  next();
});
app.use('/api/webhooks', paymentWebhookRouter);
app.use('/api/super-admin/payments', paymentAdminRouter);
app.use('/api/legal', legalRouter);
app.use('/api/support', supportRouter);
app.use('/api/gift-cards', giftCardsRouter);
app.use('/api/withdraw', withdrawalRouter);
app.use('/api/crypto', cryptoRouter);
app.use('/api/swap', swapRouter);
app.use('/api/provider', fluzRouter);
app.use('/api/fluz', fluzRouter); // alias for frontend compatibility
app.use('/api/deposit-otp', depositOtpRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/referrals', referralsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/preferences', preferencesRouter);
app.use('/api/admin/analytics', adminAnalyticsRouter);
app.use('/api/admin/security', adminSecurityRouter);

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      error: {
        message: `API route ${req.method} ${req.originalUrl} not found`,
        code: 'NOT_FOUND',
      }
    });
  } else {
    next();
  }
});

const staticPath = path.join(__dirname, '../dist');
const staticPathExists = fs.existsSync(staticPath) && fs.existsSync(path.join(staticPath, 'index.html'));

if (staticPathExists) {
  // Cache hashed assets (JS/CSS) for 1 year, but never cache HTML
  app.use('/assets', express.static(path.join(staticPath, 'assets'), {
    maxAge: isProduction ? '365d' : 0,
    immutable: true,
  }));
  app.use(express.static(staticPath, {
    maxAge: 0,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    },
  }));

  app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(staticPath, 'index.html'));
    } else {
      next();
    }
  });

  logger.info(`Serving frontend from ${staticPath}`);
} else if (!isProduction) {
  app.get('/', (req, res) => {
    res.json({
      message: 'API is running. Frontend build not found.',
      hint: 'Run npm run build to generate the frontend, or access Vite dev server on port 5000'
    });
  });
}

app.use(errorHandler);

let server: http.Server | null = null;

async function startServer() {
  try {
    try {
      await initializeDatabase();
      logger.info('Database initialized successfully');
    } catch (dbError) {
      logger.error('Database initialization failed - Starting in OFFLINE MODE:', dbError);
    }

    initBackgroundJobs();
    logger.info('Background jobs initialized');

    // Create HTTP server and attach Socket.IO for real-time features
    const httpServer = http.createServer(app);
    initSocketIO(httpServer);

    server = httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`API documentation available at /api-docs`);
      logger.info(`Socket.IO real-time server active`);
    });

    server.on('error', (err) => {
      logger.error('Server listen error:', err);
      process.exitCode = 1;
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    // Do not exit, allow frontend to be served
  }
}

function gracefulShutdown(signal: string) {
  logger.info(`${signal} received; shutting down gracefully`);
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      void (pool as unknown as { end: () => Promise<void> }).end().catch((err: Error) => logger.error('Pool close error:', err));
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
