import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { isDatabaseConnectionError } from '../db/pool';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;
  
  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(err: Error | AppError, req: Request, res: Response, _next: NextFunction) {
  if (isDatabaseConnectionError(err)) {
    logger.error('Database connection error', {
      message: err.message,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    return res.status(503).json({
      success: false,
      error: {
        message: 'Service temporarily unavailable. Please try again later.',
        code: 'SERVICE_UNAVAILABLE',
      }
    });
  }

  const statusCode = (err as AppError).statusCode || 500;
  const isOperational = (err as AppError).isOperational || false;
  
  logger.error('Error occurred', {
    message: err.message,
    stack: err.stack,
    statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
    isOperational,
  });
  
  if (isOperational) {
    res.status(statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: (err as AppError).code,
      }
    });
  } else {
    res.status(500).json({
      success: false,
      error: {
        message: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      }
    });
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code: 'NOT_FOUND',
    }
  });
}

export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
