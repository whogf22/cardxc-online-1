import { Router, Request, Response } from 'express';
import { queryOne } from '../db/pool';
import { logger } from '../middleware/logger';
import { isFluzConfigured, testFluzConnection } from '../services/fluzClient';
import os from 'os';

const router = Router();

const startTime = Date.now();

// Basic health check
router.get('/', async (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
});

// Detailed health check (for monitoring systems)
router.get('/detailed', async (req: Request, res: Response) => {
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {};
  let overallStatus = 'healthy';

  // Database check
  const dbStart = Date.now();
  try {
    await queryOne('SELECT 1 as check');
    checks.database = {
      status: 'healthy',
      latency: Date.now() - dbStart,
    };
  } catch (err: any) {
    checks.database = {
      status: 'unhealthy',
      error: err.message,
    };
    overallStatus = 'degraded';
  }

  // Memory check
  const memoryUsage = process.memoryUsage();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const memoryUsedPercent = ((totalMemory - freeMemory) / totalMemory) * 100;

  checks.memory = {
    status: memoryUsedPercent > 90 ? 'warning' : 'healthy',
  };

  if (memoryUsedPercent > 95) {
    overallStatus = 'degraded';
  }

  // Disk check (basic)
  checks.system = {
    status: 'healthy',
  };

  res.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks,
    metrics: {
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
      },
      system: {
        loadAverage: os.loadavg(),
        cpuCount: os.cpus().length,
        freeMemoryMB: Math.round(freeMemory / 1024 / 1024),
        totalMemoryMB: Math.round(totalMemory / 1024 / 1024),
      },
    },
  });
});

// Readiness check (for Kubernetes/load balancers)
router.get('/ready', async (req: Request, res: Response) => {
  try {
    await queryOne('SELECT 1 as check');
    res.json({ ready: true });
  } catch (err) {
    res.status(503).json({ ready: false, error: 'Database not available' });
  }
});

// Liveness check
router.get('/live', (req: Request, res: Response) => {
  res.json({ live: true, uptime: Math.floor((Date.now() - startTime) / 1000) });
});

// Version info
router.get('/version', (req: Request, res: Response) => {
  res.json({
    version: process.env.npm_package_version || '1.0.0',
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    buildTime: process.env.BUILD_TIME || 'unknown',
  });
});

router.get('/provider', async (req: Request, res: Response) => {
  if (!isFluzConfigured()) {
    return res.json({ provider: 'not_configured' });
  }
  const result = await testFluzConnection();
  if (result.success) {
    return res.json({ provider: 'ok' });
  }
  res.status(503).json({ provider: 'unreachable', error: result.error });
});

export { router as healthRouter };
