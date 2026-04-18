// Input sanitization utilities - prevents XSS attacks

import DOMPurify from 'dompurify';

export function sanitizeHTML(html: string, allowTags: string[] = []): string {
  if (typeof window === 'undefined') {
    return html.replace(/<[^>]*>/g, '');
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: allowTags.length > 0 ? allowTags : [],
    ALLOWED_ATTR: [],
  });
}

/**
 * HTML-entity-encode a string for safe insertion into an HTML attribute value
 * (e.g. `title="..."`, `alt="..."`).
 *
 * SECURITY: Do NOT use this result with `textContent` — it would double-encode
 * (`&amp;` would render literally). For textContent use `escapeHTML` or just
 * assign the raw string to `textContent` directly.
 */
export function escapeForHTMLAttribute(text: string): string {
  if (typeof window === 'undefined') {
    return text;
  }

  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function escapeHTML(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return text.replace(/[&<>"']/g, (m) => map[m]);
}

export function validateAndSanitizeInput(input: string, maxLength: number = 1000): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  if (trimmed.length === 0 || trimmed.length > maxLength) {
    return null;
  }

  return escapeForHTMLAttribute(trimmed);
}
