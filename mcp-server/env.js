/**
 * R3-6 — environment and TLS policy for the MCP servers.
 *
 * `mcp-server/**` still compared `process.env.NODE_ENV === 'production'`
 * literally in two places, each selecting `{ rejectUnauthorized: false }`
 * otherwise. That comparison is case- and whitespace-sensitive, so
 * `NODE_ENV=PRODUCTION`, `Production`, a value with stray CI whitespace, or an
 * unset value all took the insecure branch: the MCP server's PostgreSQL
 * connection accepted any certificate, exposing credentials and query traffic to
 * an active MITM. `server/**` was migrated to a normalising helper; `mcp-server/**`
 * was not.
 *
 * Policy here is fail-CLOSED, which is the opposite of what the literal
 * comparison did:
 *   - certificate verification is ON by default, including when NODE_ENV is unset;
 *   - turning it OFF requires an explicit opt-in (MCP_ALLOW_INSECURE_DB_TLS=true);
 *   - that opt-in is IGNORED in production, and ignored for any target that is
 *     not a local host, so it cannot be used to weaken a real deployment.
 */

/** Normalised NODE_ENV: trimmed and lower-cased, '' when unset. */
export function nodeEnv(env = process.env) {
  return String(env.NODE_ENV ?? "").trim().toLowerCase();
}

/**
 * True when this process is running in production. Accepts the conventional
 * 'production' plus the common 'prod' shorthand, in any casing, with surrounding
 * whitespace tolerated. A value that merely CONTAINS "production" does not match.
 */
export function isProductionEnv(env = process.env) {
  const v = nodeEnv(env);
  return v === "production" || v === "prod";
}

/** Hosts for which a self-signed certificate is a plausible developer setup. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "[::1]"]);

/**
 * Whether a connection string points at a local development database.
 * Unparseable input is treated as NOT local (fail closed).
 */
export function isLocalDatabaseTarget(connectionString) {
  const raw = String(connectionString ?? "").trim();
  if (!raw) return false;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return LOCAL_HOSTS.has(host) || host.endsWith(".localhost");
  } catch {
    return false;
  }
}

/**
 * TLS options for a pg client.
 *
 * `rejectUnauthorized: false` is returned ONLY when all three hold:
 *   1. the process is not production,
 *   2. MCP_ALLOW_INSECURE_DB_TLS is exactly "true", and
 *   3. the target host is local.
 *
 * Every other combination — including an unset NODE_ENV, a mis-cased
 * "PRODUCTION", or a remote host in development — verifies the certificate.
 */
export function buildPgSslConfig(connectionString = process.env.DATABASE_URL, env = process.env) {
  const optedIn = env.MCP_ALLOW_INSECURE_DB_TLS === "true";
  if (optedIn && !isProductionEnv(env) && isLocalDatabaseTarget(connectionString)) {
    return { rejectUnauthorized: false };
  }
  return { rejectUnauthorized: true };
}
