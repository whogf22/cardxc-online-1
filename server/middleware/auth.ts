import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../db/pool';
import { AppError } from './errorHandler';
import { getJwtSecret } from '../lib/jwtSecret';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'USER' | 'SUPER_ADMIN';
    sessionId: string;
  };
}

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const token = req.cookies.auth_token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }
    
    let decoded: any;
    try {
      decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
    } catch {
      throw new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
    }
    
    const session = await queryOne(`
      SELECT s.*, u.email, u.role, u.account_status 
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = $1 AND s.is_active = TRUE AND s.expires_at > NOW()
    `, [decoded.sessionId]);
    
    if (!session) {
      throw new AppError('Session expired or invalid', 401, 'SESSION_INVALID');
    }
    
    if (session.account_status !== 'active') {
      throw new AppError('Account is not active', 403, 'ACCOUNT_INACTIVE');
    }
    
    await queryOne('UPDATE sessions SET last_used_at = NOW() WHERE id = $1', [decoded.sessionId]);
    
    req.user = {
      id: decoded.userId,
      email: session.email,
      role: session.role as 'USER' | 'SUPER_ADMIN',
      sessionId: decoded.sessionId,
    };
    
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: ('USER' | 'SUPER_ADMIN')[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }
    
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
    }
    
    next();
  };
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  return requireRole('SUPER_ADMIN')(req, res, next);
}

export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  return requireRole('SUPER_ADMIN')(req, res, next);
}
