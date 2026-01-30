/**
 * Centralized Error Handler
 * 
 * Normalizes backend errors into user-friendly messages.
 * Maps technical error codes to clear, actionable messages.
 * 
 * SECURITY:
 * - Hides sensitive error details from users
 * - Logs full errors for debugging
 * - Prevents information leakage
 */

export interface AppError {
  message: string;
  code?: string;
  technical?: string;
  retryable: boolean;
}

/**
 * Map backend error codes to user-friendly messages
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Authentication errors
  'auth/invalid-credentials': 'Invalid email or password. Please try again.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
  'auth/session-expired': 'Your session has expired. Please sign in again.',
  'auth/unauthorized': 'You are not authorized to perform this action.',
  
  // Wallet errors
  'wallet/insufficient-balance': 'Insufficient balance for this transaction.',
  'wallet/invalid-amount': 'Please enter a valid amount.',
  'wallet/minimum-not-met': 'Amount is below the minimum required.',
  'wallet/maximum-exceeded': 'Amount exceeds the maximum allowed.',
  'wallet/currency-not-supported': 'This currency is not supported.',
  
  // Withdrawal errors
  'withdrawal/pending-limit': 'You have reached the maximum number of pending withdrawals.',
  'withdrawal/daily-limit': 'Daily withdrawal limit exceeded.',
  'withdrawal/kyc-required': 'KYC verification required for withdrawals.',
  'withdrawal/account-suspended': 'Your account is suspended. Contact support.',
  'withdrawal/invalid-bank-details': 'Invalid bank account details.',
  
  // Network errors
  'network/timeout': 'Request timed out. Please check your connection and try again.',
  'network/offline': 'You appear to be offline. Please check your internet connection.',
  'network/server-error': 'Server error. Our team has been notified.',
  
  // Database errors
  'database/connection-failed': 'Unable to connect to database. Please try again.',
  'database/query-failed': 'Database query failed. Please try again.',
  
  // Validation errors
  'validation/invalid-email': 'Please enter a valid email address.',
  'validation/invalid-phone': 'Please enter a valid phone number.',
  'validation/required-field': 'This field is required.',
  'validation/invalid-format': 'Invalid format. Please check your input.',
};

/**
 * Parse and normalize errors from various sources
 */
export function normalizeError(error: any): AppError {
  console.error('🔴 [ErrorHandler] Raw error:', error);

  // Handle null/undefined
  if (!error) {
    return {
      message: 'An unexpected error occurred. Please try again.',
      retryable: true,
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      message: error,
      retryable: true,
    };
  }

  // Handle Error objects
  if (error instanceof Error) {
    const code = (error as any).code;
    const message = ERROR_MESSAGES[code] || error.message;
    
    return {
      message,
      code,
      technical: error.message,
      retryable: isRetryableError(code),
    };
  }

  // Handle Supabase errors
  if (error.error || error.message) {
    const errorMessage = error.error || error.message;
    const errorCode = error.code || error.error_code;
    
    // Check for known error codes
    const friendlyMessage = ERROR_MESSAGES[errorCode] || errorMessage;
    
    return {
      message: friendlyMessage,
      code: errorCode,
      technical: errorMessage,
      retryable: isRetryableError(errorCode),
    };
  }

  // Handle API Gateway errors
  if (error.status) {
    return handleHttpError(error.status, error.statusText || error.message);
  }

  // Fallback
  return {
    message: 'An unexpected error occurred. Please try again.',
    technical: JSON.stringify(error),
    retryable: true,
  };
}

/**
 * Handle HTTP status code errors
 */
function handleHttpError(status: number, message?: string): AppError {
  switch (status) {
    case 400:
      return {
        message: message || 'Invalid request. Please check your input.',
        code: 'http/bad-request',
        retryable: false,
      };
    case 401:
      return {
        message: 'Your session has expired. Please sign in again.',
        code: 'http/unauthorized',
        retryable: false,
      };
    case 403:
      return {
        message: 'You do not have permission to perform this action.',
        code: 'http/forbidden',
        retryable: false,
      };
    case 404:
      return {
        message: 'The requested resource was not found.',
        code: 'http/not-found',
        retryable: false,
      };
    case 429:
      return {
        message: 'Too many requests. Please wait a moment and try again.',
        code: 'http/rate-limit',
        retryable: true,
      };
    case 500:
    case 502:
    case 503:
    case 504:
      return {
        message: 'Server error. Please try again in a moment.',
        code: 'http/server-error',
        retryable: true,
      };
    default:
      return {
        message: message || 'An error occurred. Please try again.',
        code: `http/${status}`,
        retryable: true,
      };
  }
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(code?: string): boolean {
  if (!code) return true;
  
  const nonRetryableErrors = [
    'auth/invalid-credentials',
    'auth/user-not-found',
    'auth/wrong-password',
    'auth/unauthorized',
    'wallet/insufficient-balance',
    'withdrawal/kyc-required',
    'withdrawal/account-suspended',
    'validation/invalid-email',
    'validation/invalid-phone',
    'http/bad-request',
    'http/forbidden',
    'http/not-found',
  ];
  
  return !nonRetryableErrors.includes(code);
}

/**
 * Format error for display in UI
 */
export function formatErrorMessage(error: any): string {
  const normalized = normalizeError(error);
  return normalized.message;
}

/**
 * Check if error requires re-authentication
 */
export function requiresReauth(error: any): boolean {
  const normalized = normalizeError(error);
  const reauthCodes = [
    'auth/session-expired',
    'auth/unauthorized',
    'http/unauthorized',
  ];
  
  return reauthCodes.includes(normalized.code || '');
}
