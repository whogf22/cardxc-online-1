/**
 * Centralized JWT secret resolution.
 *
 * Resolves from `SESSION_SECRET` (preferred) or `JWT_SECRET`. Throws at call time
 * if neither is set or if the resolved value is too short. The module MUST be
 * used by every JWT call site so there is a single source of truth.
 */

const MIN_SECRET_LENGTH = 32;

let cachedSecret: string | null = null;

/**
 * Resolve and validate the JWT secret from environment.
 * Throws if unset or shorter than 32 characters.
 */
export function getJwtSecret(): string {
  if (cachedSecret) {
    return cachedSecret;
  }

  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      'FATAL: SESSION_SECRET (or JWT_SECRET) environment variable is required. ' +
        'Set a cryptographically random value of at least 32 characters.',
    );
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `FATAL: SESSION_SECRET/JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters (got ${secret.length}).`,
    );
  }

  cachedSecret = secret;
  return cachedSecret;
}

/**
 * Test helper to reset the cache between tests.
 * Not exported as part of the public API — prefixed with underscore.
 */
export function _resetJwtSecretCacheForTests(): void {
  cachedSecret = null;
}
