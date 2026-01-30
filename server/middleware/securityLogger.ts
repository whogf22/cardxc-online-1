import { Request, Response } from 'express';
import { logger } from './logger';

interface SecurityEvent {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  ip: string;
  userAgent: string;
  path: string;
  method: string;
  userId?: string;
  details: Record<string, any>;
  timestamp: Date;
}

const securityEvents: SecurityEvent[] = [];
const MAX_EVENTS = 1000; // Keep last 1000 events in memory

export function logSecurityEvent(
  type: string,
  severity: SecurityEvent['severity'],
  req: Request,
  details: Record<string, any> = {}
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
    timestamp: new Date(),
  };
  
  securityEvents.push(event);
  
  // Keep only last MAX_EVENTS
  if (securityEvents.length > MAX_EVENTS) {
    securityEvents.shift();
  }
  
  // Log based on severity
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
  
  return event;
}

export function getSecurityEvents(limit = 100): SecurityEvent[] {
  return securityEvents.slice(-limit).reverse();
}

export function getSecurityEventsByType(type: string, limit = 100): SecurityEvent[] {
  return securityEvents
    .filter(e => e.type === type)
    .slice(-limit)
    .reverse();
}

export function getSecurityEventsByIP(ip: string, limit = 100): SecurityEvent[] {
  return securityEvents
    .filter(e => e.ip === ip)
    .slice(-limit)
    .reverse();
}

// Middleware to log suspicious requests
export function securityLogger(req: Request, res: Response, next: any) {
  const originalSend = res.send;
  
  res.send = function (body: any) {
    // Log 4xx and 5xx responses as potential security events
    if (res.statusCode >= 400) {
      const severity = res.statusCode >= 500 ? 'high' : 
                      res.statusCode === 401 || res.statusCode === 403 ? 'medium' : 'low';
      
      logSecurityEvent(
        `HTTP_${res.statusCode}`,
        severity,
        req,
        { statusCode: res.statusCode, response: typeof body === 'string' ? body.substring(0, 200) : 'object' }
      );
    }
    
    return originalSend.call(this, body);
  };
  
  next();
}
