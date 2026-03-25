import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
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
import { initializeDatabase } from './db/init';
import { pool } from './db/pool';
import { swaggerSpec } from './config/swagger';
import { initBackgroundJobs } from './services/backgroundJobs';
import { initSocketIO } from './services/socketService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config();

function validateEnvironment() {
  const required = ['DATABASE_URL'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`[FATAL] Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (!process.env.SESSION_SECRET) {
    console.warn('[WARN] SESSION_SECRET not set, using default (not recommended for production)');
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
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://api.fontshare.com", "https://fonts.googleapis.com", "https://js.stripe.com"],
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
    if (!origin || allowedOrigins.some(allowed => {
      const cleanAllowed = allowed.replace(/^https?:\/\//, '');
      const cleanOrigin = origin.replace(/^https?:\/\//, '');
      return cleanOrigin === cleanAllowed || cleanOrigin.endsWith('.' + cleanAllowed);
    })) {
      callback(null, true);
    } else {
      callback(null, false);
    }
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

function proxyToMcp(req: express.Request, res: express.Response) {
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
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rate limiting - applied to all /api routes except health
app.use('/api', apiLimiter);

// Apply security checks conditionally (skip for health and docs)
app.use((req, res, next) => {
  const publicPaths = ['/api/health', '/api-docs', '/', '/mcp', '/auth/token', '/execute', '/tools', '/health', '/.well-known'];
  if (!publicPaths.some(path => req.path.startsWith(path))) {
    validateRequestSize(req, res, () => {
      blockSuspiciousIPs(req, res, () => {
        detectMaliciousInput(req, res, () => {
          preventPathTraversal(req, res, next);
        });
      });
    });
  } else {
    next();
  }
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
app.use('/api/deposit-otp', depositOtpRouter);

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
  app.use(express.static(staticPath, { maxAge: isProduction ? '1d' : 0 }));

  app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) {
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
