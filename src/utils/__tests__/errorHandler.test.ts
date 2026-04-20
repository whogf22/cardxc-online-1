/**
 * Error Handler Tests (client-side)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeError, formatErrorMessage, requiresReauth } from '../errorHandler';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('normalizeError', () => {
  it('returns generic error for null', () => {
    const result = normalizeError(null);
    expect(result.message).toContain('unexpected error');
    expect(result.retryable).toBe(true);
  });

  it('returns generic error for undefined', () => {
    const result = normalizeError(undefined);
    expect(result.message).toContain('unexpected error');
    expect(result.retryable).toBe(true);
  });

  it('returns string error message as-is', () => {
    const result = normalizeError('Something went wrong');
    expect(result.message).toBe('Something went wrong');
    expect(result.retryable).toBe(true);
  });

  it('maps known error code from Error object', () => {
    const err = Object.assign(new Error('Internal'), { code: 'auth/invalid-credentials' });
    const result = normalizeError(err);
    expect(result.message).toBe('Invalid email or password. Please try again.');
    expect(result.code).toBe('auth/invalid-credentials');
    expect(result.retryable).toBe(false);
  });

  it('uses error.message when code is unknown', () => {
    const result = normalizeError(new Error('Custom error'));
    expect(result.message).toBe('Custom error');
    expect(result.retryable).toBe(true);
  });

  it('handles object with message property', () => {
    const result = normalizeError({ message: 'Auth failed', code: 'auth/unauthorized' });
    expect(result.message).toBe('You are not authorized to perform this action.');
    expect(result.retryable).toBe(false);
  });

  it('handles HTTP 401 status', () => {
    const result = normalizeError({ status: 401 });
    expect(result.message).toContain('session');
    expect(result.code).toBe('http/unauthorized');
    expect(result.retryable).toBe(false);
  });

  it('handles HTTP 403 status', () => {
    const result = normalizeError({ status: 403 });
    expect(result.message).toContain('permission');
    expect(result.code).toBe('http/forbidden');
    expect(result.retryable).toBe(false);
  });

  it('handles HTTP 404 status', () => {
    const result = normalizeError({ status: 404 });
    expect(result.message).toContain('not found');
    expect(result.retryable).toBe(false);
  });

  it('handles HTTP 429 rate limit', () => {
    const result = normalizeError({ status: 429 });
    expect(result.message).toContain('Too many');
    expect(result.retryable).toBe(true);
  });

  it('handles HTTP 500 server error', () => {
    const result = normalizeError({ status: 500 });
    expect(result.message).toContain('Server error');
    expect(result.retryable).toBe(true);
  });

  it('handles HTTP 503 server error', () => {
    const result = normalizeError({ status: 503 });
    expect(result.retryable).toBe(true);
  });

  it('handles HTTP 400 bad request', () => {
    const result = normalizeError({ status: 400 });
    expect(result.retryable).toBe(false);
  });

  it('maps wallet/insufficient-balance as non-retryable', () => {
    const err = Object.assign(new Error('Insufficient funds'), { code: 'wallet/insufficient-balance' });
    const result = normalizeError(err);
    expect(result.message).toBe('Insufficient balance for this transaction.');
    expect(result.retryable).toBe(false);
  });

  it('maps network/timeout as retryable', () => {
    const err = Object.assign(new Error('Timeout'), { code: 'network/timeout' });
    const result = normalizeError(err);
    expect(result.retryable).toBe(true);
  });

  it('returns fallback for unknown objects', () => {
    const result = normalizeError({ unknown: 'data' });
    expect(result.message).toContain('unexpected error');
  });
});

describe('formatErrorMessage', () => {
  it('returns string message from error', () => {
    const msg = formatErrorMessage(new Error('Test error'));
    expect(typeof msg).toBe('string');
    expect(msg).toBe('Test error');
  });

  it('returns friendly message for known code', () => {
    const err = Object.assign(new Error(), { code: 'auth/session-expired' });
    expect(formatErrorMessage(err)).toBe('Your session has expired. Please sign in again.');
  });
});

describe('requiresReauth', () => {
  it('returns true for auth/session-expired', () => {
    const err = Object.assign(new Error(), { code: 'auth/session-expired' });
    expect(requiresReauth(err)).toBe(true);
  });

  it('returns true for http/unauthorized (401)', () => {
    expect(requiresReauth({ status: 401 })).toBe(true);
  });

  it('returns false for non-auth error', () => {
    const err = Object.assign(new Error('fail'), { code: 'wallet/insufficient-balance' });
    expect(requiresReauth(err)).toBe(false);
  });

  it('returns false for generic error', () => {
    expect(requiresReauth(new Error('oops'))).toBe(false);
  });
});
