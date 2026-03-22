/**
 * Maps Fluz/GraphQL error messages to user-friendly messages.
 * Avoids exposing internal details while giving actionable feedback.
 */

const ERROR_PATTERNS: Array<{ pattern: RegExp | string; message: string }> = [
  { pattern: /insufficient.*balance|balance.*insufficient/i, message: 'Insufficient balance. Please add funds and try again.' },
  { pattern: /invalid.*offer|offer.*not found|offer.*invalid/i, message: 'This card offer is no longer available. Please refresh and select another.' },
  { pattern: /card.*locked|already locked/i, message: 'This card is already locked.' },
  { pattern: /card.*not found|card not found/i, message: 'Card not found. It may have been removed.' },
  { pattern: /unauthorized|token expired|invalid token/i, message: 'Session expired. Please sign in again.' },
  { pattern: /rate limit|too many requests/i, message: 'Too many requests. Please wait a moment and try again.' },
  { pattern: /spend limit|limit.*exceeded/i, message: 'Spend limit exceeded for this card.' },
  { pattern: /gift card.*already revealed|already revealed/i, message: 'This gift card code was already revealed.' },
  { pattern: /payment.*failed|payment declined/i, message: 'Payment was declined. Please check your payment method.' },
  { pattern: /invalid.*amount|amount.*invalid/i, message: 'Invalid amount. Please enter a valid value.' },
  { pattern: /min.*amount|minimum.*amount/i, message: 'Amount is below the minimum required.' },
  { pattern: /max.*amount|maximum.*amount/i, message: 'Amount exceeds the maximum allowed.' },
  { pattern: /not configured|credentials.*missing/i, message: 'Service is not fully configured. Please contact support.' },
  { pattern: /temporarily unavailable|service unavailable/i, message: 'Service is temporarily unavailable. Please try again in a few minutes.' },
];

/** Max length for passing through raw messages (avoid leaking internal details) */
const MAX_SAFE_MESSAGE_LENGTH = 120;

/**
 * Check if a string looks safe to show to users (no tokens, IDs, stack traces).
 * Length is handled separately via truncation.
 */
function isSafeToShow(raw: string): boolean {
  if (!raw) return false;
  const lower = raw.toLowerCase();
  if (lower.includes('bearer') || lower.includes('token') || lower.includes('uuid')) return false;
  if (lower.includes('at ') && /\d+:\d+/.test(raw)) return false; // stack trace
  return true;
}

/**
 * Get a user-friendly message from a Fluz/GraphQL error.
 * Falls back to generic message if raw text is unsafe or no pattern matches.
 */
export function getUserFriendlyMessage(
  rawMessage: string | undefined,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (!rawMessage || typeof rawMessage !== 'string') return fallback;
  const trimmed = rawMessage.trim();
  if (!trimmed) return fallback;

  for (const { pattern, message } of ERROR_PATTERNS) {
    const matches = typeof pattern === 'string'
      ? trimmed.toLowerCase().includes(pattern.toLowerCase())
      : pattern.test(trimmed);
    if (matches) return message;
  }

  if (isSafeToShow(trimmed)) {
    return trimmed.length > MAX_SAFE_MESSAGE_LENGTH
      ? trimmed.slice(0, MAX_SAFE_MESSAGE_LENGTH) + '…'
      : trimmed;
  }

  return fallback;
}
