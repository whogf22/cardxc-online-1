/**
 * R3-1 — defence-in-depth guard for the MCP raw-SQL surface.
 *
 * Both MCP entrypoints route `query_database` SQL through this ONE module so the
 * stdio server (index.js) and the HTTP server (http-server.js) cannot drift.
 *
 * WHY THE PREVIOUS VERSION WAS BYPASSABLE (all six confirmed against the shipped
 * code with MCP_ENABLE_RAW_SQL=true):
 *
 *   SELECT 'x--' ; DROP TABLE users
 *   SELECT $$--$$; UPDATE wallets SET balance_cents = 999999999
 *   SELECT * INTO exfil FROM users
 *   SELECT id, password_hash INTO public.stolen FROM users
 *   SELECT pg_read_file('/etc/passwd')
 *   SELECT pg_sleep(600)
 *
 *  1. Comments were stripped by regex BEFORE the single-statement check, and the
 *     stripper knew nothing about literals. To Postgres a `--` inside a string is
 *     ordinary text; to the regex it started a comment, erasing the `;` and the
 *     write keyword from the text being validated. validateSQL then returned the
 *     ORIGINAL string, and `client.query(text)` with no parameters takes
 *     node-postgres' simple-query path, which executes every statement.
 *  2. The keyword set omitted INTO (so `SELECT * INTO exfil FROM users` — DDL plus
 *     a full table copy — needed no smuggling), transaction control, locking
 *     clauses, and side-effecting functions.
 *  3. Policy: raw SQL ran as the application's write-capable role, so a validator
 *     bypass had full write authority.
 *
 * THE REPLACEMENT IS NOT ANOTHER REGEX PATCH. It is four independent layers:
 *
 *   L1  A literal- and comment-aware single-pass scanner. Strings, dollar-quoted
 *       strings, quoted identifiers and (nesting) block comments are consumed as
 *       units and replaced by opaque placeholders, so nothing inside them can
 *       contribute a keyword, and no comment marker inside them can hide a
 *       statement separator. Anything it cannot parse with certainty — an
 *       unterminated literal or comment, an escape string, a non-ASCII byte
 *       outside a literal — is REJECTED rather than guessed at.
 *   L2  An allowlisted statement shape (SELECT/WITH only) plus deny lists over
 *       the redacted text: writes, DDL, DCL, transaction control, locking
 *       clauses, and side-effecting functions.
 *   L3  A separately configured READ-ONLY database identity is mandatory. Raw SQL
 *       never reuses the application role, so a bypass of L1/L2 still has no
 *       write authority.
 *   L4  Execution inside a READ ONLY transaction with a bounded statement
 *       timeout, a bounded idle-in-transaction window, a row cap, and an
 *       unconditional ROLLBACK.
 *
 * Default-off is unchanged: everything requires MCP_ENABLE_RAW_SQL=true.
 */

/** Bounded server-side execution time for an accepted read-only query. */
export const READ_ONLY_STATEMENT_TIMEOUT_MS = 5000;

/** Bounded idle window so an accepted query cannot pin a connection. */
export const READ_ONLY_IDLE_TIMEOUT_MS = 10_000;

/** Hard cap on rows returned to the MCP client. */
export const MAX_RESULT_ROWS = 1000;

/* ------------------------------------------------------------------ *
 * L2 deny lists. Applied to the REDACTED text produced by L1, so a
 * keyword appearing inside a string or a quoted identifier can never
 * trigger them, and one hidden behind a comment can never evade them.
 * ------------------------------------------------------------------ */

/**
 * Writes, DDL, DCL and server-state verbs. Also catches data-modifying CTEs
 * (`WITH x AS (INSERT ... RETURNING *) SELECT * FROM x`) because the write
 * keyword still appears in the redacted body.
 *
 * INTO is included: `SELECT * INTO exfil FROM users` creates a table and copies
 * every row, and its omission was one of the two confirmed bypasses. `\b` means
 * an identifier such as `into_account` is unaffected.
 */
export const WRITE_SQL =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|COPY|VACUUM|REINDEX|CLUSTER|ANALYZE|CALL|DO|SET|RESET|MERGE|INTO|REFRESH|IMPORT|SECURITY\s+LABEL|COMMENT\s+ON)\b/i;

