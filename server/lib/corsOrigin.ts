/**
 * CORS origin allowlisting.
 *
 * Extracted from `server/index.ts` so the matching rules are unit-testable —
 * see `server/lib/__tests__/corsOrigin.test.ts`.
 *
 * SECURITY — two rules are load-bearing:
 *
 *  1. Loopback origins are development-only. They used to be hardcoded with no
 *     environment guard, which meant production granted credentialed CORS to
 *     any page a victim happened to be serving on localhost:5000/5173.
 *
 *  2. Origins are compared in full, scheme included. The previous matcher
 *     stripped `https?://` from both sides before comparing, so an attacker on
 *     `http://cardxc.online` inherited the allowance granted to
 *     `https://cardxc.online`.
 *
 * Because the API runs with `credentials: true`, any origin that matches here
 * can read authenticated responses. Keep this list exact — no subdomain
 * wildcards, no prefix or suffix matching.
 */

/** Loopback origins used by the Vite dev server and the local API. */
const DEV_ORIGINS = ['http://localhost:5000', 'http://localhost:5173'];

type OriginEnv = {
  REPLIT_DEV_DOMAIN?: string;
  REPLIT_DOMAINS?: string;
};

/**
 * Prefix a bare domain with https://; leave an explicit scheme untouched.
 *
 * In production an explicit `http://` entry is DROPPED rather than honoured: a
 * cleartext allowlist entry would hand out credentialed CORS over plain HTTP,
 * which is the downgrade that scheme-exact matching exists to prevent. Outside
 * production it is kept so local non-TLS hosts still work.
 */
function normaliseConfiguredOrigin(value: string, isProduction: boolean): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (/^http:\/\//i.test(trimmed)) {
    return isProduction ? '' : trimmed;
  }

  return /^https:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Build the exact set of origins permitted to make credentialed requests.
 *
 * @param env          Environment-like object (`process.env` in production).
 * @param isProduction When true, loopback origins are excluded.
 */
export function buildAllowedOrigins(env: OriginEnv, isProduction: boolean): string[] {
  // REPLIT_DEV_DOMAIN is a development PREVIEW host, the same class of thing as
  // loopback — a production deploy that inherits a stale value must not hand it
  // credentialed CORS. Only REPLIT_DOMAINS is honoured in production.
  const configured = [
    !isProduction && env.REPLIT_DEV_DOMAIN
      ? normaliseConfiguredOrigin(env.REPLIT_DEV_DOMAIN, isProduction)
      : '',
    ...(env.REPLIT_DOMAINS || '')
      .split(',')
      .map((d) => normaliseConfiguredOrigin(d, isProduction)),
  ];

  // Loopback is added only outside production. In production an unconfigured
  // deployment ends up with an empty allowlist, which fails closed.
  const origins = isProduction ? configured : [...DEV_ORIGINS, ...configured];

  return Array.from(new Set(origins.filter(Boolean)));
}

/**
 * Exact origin match. Scheme, host and port must all agree.
 *
 * Per RFC 6454 an origin's scheme and host are case-insensitive, so the
 * comparison is lowercased — but nothing else is normalised away. A trailing
 * slash, an added port, or a differing scheme is a different origin and is
 * rejected.
 *
 * Callers handle the no-Origin case (non-browser clients) separately; an
 * absent origin is not "allowed" here.
 */
export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[],
): boolean {
  if (!origin) return false;
  const candidate = origin.toLowerCase();
  return allowedOrigins.some((allowed) => allowed.toLowerCase() === candidate);
}
