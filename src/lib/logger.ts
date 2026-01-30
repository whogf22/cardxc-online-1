// Logger utility - production-safe logging with sensitive data sanitization

const isDevelopment = import.meta.env.DEV;

const SENSITIVE_PATTERNS = [
  /(token|access_token|refresh_token|api_key|secret|password|auth|authorization)/i,
  /(bearer\s+)[a-zA-Z0-9._-]+/i,
  /(eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)/,
];

function sanitizeLogData(args: unknown[]): unknown[] {
  return args.map(arg => {
    if (typeof arg === 'string') {
      let sanitized = arg;
      sanitized = sanitized.replace(/(eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)/g, '[JWT_REDACTED]');
      sanitized = sanitized.replace(/(bearer\s+)[a-zA-Z0-9._-]+/gi, '$1[REDACTED]');
      for (const pattern of SENSITIVE_PATTERNS) {
        if (pattern.test(sanitized)) {
          return '[SENSITIVE_DATA_REDACTED]';
        }
      }
      return sanitized;
    }
    
    if (typeof arg === 'object' && arg !== null) {
      try {
        const obj = arg as Record<string, unknown>;
        const sanitized: Record<string, unknown> = {};
        
        for (const [key, value] of Object.entries(obj)) {
          const lowerKey = key.toLowerCase();
          
          if (lowerKey.includes('token') || 
              lowerKey.includes('auth') || 
              lowerKey.includes('password') || 
              lowerKey.includes('secret') ||
              lowerKey.includes('key') && lowerKey.includes('api')) {
            sanitized[key] = '[REDACTED]';
            continue;
          }
          
          if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeLogData([value])[0];
          } else if (typeof value === 'string') {
            sanitized[key] = sanitizeLogData([value])[0];
          } else {
            sanitized[key] = value;
          }
        }
        
        return sanitized;
      } catch {
        return '[OBJECT_REDACTED]';
      }
    }
    
    return arg;
  });
}

export const logger = {
  log: (...args: unknown[]): void => {
    if (isDevelopment) {
      const sanitized = sanitizeLogData(args);
      console.log(...sanitized);
    }
  },

  info: (...args: unknown[]): void => {
    if (isDevelopment) {
      const sanitized = sanitizeLogData(args);
      console.info(...sanitized);
    }
  },

  warn: (...args: unknown[]): void => {
    if (isDevelopment) {
      const sanitized = sanitizeLogData(args);
      console.warn(...sanitized);
    }
  },

  error: (...args: unknown[]): void => {
    const sanitized = sanitizeLogData(args);
    console.error(...sanitized);
  },

  debug: (...args: unknown[]): void => {
    if (isDevelopment) {
      const sanitized = sanitizeLogData(args);
      console.debug(...sanitized);
    }
  },

  group: (label?: string): void => {
    if (isDevelopment) {
      console.group(label);
    }
  },

  groupEnd: (): void => {
    if (isDevelopment) {
      console.groupEnd();
    }
  },

  table: (data: unknown): void => {
    if (isDevelopment) {
      const sanitized = sanitizeLogData([data])[0];
      console.table(sanitized);
    }
  },
};

export function createLogger(prefix: string) {
  return {
    log: (...args: unknown[]) => logger.log(`[${prefix}]`, ...args),
    info: (...args: unknown[]) => logger.info(`[${prefix}]`, ...args),
    warn: (...args: unknown[]) => logger.warn(`[${prefix}]`, ...args),
    error: (...args: unknown[]) => logger.error(`[${prefix}]`, ...args),
    debug: (...args: unknown[]) => logger.debug(`[${prefix}]`, ...args),
  };
}

export default logger;