/** Transaction control and session/statement management. */
export const TXN_SQL =
  /\b(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|START\s+TRANSACTION|END|ABORT|DISCARD|LOCK|PREPARE|EXECUTE|DEALLOCATE|LISTEN|UNLISTEN|NOTIFY|CHECKPOINT|LOAD)\b/i;

/** Row-locking clauses. A read-only query has no business taking row locks. */
export const LOCKING_SQL =
  /\bFOR\s+(UPDATE|SHARE|NO\s+KEY\s+UPDATE|KEY\s+SHARE)\b/i;

/**
 * Side-effecting or environment-reaching functions: local file access, large
 * objects, outbound connections, sleeps, sequence mutation, backend control and
 * replication/WAL control.
 */
export const DANGEROUS_FN_SQL = new RegExp(
  '\\b(' +
  [
    'pg_read_file', 'pg_read_binary_file', 'pg_ls_dir', 'pg_stat_file',
    'pg_ls_logdir', 'pg_ls_waldir', 'pg_ls_tmpdir', 'pg_ls_archive_statusdir',
    'lo_import', 'lo_export', 'lo_from_bytea', 'lo_put', 'lo_unlink', 'loread', 'lowrite',
    'dblink', 'dblink_connect', 'dblink_exec', 'dblink_send_query',
    'postgres_fdw_disconnect', 'pg_logical_emit_message',
    'pg_sleep', 'pg_sleep_for', 'pg_sleep_until',
    'setval', 'nextval', 'currval', 'lastval',
    'pg_terminate_backend', 'pg_cancel_backend', 'pg_reload_conf',
    'pg_rotate_logfile', 'pg_create_restore_point',
    'pg_switch_wal', 'pg_switch_xlog', 'pg_promote',
    'pg_start_backup', 'pg_stop_backup', 'pg_backup_start', 'pg_backup_stop',
    'pg_advisory_lock', 'pg_advisory_lock_shared', 'pg_advisory_unlock',
    'pg_advisory_unlock_all', 'pg_advisory_xact_lock', 'pg_advisory_xact_lock_shared',
    'pg_try_advisory_lock', 'pg_try_advisory_xact_lock',
    'query_to_xml', 'query_to_xml_and_xmlschema', 'table_to_xml',
    'pg_read_server_files', 'pg_write_server_files', 'pg_execute_server_program',
    'set_config', 'pg_stat_reset', 'pg_replication_origin_create',
    'pg_create_logical_replication_slot', 'pg_drop_replication_slot',
  ].join('|') +
  ')\\b',
  'i',
);

/**
 * Whether raw SQL execution is enabled. Read from the environment at call time so
 * a process need not restart for the gate to take effect, and so callers/tests
 * can supply an explicit environment. Only the exact string "true" enables it.
 */
export function isRawSqlEnabled(env = process.env) {
  return env.MCP_ENABLE_RAW_SQL === "true";
}

/**
 * L1 — single-pass, literal- and comment-aware scan.
 *
 * Returns `{ redacted }`, where every string literal, dollar-quoted string,
 * quoted identifier and comment has been replaced by an opaque placeholder. That
 * redacted form is what the L2 deny lists run against, so:
 *   - a keyword inside a literal or a quoted identifier cannot trigger them, and
 *   - a comment marker inside a literal cannot hide a statement separator.
 *
 * THROWS (fail-closed) on anything it cannot parse with certainty:
 *   - a second statement (any `;` with non-whitespace after it)
 *   - an unterminated string, dollar-quoted string, quoted identifier or comment
 *   - an escape string (E'...') or unicode-escape string (U&'...'), whose
 *     backslash rules add bypass surface with no diagnostic benefit
 *   - a non-ASCII byte OUTSIDE a literal (homoglyphs, zero-width and exotic
 *     whitespace such as NBSP/NEL/LS/PS/ideographic space, RTL overrides).
 *     Non-ASCII inside a string literal is fine.
 */
