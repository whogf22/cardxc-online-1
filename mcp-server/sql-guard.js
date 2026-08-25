/**
 * SEC-4 / HIGH-5 — shared allowlist-based SQL guard for the MCP surface.
 *
 * Both MCP entrypoints route raw `query_database` SQL through this ONE
 * validator so the stdio server (index.js) and the HTTP server
 * (http-server.js) cannot drift apart. Previously the stdio server used a
 * weak DROP/TRUNCATE blocklist that allowed UPDATE/INSERT/DROP TABLE, stacked
 * statements, and GRANT; only the HTTP server enforced the allowlist.
 *
 * Policy (fail closed):
 *   - Raw SQL is DISABLED unless MCP_ENABLE_RAW_SQL=true.
 *   - When enabled, only a SINGLE read-only statement is permitted: it must
 *     begin with SELECT or WITH, contain no additional statements, and contain
 *     no write / DDL / DCL / admin keyword.
 *   - A blocklist is not sufficient — anything not provably read-only is
 *     rejected.
 */

/**
 * Any of these keywords appearing anywhere in the comment-stripped statement
 * marks it as not-read-only: writes (INSERT/UPDATE/DELETE/MERGE), DDL
 * (CREATE/ALTER/DROP/TRUNCATE), DCL (GRANT/REVOKE), and server-state/admin
 * verbs (COPY/VACUUM/REINDEX/CALL/DO/SET). This also catches data-modifying
 * CTEs — `WITH x AS (INSERT ... RETURNING *) SELECT * FROM x` — the classic
 * "starts with WITH so it must be read-only" bypass, because the write keyword
 * still appears in the body.
 */
export const WRITE_SQL = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|COPY|VACUUM|REINDEX|CALL|DO|SET|MERGE)\b/i;

/**
 * Whether raw SQL execution is enabled. Read from the environment at call time
 * so a process does not have to be restarted for the gate to take effect, and
 * so callers/tests can supply an explicit environment.
 */
export function isRawSqlEnabled(env = process.env) {
  return env.MCP_ENABLE_RAW_SQL === "true";
}

/**
 * Validate a raw SQL string against the read-only allowlist. Returns the query
 * unchanged when it is permitted; throws with a descriptive message otherwise.
 *
 * @param {string} query
 * @param {{ rawSqlEnabled?: boolean }} [opts] - override the enable gate
 *   (defaults to the MCP_ENABLE_RAW_SQL environment check).
 */
export function validateSQL(query, { rawSqlEnabled = isRawSqlEnabled() } = {}) {
  if (!rawSqlEnabled) {
    throw new Error("Raw SQL execution is disabled. Set MCP_ENABLE_RAW_SQL=true to enable read-only SELECT queries.");
  }
  const text = String(query ?? "").trim();
  if (!text) {
    throw new Error("Empty SQL query");
  }
  // Strip comments so they cannot hide a second statement or a write keyword.
  const stripped = text.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").trim();
  // Reject multiple statements (a single trailing semicolon is tolerated).
  const withoutTrailing = stripped.replace(/;\s*$/, "");
  if (withoutTrailing.includes(";")) {
    throw new Error("Only a single statement is allowed");
  }
  if (!/^(SELECT|WITH)\b/i.test(withoutTrailing)) {
    throw new Error("Only read-only SELECT queries are allowed");
  }
  if (WRITE_SQL.test(withoutTrailing)) {
    throw new Error("Only read-only SELECT queries are allowed (write/DDL keyword detected)");
  }
  return query;
}
