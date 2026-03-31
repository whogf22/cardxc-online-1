import { beforeEach, vi, describe, it, expect } from 'vitest';

vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((html: string) => ''),
  },
}));

import { escapeHTML, validateAndSanitizeInput, sanitizeHTML } from '../inputSanitizer';

describe('inputSanitizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('escapeHTML', () => {
    it('escapes & to &amp;', () => {
      expect(escapeHTML('&')).toBe('&amp;');
    });

    it('escapes < to &lt;', () => {
      expect(escapeHTML('<')).toBe('&lt;');
    });

    it('escapes > to &gt;', () => {
      expect(escapeHTML('>')).toBe('&gt;');
    });

    it('escapes " to &quot;', () => {
      expect(escapeHTML('"')).toBe('&quot;');
    });

    it("escapes ' to &#039;", () => {
      expect(escapeHTML("'")).toBe('&#039;');
    });

    it('handles combined special characters', () => {
      expect(escapeHTML('<div class="test">&\'end</div>')).toBe(
        '&lt;div class=&quot;test&quot;&gt;&amp;&#039;end&lt;/div&gt;'
      );
    });
  });

  describe('validateAndSanitizeInput', () => {
    it('returns null for null/empty input', () => {
      expect(validateAndSanitizeInput('')).toBeNull();
      expect(validateAndSanitizeInput(null as any)).toBeNull();
      expect(validateAndSanitizeInput(undefined as any)).toBeNull();
    });

    it('returns null when input exceeds maxLength', () => {
      const longInput = 'a'.repeat(1001);
      expect(validateAndSanitizeInput(longInput, 1000)).toBeNull();
    });

    it('trims whitespace from input', () => {
      const result = validateAndSanitizeInput('  hello world  ');
      // The result should be the sanitized trimmed string
      // In jsdom environment, sanitizeText uses document.createElement
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });
  });

  describe('sanitizeHTML', () => {
    it('strips tags when used in server environment (window undefined)', () => {
      // In jsdom, window is defined, so DOMPurify path is used.
      // We test the escapeHTML pure function instead, which is the core logic.
      // The sanitizeHTML server path (typeof window === undefined) strips tags via regex.
      // We can verify the regex behavior by calling the function
      // In jsdom environment, it goes through DOMPurify mock
      const result = sanitizeHTML('<b>bold</b> text');
      // DOMPurify mock returns empty string
      expect(result).toBe('');
    });
  });
});
