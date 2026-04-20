/**
 * Locale Utilities Tests
 */
import { describe, it, expect } from 'vitest';
import {
  parseDateSafe,
  formatNumber,
  formatCurrencyAmount,
  getUserCountryCode,
  getUserLanguageCode,
  formatDate,
  formatTime,
  suggestCurrencyByCountry,
} from '../localeUtils';

describe('Locale Utilities', () => {
  describe('parseDateSafe', () => {
    it('returns null for null', () => {
      expect(parseDateSafe(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(parseDateSafe(undefined)).toBeNull();
    });

    it('parses valid ISO date string', () => {
      const result = parseDateSafe('2024-01-15T00:00:00Z');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
    });

    it('returns Date object unchanged when valid', () => {
      const d = new Date('2024-06-01');
      const result = parseDateSafe(d);
      expect(result).toBe(d);
    });

    it('returns null for invalid Date object', () => {
      expect(parseDateSafe(new Date('invalid'))).toBeNull();
    });

    it('parses Unix timestamp in milliseconds', () => {
      const ts = new Date('2024-01-01T00:00:00Z').getTime();
      const result = parseDateSafe(ts);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
    });

    it('returns null for non-parseable string', () => {
      expect(parseDateSafe('not-a-date')).toBeNull();
    });
  });

  describe('formatNumber', () => {
    it('formats integer with default options', () => {
      const result = formatNumber(1234567);
      expect(result).toMatch(/1[,.]?234[,.]?567/);
    });

    it('formats decimal number', () => {
      const result = formatNumber(3.14159);
      expect(result).toContain('3');
    });

    it('handles NaN gracefully', () => {
      const result = formatNumber(NaN);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('formats zero', () => {
      const result = formatNumber(0);
      expect(result).toContain('0');
    });

    it('respects maximumFractionDigits option', () => {
      const result = formatNumber(3.14159, { maximumFractionDigits: 2 });
      expect(result).not.toMatch(/\.\d{4,}/);
    });
  });

  describe('formatCurrencyAmount', () => {
    it('formats USD amount', () => {
      const result = formatCurrencyAmount(100, 'USD');
      expect(result).toContain('100');
      expect(result).toContain('$');
    });

    it('formats NGN amount', () => {
      const result = formatCurrencyAmount(5000, 'NGN');
      expect(result).toContain('5');
    });

    it('handles NaN gracefully', () => {
      const result = formatCurrencyAmount(NaN, 'USD');
      expect(typeof result).toBe('string');
    });

    it('handles empty currencyCode with fallback to USD', () => {
      const result = formatCurrencyAmount(50, '');
      expect(result).toContain('50');
    });

    it('includes 2 decimal places by default', () => {
      const result = formatCurrencyAmount(100, 'USD');
      expect(result).toMatch(/100\.00/);
    });
  });

  describe('getUserCountryCode', () => {
    it('returns a non-empty string', () => {
      const code = getUserCountryCode();
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThanOrEqual(2);
    });

    it('returns uppercase country code', () => {
      const code = getUserCountryCode();
      expect(code).toBe(code.toUpperCase());
    });
  });

  describe('getUserLanguageCode', () => {
    it('returns a lowercase language code', () => {
      const code = getUserLanguageCode();
      expect(typeof code).toBe('string');
      expect(code).toBe(code.toLowerCase());
    });

    it('returns a non-empty string', () => {
      expect(getUserLanguageCode().length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('formatDate', () => {
    it('returns fallback for null', () => {
      expect(formatDate(null)).toBe('—');
    });

    it('returns fallback for undefined', () => {
      expect(formatDate(undefined)).toBe('—');
    });

    it('formats a valid date string', () => {
      const result = formatDate('2024-06-15T00:00:00Z');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toBe('—');
    });

    it('formats a Date object', () => {
      const d = new Date('2024-01-15T00:00:00Z');
      const result = formatDate(d);
      expect(result).not.toBe('—');
      expect(result).toContain('2024');
    });
  });

  describe('formatTime', () => {
    it('returns fallback for null', () => {
      expect(formatTime(null)).toBe('—');
    });

    it('formats a valid date', () => {
      const result = formatTime(new Date('2024-01-15T14:30:00Z'));
      expect(typeof result).toBe('string');
      expect(result).not.toBe('—');
    });
  });

  describe('suggestCurrencyByCountry', () => {
    it('returns a valid currency code', () => {
      const code = suggestCurrencyByCountry();
      expect(['USD', 'NGN', 'BDT']).toContain(code);
    });
  });
});
