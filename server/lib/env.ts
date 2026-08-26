/**
 * Environment-mode helpers.
 *
 * CONFIRMED LOW — the codebase compared `process.env.NODE_ENV === 'production'`
 * in ~16 places. That comparison is case- and whitespace-sensitive, so a
 * deployment configured with `NODE_ENV=PRODUCTION` (or `Production`, or a value
 * with stray whitespace from a CI variable) is NOT recognised as production and
 * every production-only protection silently downgrades:
 *
 *   - mandatory KYC for card checkout stops being mandatory
 *   - the unconfirmed-deposit bypass becomes reachable
 *   - session cookies lose the Secure flag
 *   - database TLS and SMTP certificate verification are relaxed
 *   - error responses start including stack traces
 *   - rate limits fall back to the permissive dev values
 *
 * Every one of those fails OPEN, which is why a cosmetic-looking string
 * comparison is a real hardening gap. These helpers normalise before comparing.
 */

/** Normalised NODE_ENV: trimmed and lower-cased, '' when unset. */
export function nodeEnv(env: NodeJS.ProcessEnv = process.env): string {
  return String(env.NODE_ENV ?? '').trim().toLowerCase();
}

/**
 * True when this process is running in production.
 *
 * Accepts the conventional 'production' plus the common 'prod' shorthand, in any
 * casing and with surrounding whitespace tolerated. Anything else — including
 * unset — is not production.
 */
export function isProductionEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = nodeEnv(env);
  return v === 'production' || v === 'prod';
}

/** Convenience inverse, for call sites that read better as a dev check. */
export function isNonProductionEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return !isProductionEnv(env);
}
