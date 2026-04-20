/**
 * Input Sanitizer Tests
 */
import { describe, it, expect } from 'vitest';
import { escapeHTML, sanitizeHTML, validateAndSanitizeInput } from '../inputSanitizer';

describe('Input Sanitizer', () => {
  describe('escapeHTML', () => {
    it('escapes ampersand', () => {
      expect(escapeHTML('a & b')).toBe('a &amp; b');
    });

    it('escapes less-than sign', () => {
      expect(escapeHTML('<script>')).toBe('&lt;script&gt;');
    });

    it('escapes greater-than sign', () => {
      expect(escapeHTML('1 > 0')).toBe('1 &gt; 0');
    });

    it('escapes double quotes', () => {
      expect(escapeHTML('"hello"')).toBe('&quot;hello&quot;');
    });

    it('escapes single quotes', () => {
      expect(escapeHTML("it's")).toBe('it&#039;s');
    });

    it('escapes all special characters in one string', () => {
      expect(escapeHTML('<a href="url">it\'s & fun</a>')).toBe(
        '&lt;a href=&quot;url&quot;&gt;it&#039;s &amp; fun&lt;/a&gt;'
      );
    });

    it('returns plain text unchanged', () => {
      expect(escapeHTML('hello world')).toBe('hello world');
    });

    it('handles empty string', () => {
      expect(escapeHTML('')).toBe('');
    });
  });

  describe('sanitizeHTML', () => {
    it('strips all tags when no allowed tags specified', () => {
      const result = sanitizeHTML('<p>Hello <b>World</b></p>');
      expect(result).not.toContain('<p>');
      expect(result).not.toContain('<b>');
    });

    it('strips script tags', () => {
      const result = sanitizeHTML('<script>alert("xss")</script>Hello');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('returns empty string for empty input', () => {
      const result = sanitizeHTML('');
      expect(result).toBe('');
    });
  });

  describe('validateAndSanitizeInput', () => {
    it('returns null for empty string', () => {
      expect(validateAndSanitizeInput('')).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
      expect(validateAndSanitizeInput('   ')).toBeNull();
    });

    it('returns null for null/undefined-like falsy input', () => {
      expect(validateAndSanitizeInput(null as any)).toBeNull();
    });

    it('returns null when input exceeds maxLength', () => {
      const longString = 'a'.repeat(1001);
      expect(validateAndSanitizeInput(longString, 1000)).toBeNull();
    });

    it('returns sanitized string for valid input', () => {
      const result = validateAndSanitizeInput('Hello World');
      expect(result).toBe('Hello World');
    });

    it('trims leading/trailing whitespace', () => {
      const result = validateAndSanitizeInput('  hello  ');
      expect(result).toBe('hello');
    });

    it('accepts input exactly at maxLength', () => {
      const exact = 'a'.repeat(100);
      const result = validateAndSanitizeInput(exact, 100);
      expect(result).not.toBeNull();
    });

    it('uses default maxLength of 1000', () => {
      const borderline = 'a'.repeat(1000);
      const result = validateAndSanitizeInput(borderline);
      expect(result).not.toBeNull();
      expect(validateAndSanitizeInput('a'.repeat(1001))).toBeNull();
    });
  });
});
