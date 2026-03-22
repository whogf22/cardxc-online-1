/**
 * Sanitize data before logging - prevent Fluz/API credentials from leaking.
 * Never log: API keys, tokens, Bearer/Basic auth, full error responses.
 */
const REDACT = '[REDACTED]';

const SENSITIVE_PATTERNS: [RegExp, string | ((match: string) => string)][] = [
  [/Bearer\s+[\w.-]+/gi, REDACT],
  [/Basic\s+[A-Za-z0-9+/=]+/gi, REDACT],
  [/"accessToken"\s*:\s*"[^"]+"/gi, '"accessToken":"[REDACTED]"'],
  [/"token"\s*:\s*"[^"]+"/gi, '"token":"[REDACTED]"'],
  [/"password"\s*:\s*"[^"]+"/gi, '"password":"[REDACTED]"'],
  [/"password_hash"\s*:\s*"[^"]+"/gi, '"password_hash":"[REDACTED]"'],
  [/"secret"\s*:\s*"[^"]+"/gi, '"secret":"[REDACTED]"'],
  [/"privateKey"\s*:\s*"[^"]+"/gi, '"privateKey":"[REDACTED]"'],
  [/"apiKey"\s*:\s*"[^"]+"/gi, '"apiKey":"[REDACTED]"'],
  [/"cardNumber"\s*:\s*"[^"]+"/gi, (m: string) => { const last4 = m.replace(/"/g, '').slice(-4); return `"cardNumber":"****${last4}"`; }],
  [/"card_number"\s*:\s*"[^"]+"/gi, (m: string) => { const last4 = m.replace(/"/g, '').slice(-4); return `"card_number":"****${last4}"`; }],
  [/"accountNumber"\s*:\s*"[^"]+"/gi, '"accountNumber":"[REDACTED]"'],
  [/"routingNumber"\s*:\s*"[^"]+"/gi, '"routingNumber":"[REDACTED]"'],
  [/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '**** **** **** ****'],
  [/\b(?<!\d)\d{13,19}(?!\d)\b/g, (m: string) => '****' + m.slice(-4)],
  [/\b(T[A-Za-z0-9]{33})\b/g, (m: string) => m.substring(0, 6) + '...' + m.substring(30)],
  [/\b(0x[a-fA-F0-9]{40})\b/g, (m: string) => m.substring(0, 8) + '...' + m.substring(38)],
  [/\b[A-Fa-f0-9]{64}\b/g, REDACT],
];

export function sanitizeForLog(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str: string;
  if (typeof value === 'object') {
    try {
      str = JSON.stringify(value);
    } catch {
      str = String(value);
    }
  } else {
    str = String(value);
  }
  let out = str;
  for (const [re, repl] of SENSITIVE_PATTERNS) {
    out = out.replace(re, repl as any);
  }
  return out;
}

/** Never log full API error - could contain tokens. Log only status + sanitized short prefix. */
export function sanitizeApiError(errorText: string, maxChars = 100): string {
  if (!errorText) return '';
  const truncated = errorText.length > maxChars ? errorText.substring(0, maxChars) + '...' : errorText;
  return sanitizeForLog(truncated);
}
