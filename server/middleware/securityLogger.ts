import { Request, Response } from 'express';
import { logger } from './logger';
import { query } from '../db/pool';

interface SecurityEvent {
  id?: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  ip: string;
  userAgent: string;
  path: string;
  method: string;
  userId?: string;
  details: Record<string, any>;
  riskScore?: number;
  timestamp: Date;
}

/**
 * Log a security event to both the console/file logger and the persistent database.
 */
export async function logSecurityEvent(
  type: string,
  severity: SecurityEvent['severity'],
  req: Request,
  details: Record<string, any> = {},
  options: { riskScore?: number } = {}
) {
  const event: SecurityEvent = {
    type,
    severity,
    ip: req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
    path: req.path,
    method: req.method,
    userId: (req as any).user?.id,
    details,
    riskScore: options.riskScore || 0,
    timestamp: new Date(),
  };

  // 1. Log to console/file
  const logMessage = `[Security] ${type} - ${severity.toUpperCase()}: ${event.ip} -> ${event.method} ${event.path}`;

  switch (severity) {
    case 'critical':
      logger.error(logMessage, event);
      break;
    case 'high':
      logger.warn(logMessage, event);
      break;
    case 'medium':
      logger.info(logMessage, event);
      break;
    case 'low':
      logger.debug(logMessage, event);
      break;
  }

  // 2. Persist to Database (Async, don't block the request)
  try {
    query(`
      INSERT INTO security_events (
        user_id, type, severity, ip_address, user_agent, path, method, details, risk_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      event.userId || null,
      event.type,
      event.severity,
      event.ip,
      event.userAgent,
      event.path,
      event.method,
      JSON.stringify(event.details),
      event.riskScore
    ]).catch(err => {
      logger.error('[Security] Database persistence failed:', err);
    });
  } catch (err) {
    // Top-level catch to prevent any DB failure from crashing the app
  }

  return event;
}

/**
 * Middleware to intercept and log suspicious HTTP status codes.
 */
export function securityLogger(req: Request, res: Response, next: any) {
  const originalSend = res.send;

  res.send = function (body: any) {
    if (res.statusCode >= 400) {
      const severity = res.statusCode >= 500 ? 'high' :
        res.statusCode === 401 || res.statusCode === 403 ? 'medium' : 'low';

      void logSecurityEvent(
        `HTTP_${res.statusCode}`,
        severity,
        req,
        {
          statusCode: res.statusCode,
          response: typeof body === 'string' ? body.substring(0, 200) : 'object'
        }
      );
    }

    return originalSend.call(this, body);
  };

  next();
}

/**
 * Fetch security events from the database.
 */
export async function getSecurityEvents(limit = 100): Promise<any[]> {
  try {
    return await query(`
      SELECT * FROM security_events 
      ORDER BY created_at DESC 
      LIMIT $1
    `, [limit]);
  } catch (err) {
    logger.error('[Security] Failed to fetch events:', err);
    return [];
  }
}

/**
 * Fetch security events by type.
 */
export async function getSecurityEventsByType(type: string, limit = 50): Promise<any[]> {
  try {
    return await query(`
      SELECT * FROM security_events 
      WHERE type = $1
      ORDER BY created_at DESC 
      LIMIT $2
    `, [type, limit]);
  } catch (err) {
    logger.error('[Security] Failed to fetch events by type:', err);
    return [];
  }
}

/**
 * Fetch security events by IP.
 */
export async function getSecurityEventsByIP(ip: string, limit = 50): Promise<any[]> {
  try {
    return await query(`
      SELECT * FROM security_events 
      WHERE ip_address = $1
      ORDER BY created_at DESC 
      LIMIT $2
    `, [ip, limit]);
  } catch (err) {
    logger.error('[Security] Failed to fetch events by IP:', err);
    return [];
  }
}