export function scanSql(text) {
  const src = String(text);
  let out = '';
  let i = 0;

  const fail = (msg) => { throw new Error(msg); };

  while (i < src.length) {
    const c = src[i];
    const two = src.slice(i, i + 2);

    // Escape / unicode-escape string literals: rejected outright.
    if ((c === 'E' || c === 'e') && src[i + 1] === "'") {
      fail('Escape string literals (E\'...\') are not permitted');
    }
    if ((c === 'U' || c === 'u') && src[i + 1] === '&' && src[i + 2] === "'") {
      fail('Unicode escape string literals (U&\'...\') are not permitted');
    }

    // Line comment.
    if (two === '--') {
      while (i < src.length && src[i] !== '\n') i++;
      out += ' ';
      continue;
    }

    // Block comment, with PostgreSQL's nesting semantics.
    if (two === '/*') {
      let depth = 1;
      i += 2;
      while (i < src.length && depth > 0) {
        if (src.slice(i, i + 2) === '/*') { depth++; i += 2; continue; }
        if (src.slice(i, i + 2) === '*/') { depth--; i += 2; continue; }
        i++;
      }
      if (depth !== 0) fail('Unterminated block comment');
      out += ' ';
      continue;
    }

    // Single-quoted string literal ('' escapes an embedded quote).
    if (c === "'") {
      i++;
      let closed = false;
      while (i < src.length) {
        if (src[i] === "'" && src[i + 1] === "'") { i += 2; continue; }
        if (src[i] === "'") { i++; closed = true; break; }
        i++;
      }
      if (!closed) fail('Unterminated string literal');
      out += " '' ";
      continue;
    }

    // Double-quoted identifier ("" escapes an embedded quote).
    if (c === '"') {
      i++;
      let closed = false;
      while (i < src.length) {
        if (src[i] === '"' && src[i + 1] === '"') { i += 2; continue; }
        if (src[i] === '"') { i++; closed = true; break; }
        i++;
      }
      if (!closed) fail('Unterminated quoted identifier');
      out += ' "" ';
      continue;
    }

    // Dollar-quoted string. The tag must be a valid identifier, so `$1` stays a
    // bind parameter rather than being read as an opening tag.
    if (c === '$') {
      const m = /^\$([A-Za-z_][A-Za-z_0-9]*)?\$/.exec(src.slice(i));
      if (m) {
        const tag = m[0];
        const end = src.indexOf(tag, i + tag.length);
        if (end === -1) fail('Unterminated dollar-quoted string literal');
        i = end + tag.length;
        out += " '' ";
        continue;
      }
      out += c;
      i++;
      continue;
    }

    // Statement separator. A single trailing one is tolerated; anything after it
    // is a second statement.
    if (c === ';') {
      if (src.slice(i + 1).trim() !== '') fail('Only a single statement is allowed');
      i = src.length;
      continue;
    }

    // Outside a literal, only ASCII is accepted.
    if (src.charCodeAt(i) > 127) {
      fail('Non-ASCII characters are not permitted outside string literals');
    }

    out += c;
    i++;
  }

  return { redacted: out };
}

/** Trim ONLY the whitespace PostgreSQL recognises. JS `String.trim()` also strips
 * Unicode whitespace (NBSP, U+3000, NEL, LS, PS), which would silently remove
 * exactly the characters the non-ASCII check exists to reject. */
function asciiTrim(s) {
  return s.replace(/^[\t\n\v\f\r ]+/, '').replace(/[\t\n\v\f\r ]+$/, '');
}

/**
 * L2 — validate a raw SQL string. Returns the query UNCHANGED when permitted (the
 * caller must never be handed rewritten SQL); throws otherwise.
 *
 * @param {string} query
 * @param {{ rawSqlEnabled?: boolean }} [opts] override the enable gate.
 */
