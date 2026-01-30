import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
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
import { initializeDatabase } from './db/init';
import { swaggerSpec } from './config/swagger';
import { initBackgroundJobs } from './services/backgroundJobs';

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
const PORT = parseInt(process.env.PORT || '3001', 10);
const MCP_PORT = parseInt(process.env.MCP_PORT || '8080', 10);
const isProduction = process.env.NODE_ENV === 'production';

// Port conflict resolution for Replit Agent
if (process.env.REPL_ID && PORT === 5000) {
  logger.warn('Port 5000 conflict detected, fallback to 3001');
}

const allowedOrigins = [
  'http://localhost:5000',
  'http://localhost:5173',
  process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '',
  ...(process.env.REPLIT_DOMAINS?.split(',').map(d => `https://${d}`) || []),
].filter(Boolean);

// Enhanced security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://api.fontshare.com", "https://fonts.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://api.fontshare.com", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://api.fontshare.com", "https://fonts.gstatic.com", "https://cdn.fontshare.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://api.exchangerate-api.com"],
      frameSrc: ["'none'"],
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

// Stricter body parsing limits
app.use(express.json({ 
  limit: '50kb', // Increased slightly but still restrictive
  strict: true, // Only parse arrays and objects
  type: 'application/json',
}));
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

// Health endpoint - MUST be registered BEFORE rate limiting and security checks
app.use('/api/health', healthRouter);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rate limiting - applied to all /api routes except health
app.use('/api', apiLimiter);

// Apply security checks conditionally (skip for health and docs)
app.use((req, res, next) => {
  const publicPaths = ['/api/health', '/api-docs', '/'];
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
app.use('/api/webhooks', paymentWebhookRouter);
app.use('/api/super-admin/payments', paymentAdminRouter);

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

async function startServer() {
  try {
    await initializeDatabase();
    logger.info('Database initialized successfully');
    
    initBackgroundJobs();
    logger.info('Background jobs initialized');
    
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`API documentation available at /api-docs`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
