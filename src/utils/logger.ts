/**
 * Production-Safe Logger
 * 
 * Only logs in development mode.
 * In production, logs are suppressed for security and performance.
 */

const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },
  error: (...args: any[]) => {
    // Always log errors, but sanitize in production
    if (isDev) {
      console.error(...args);
    } else {
      // In production, only log to error tracking service (Sentry, etc.)
      // Don't expose sensitive information
      console.error('[Error] An error occurred. Please contact support.');
    }
  },
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },
  info: (...args: any[]) => {
    if (isDev) {
      console.info(...args);
    }
  },
  debug: (...args: any[]) => {
    if (isDev) {
      console.debug(...args);
    }
  },
};