export function validateSQL(query, { rawSqlEnabled = isRawSqlEnabled() } = {}) {
  if (!rawSqlEnabled) {
    throw new Error('Raw SQL execution is disabled. Set MCP_ENABLE_RAW_SQL=true to enable read-only SELECT queries.');
  }
  const text = asciiTrim(String(query ?? ''));
  if (!text) throw new Error('Empty SQL query');

  const { redacted } = scanSql(text);
  const body = asciiTrim(redacted);

  if (!/^(SELECT|WITH)\b/i.test(body)) {
    throw new Error('Only read-only SELECT queries are allowed');
  }
  if (WRITE_SQL.test(body)) {
    throw new Error('Only read-only SELECT queries are allowed (write/DDL keyword detected)');
  }
  if (TXN_SQL.test(body)) {
    throw new Error('Transaction control and session management statements are not allowed');
  }
  if (LOCKING_SQL.test(body)) {
    throw new Error('Row-locking clauses are not allowed in a read-only query');
  }
  if (DANGEROUS_FN_SQL.test(body)) {
    throw new Error('Side-effecting or environment-reaching functions are not allowed');
  }
  return query;
}

/**
 * L3 — raw SQL requires a SEPARATE read-only database identity.
 *
 * True only when MCP_READONLY_DATABASE_URL is set AND differs from DATABASE_URL.
 * Reusing the application connection string would mean a bypass of L1/L2 still
 * carried write authority, which is exactly the blast radius this layer removes.
 * The read-only role should be created with `GRANT SELECT` only — this check
 * cannot verify server-side grants, it enforces that a distinct identity was
 * deliberately configured.
 */
export function isReadOnlyIdentityConfigured(env = process.env) {
  const ro = (env.MCP_READONLY_DATABASE_URL || '').trim();
  const app = (env.DATABASE_URL || '').trim();
  if (!ro) return false;
  return ro !== app;
}

/**
 * Assert every precondition for serving a raw SQL request. Fails closed.
 *
 * Error messages deliberately name only the variable, never its value, so a
 * connection string or password can never reach a log or an MCP response.
 */
export function assertRawSqlPreconditions(env = process.env) {
  if (!isRawSqlEnabled(env)) {
    throw new Error('Raw SQL execution is disabled. Set MCP_ENABLE_RAW_SQL=true to enable read-only SELECT queries.');
  }
  if (!isReadOnlyIdentityConfigured(env)) {
    throw new Error(
      'Raw SQL requires a dedicated read-only database identity: set MCP_READONLY_DATABASE_URL to a ' +
      'SELECT-only role distinct from DATABASE_URL. Refusing to execute with the application role.',
    );
  }
}

/**
 * L4 — the execution plan for an accepted query: a READ ONLY transaction with a
 * bounded statement timeout, a bounded idle window, a row cap, and an
 * unconditional ROLLBACK. Even a permitted SELECT is never committed.
 *
 * Returned as data rather than executed here so it can be unit-tested without a
 * database, and so both entrypoints run the identical sequence.
 */
export function buildReadOnlyQueryPlan(text) {
  return {
    begin: 'BEGIN TRANSACTION READ ONLY',
    setup: [
      `SET LOCAL statement_timeout = ${READ_ONLY_STATEMENT_TIMEOUT_MS}`,
      `SET LOCAL idle_in_transaction_session_timeout = ${READ_ONLY_IDLE_TIMEOUT_MS}`,
      'SET LOCAL default_transaction_read_only = on',
    ],
    text,
    maxRows: MAX_RESULT_ROWS,
    finish: 'ROLLBACK',
  };
}

/**
 * Execute an already-validated read-only query through the L4 plan.
 *
 * `client` is any object exposing `query(text)`. The caller owns connect/end and
 * MUST have obtained the client from the read-only identity (see
 * assertRawSqlPreconditions). Rows are capped; nothing is committed.
 */
export async function runReadOnlyQuery(client, text) {
  const plan = buildReadOnlyQueryPlan(text);
  await client.query(plan.begin);
  try {
    for (const stmt of plan.setup) await client.query(stmt);
    const result = await client.query(plan.text);
    const rows = Array.isArray(result?.rows) ? result.rows.slice(0, plan.maxRows) : [];
    return { rows, truncated: Array.isArray(result?.rows) && result.rows.length > plan.maxRows };
  } finally {
    // Always ROLLBACK: a read-only transaction has nothing to commit, and this
    // releases any snapshot even on the error path.
    try { await client.query(plan.finish); } catch { /* connection already gone */ }
  }
}
