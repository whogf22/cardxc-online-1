/**
 * @vitest-environment node
 * sanitizeLog tests
 */
import { describe, it, expect } from 'vitest';
import { sanitizeForLog, sanitizeApiError } from '../sanitizeLog';

describe('sanitizeForLog', () => {
  it('returns empty string for null', () => {
    expect(sanitizeForLog(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(sanitizeForLog(undefined)).toBe('');
  });

  it('returns plain string unchanged', () => {
    expect(sanitizeForLog('hello world')).toBe('hello world');
  });

  it('redacts Bearer tokens', () => {
    const result = sanitizeForLog('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def');
    expect(result).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(result).toContain('[REDACTED]');
  });

  it('redacts Basic auth credentials', () => {
    const result = sanitizeForLog('Authorization: Basic dXNlcjpwYXNz');
    expect(result).not.toContain('dXNlcjpwYXNz');
    expect(result).toContain('[REDACTED]');
  });

  it('redacts accessToken in JSON-like string', () => {
    const result = sanitizeForLog('{"accessToken":"tok_abc123"}');
    expect(result).not.toContain('tok_abc123');
    expect(result).toContain('[REDACTED]');
  });

  it('redacts password in JSON-like string', () => {
    const result = sanitizeForLog('{"password":"secretpass"}');
    expect(result).not.toContain('secretpass');
    expect(result).toContain('[REDACTED]');
  });

  it('redacts 16-digit card numbers', () => {
    const result = sanitizeForLog('Card: 4111111111111111');
    expect(result).not.toContain('4111111111111111');
  });

  it('redacts cardNumber field in JSON', () => {
    const result = sanitizeForLog('{"cardNumber":"4111111111111111"}');
    expect(result).not.toContain('"4111111111111111"');
    expect(result).toContain('****');
  });

  it('serializes plain objects to JSON before redacting', () => {
    const result = sanitizeForLog({ password: 'secret', name: 'John' });
    expect(result).not.toContain('secret');
    expect(result).toContain('John');
  });

  it('redacts 64-character hex strings (private keys)', () => {
    const hex64 = 'a'.repeat(64);
    const result = sanitizeForLog(`key=${hex64}`);
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain(hex64);
  });

  it('redacts secret field in JSON', () => {
    const result = sanitizeForLog('{"secret":"mysecretvalue"}');
    expect(result).not.toContain('mysecretvalue');
    expect(result).toContain('[REDACTED]');
  });
});

describe('sanitizeApiError', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeApiError('')).toBe('');
  });

  it('truncates long error text', () => {
    const long = 'x'.repeat(200);
    const result = sanitizeApiError(long, 100);
    expect(result.length).toBeLessThanOrEqual(103); // 100 chars + '...'
    expect(result).toContain('...');
  });

  it('keeps short error text intact', () => {
    const short = 'Bad request error';
    const result = sanitizeApiError(short, 100);
    expect(result).toBe(short);
  });

  it('redacts bearer tokens in error text', () => {
    const err = 'Error: Bearer abc123token';
    const result = sanitizeApiError(err, 100);
    expect(result).not.toContain('abc123token');
  });
});
