/**
 * @vitest-environment node
 *
 * R3-1 (CRITICAL) — the MCP raw-SQL guard was bypassable.
 *
 * REPRODUCED against the shipped `mcp-server/sql-guard.js` at HEAD 54a9600 with
 * `rawSqlEnabled: true`. All six of these were ALLOWED:
 *
 *   SELECT 'x--' ; DROP TABLE users
 *   SELECT $$--$$; UPDATE wallets SET balance_cents = 999999999
 *   SELECT * INTO exfil FROM users
 *   SELECT id, password_hash INTO public.stolen FROM users
 *   SELECT pg_read_file('/etc/passwd')
 *   SELECT pg_sleep(600)
 *
 * Two independent root causes:
 *
 *  1. ORDERING + LITERAL BLINDNESS. Comments were stripped with a plain regex
 *     BEFORE the single-statement check, and the stripper did not know about
 *     string or dollar-quoted literals. To Postgres, `--` inside a literal is
 *     ordinary text; to the regex it began a comment, so everything after it —
 *     including the `;` the guard was looking for and the write keyword — was
 *     erased from the text being validated. `validateSQL` then returned the
 *     ORIGINAL string, which `client.query(text)` submits with no parameters,
 *     taking node-postgres' simple-query path, which executes every statement.
 *
 *  2. AN INCOMPLETE KEYWORD SET. `WRITE_SQL` omitted `INTO`, so
 *     `SELECT * INTO exfil FROM users` — DDL plus a full table copy — needed no
 *     smuggling at all. It also omitted transaction control, locking clauses,
 *     and side-effecting functions (file read/write, large objects, dblink,
 *     sleep, sequence mutation, backend termination).
 *
 * A third defect is a policy one: raw SQL executed as the application's
 * write-capable role, so a validator bypass had full write authority.
 *
 * This suite is the RED specification for the defence-in-depth replacement. It
 * exercises the REAL shipped module — never a copy of its logic.
 */
import { describe, it, expect } from 'vitest';
import {
  validateSQL,
  isRawSqlEnabled,
  isReadOnlyIdentityConfigured,
  assertRawSqlPreconditions,
  buildReadOnlyQueryPlan,
  READ_ONLY_STATEMENT_TIMEOUT_MS,
  MAX_RESULT_ROWS,
} from '../../../mcp-server/sql-guard.js';

const on = { rawSqlEnabled: true };

/** Every payload confirmed to bypass the previous guard. */
const CONFIRMED_BYPASSES = [
  "SELECT 'x--' ; DROP TABLE users",
  'SELECT $$--$$; UPDATE wallets SET balance_cents = 999999999',
  'SELECT * INTO exfil FROM users',
  'SELECT id, password_hash INTO public.stolen FROM users',
  "SELECT pg_read_file('/etc/passwd')",
  'SELECT pg_sleep(600)',
];

describe('R3-1: the six confirmed bypasses are all rejected', () => {
  for (const q of CONFIRMED_BYPASSES) {
    it(`rejects: ${q}`, () => {
      expect(() => validateSQL(q, on)).toThrow();
    });
  }
});

describe('R3-1: a comment marker inside a literal cannot hide a second statement', () => {
  const smuggled = [
    // single-quoted string containing the comment marker
    "SELECT 'x--' ; DROP TABLE users",
    "SELECT 'a--b' ; DELETE FROM wallets",
    // doubled-quote escape inside a literal
    "SELECT 'it''s --' ; DROP TABLE users",
    // dollar-quoted, untagged and tagged
    'SELECT $$--$$; UPDATE wallets SET balance_cents = 1',
    'SELECT $tag$--$tag$; DROP TABLE users',
    'SELECT $a$ /* $a$; DROP TABLE users',
    // quoted identifier containing the marker
    'SELECT "col--" FROM t; DROP TABLE users',
    // block-comment marker inside a literal
    "SELECT '/*' ; DROP TABLE users",
  ];
  for (const q of smuggled) {
    it(`rejects: ${q}`, () => {
      expect(() => validateSQL(q, on)).toThrow();
    });
  }
});

describe('R3-1: only ONE statement may reach PostgreSQL', () => {
  it('rejects a stacked statement', () => {
    expect(() => validateSQL('SELECT 1; SELECT 2', on)).toThrow(/single statement/i);
  });

  it('rejects a stacked statement hidden behind a real comment', () => {
    expect(() => validateSQL('SELECT 1 -- c\n; DROP TABLE users', on)).toThrow();
  });

  it('rejects a stacked statement after a block comment', () => {
    expect(() => validateSQL('SELECT 1 /* c */ ; DROP TABLE users', on)).toThrow();
  });

  it('tolerates a single trailing semicolon', () => {
    expect(() => validateSQL('SELECT 1;', on)).not.toThrow();
    expect(() => validateSQL('SELECT 1;   ', on)).not.toThrow();
  });

  it('rejects an unterminated string literal rather than guessing', () => {
    expect(() => validateSQL("SELECT 'abc", on)).toThrow(/unterminated/i);
  });

  it('rejects an unterminated block comment', () => {
    expect(() => validateSQL('SELECT 1 /* abc', on)).toThrow(/unterminated/i);
  });

  it('rejects an unterminated dollar-quoted literal', () => {
    expect(() => validateSQL('SELECT $x$ abc', on)).toThrow(/unterminated/i);
  });

  it('handles NESTED block comments the way PostgreSQL does', () => {
    // Postgres nests /* */. A correctly-nesting scanner treats the whole thing as
    // one comment; a non-nesting one would end at the first */ and expose the
    // tail. Both of these assert the CORRECT Postgres semantics.
    expect(() => validateSQL('SELECT 1 /* a /* b */ c */', on)).not.toThrow();
    // Depth never returns to zero, so this is an unterminated comment.
    expect(() => validateSQL('SELECT 1 /* /* */ ; DROP TABLE users', on)).toThrow(/unterminated/i);
  });
});

describe('R3-1: writes, DDL, DML, transaction control and locking are rejected', () => {
  const rejected = [
    'UPDATE wallets SET balance_cents = 1',
    'INSERT INTO users VALUES (1)',
    'DELETE FROM wallets',
    'DROP TABLE users',
    'TRUNCATE users',
    'ALTER TABLE users ADD COLUMN x int',
    'CREATE TABLE t (a int)',
    'GRANT ALL ON users TO public',
    'REVOKE ALL ON users FROM public',
    'COPY users TO STDOUT',
    "COPY users FROM '/tmp/x'",
    'VACUUM',
    'REINDEX TABLE users',
    'CALL some_proc()',
    "DO $$ BEGIN PERFORM 1; END $$",
    'SET search_path = public',
    'MERGE INTO t USING s ON true WHEN MATCHED THEN DELETE',
    // writable CTE
    'WITH x AS (INSERT INTO users VALUES (1) RETURNING *) SELECT * FROM x',
    'WITH x AS (UPDATE wallets SET balance_cents = 1 RETURNING *) SELECT * FROM x',
    'WITH x AS (DELETE FROM wallets RETURNING *) SELECT * FROM x',
    // SELECT INTO in both spellings
    'SELECT * INTO exfil FROM users',
    'SELECT 1 INTO TEMP t',
    // transaction control
    'BEGIN',
    'COMMIT',
    'ROLLBACK',
    'SAVEPOINT s',
    'START TRANSACTION',
    'ABORT',
    'DISCARD ALL',
    'LOCK TABLE users',
    'PREPARE p AS SELECT 1',
    'EXECUTE p',
    'DEALLOCATE p',
    'LISTEN c',
    'NOTIFY c',
    // locking clauses on a SELECT
    'SELECT * FROM users FOR UPDATE',
    'SELECT * FROM users FOR NO KEY UPDATE',
    'SELECT * FROM users FOR SHARE',
    'SELECT * FROM users FOR KEY SHARE',
  ];
  for (const q of rejected) {
    it(`rejects: ${q}`, () => {
      expect(() => validateSQL(q, on)).toThrow();
    });
  }
});

describe('R3-1: side-effecting and file/network functions are rejected', () => {
  const rejected = [
    "SELECT pg_read_file('/etc/passwd')",
    "SELECT pg_read_binary_file('/etc/passwd')",
    "SELECT pg_ls_dir('/')",
    "SELECT pg_stat_file('/etc/passwd')",
    "SELECT lo_import('/etc/passwd')",
    "SELECT lo_export(1, '/tmp/x')",
    "SELECT lo_from_bytea(0, 'x'::bytea)",
    "SELECT dblink('dbname=x', 'SELECT 1')",
    "SELECT dblink_connect('x')",
    'SELECT pg_sleep(600)',
    "SELECT pg_sleep_for('1 hour')",
    "SELECT pg_sleep_until(now())",
    "SELECT setval('users_id_seq', 1)",
    "SELECT nextval('users_id_seq')",
    'SELECT pg_terminate_backend(1)',
    'SELECT pg_cancel_backend(1)',
    'SELECT pg_reload_conf()',
    'SELECT pg_rotate_logfile()',
    'SELECT pg_advisory_lock(1)',
    'SELECT pg_advisory_xact_lock(1)',
    "SELECT query_to_xml('SELECT 1', true, false, '')",
    "SELECT pg_logical_emit_message(true, 'a', 'b')",
    'SELECT pg_switch_wal()',
    "SELECT pg_create_restore_point('x')",
  ];
  for (const q of rejected) {
    it(`rejects: ${q}`, () => {
      expect(() => validateSQL(q, on)).toThrow();
    });
  }
});

describe('R3-1: Unicode and whitespace evasion is rejected', () => {
  const rejected = [
    // non-breaking space instead of a normal space before INTO
    'SELECT * INTO exfil FROM users',
    // zero-width space inside a dangerous function name
    "SELECT pg_read​_file('/etc/passwd')",
    // ideographic space as the leading whitespace
    '　SELECT 1',
    // NEL / LS / PS line separators
    'SELECT 1; DROP TABLE users',
    'SELECT 1 ; DROP TABLE users',
    // full-width semicolon (not a Postgres statement separator, but reject anyway)
    'SELECT 1； DROP TABLE users',
  ];
  for (const q of rejected) {
    it(`rejects: ${JSON.stringify(q)}`, () => {
      expect(() => validateSQL(q, on)).toThrow();
    });
  }

  it('still permits a non-ASCII character INSIDE a string literal', () => {
    expect(() => validateSQL("SELECT 'café' AS x", on)).not.toThrow();
  });

  it('rejects an escape-string literal, whose backslash rules add bypass surface', () => {
    expect(() => validateSQL("SELECT E'a'", on)).toThrow(/escape string/i);
    expect(() => validateSQL("SELECT E'\\'' ; DROP TABLE users", on)).toThrow();
  });

  it('rejects a unicode-escape string literal', () => {
    expect(() => validateSQL("SELECT U&'\\0041'", on)).toThrow();
  });
});

describe('R3-1: legitimate read-only queries still work', () => {
  const allowed = [
    'SELECT 1',
    'select 1',
    'SELECT * FROM users LIMIT 10',
    'SELECT id, email FROM users WHERE email LIKE $1',
    'WITH recent AS (SELECT id FROM users ORDER BY created_at DESC LIMIT 5) SELECT * FROM recent',
    'SELECT count(*) FROM wallets',
    "SELECT 'a;b' AS semicolon_in_a_literal",
    'SELECT 1 -- a trailing comment\n',
    'SELECT 1 /* a block comment */',
    // "into" as part of a longer identifier must NOT trip the INTO rule
    'SELECT into_account FROM ledger',
    // a column literally called "set"
    'SELECT "set" FROM t',
  ];
  for (const q of allowed) {
    it(`allows: ${q}`, () => {
      expect(() => validateSQL(q, on)).not.toThrow();
    });
  }

  it('returns the query unchanged so the caller cannot be handed rewritten SQL', () => {
    expect(validateSQL('SELECT 1', on)).toBe('SELECT 1');
  });
});

describe('R3-1: default-off behaviour is unchanged', () => {
  it('is disabled when MCP_ENABLE_RAW_SQL is unset', () => {
    expect(isRawSqlEnabled({})).toBe(false);
  });

  it('is enabled only by the exact string "true"', () => {
    expect(isRawSqlEnabled({ MCP_ENABLE_RAW_SQL: 'true' })).toBe(true);
    for (const v of ['TRUE', 'True', '1', 'yes', 'on', '']) {
      expect(isRawSqlEnabled({ MCP_ENABLE_RAW_SQL: v })).toBe(false);
    }
  });

  it('refuses every query when disabled, including a harmless one', () => {
    expect(() => validateSQL('SELECT 1', { rawSqlEnabled: false })).toThrow(/disabled/i);
  });
});

describe('R3-1: raw SQL requires a SEPARATE read-only database identity', () => {
  it('is not configured when only DATABASE_URL is present', () => {
    expect(isReadOnlyIdentityConfigured({ DATABASE_URL: 'postgres://app:pw@h/db' })).toBe(false);
  });

  it('is not configured when the read-only URL equals the application URL', () => {
    const url = 'postgres://app:pw@h/db';
    expect(isReadOnlyIdentityConfigured({ DATABASE_URL: url, MCP_READONLY_DATABASE_URL: url })).toBe(false);
  });

  it('is configured when a DISTINCT read-only URL is supplied', () => {
    expect(isReadOnlyIdentityConfigured({
      DATABASE_URL: 'postgres://app:pw@h/db',
      MCP_READONLY_DATABASE_URL: 'postgres://ro:pw2@h/db',
    })).toBe(true);
  });

  it('fails closed when raw SQL is enabled but no read-only identity exists', () => {
    expect(() => assertRawSqlPreconditions({ MCP_ENABLE_RAW_SQL: 'true', DATABASE_URL: 'postgres://app:pw@h/db' }))
      .toThrow(/read-only/i);
  });

  it('fails closed when the read-only identity reuses the application role', () => {
    const url = 'postgres://app:pw@h/db';
    expect(() => assertRawSqlPreconditions({ MCP_ENABLE_RAW_SQL: 'true', DATABASE_URL: url, MCP_READONLY_DATABASE_URL: url }))
      .toThrow(/read-only/i);
  });

  it('passes preconditions with a distinct read-only identity', () => {
    expect(() => assertRawSqlPreconditions({
      MCP_ENABLE_RAW_SQL: 'true',
      DATABASE_URL: 'postgres://app:pw@h/db',
      MCP_READONLY_DATABASE_URL: 'postgres://ro:pw2@h/db',
    })).not.toThrow();
  });

  it('still refuses when raw SQL is off, regardless of identity', () => {
    expect(() => assertRawSqlPreconditions({
      DATABASE_URL: 'postgres://app:pw@h/db',
      MCP_READONLY_DATABASE_URL: 'postgres://ro:pw2@h/db',
    })).toThrow(/disabled/i);
  });

  it('never includes a connection string or password in the error text', () => {
    let msg = '';
    try {
      assertRawSqlPreconditions({ MCP_ENABLE_RAW_SQL: 'true', DATABASE_URL: 'postgres://app:sup3rsecret@h/db' });
    } catch (e) {
      msg = String(e.message);
    }
    expect(msg).not.toContain('sup3rsecret');
    expect(msg).not.toContain('postgres://');
  });
});

describe('R3-1: accepted queries run read-only, time-bounded and row-capped', () => {
  it('opens a READ ONLY transaction', () => {
    expect(buildReadOnlyQueryPlan('SELECT 1').begin).toMatch(/BEGIN\s+TRANSACTION\s+READ\s+ONLY/i);
  });

  it('sets a bounded statement timeout local to that transaction', () => {
    const plan = buildReadOnlyQueryPlan('SELECT 1');
    expect(plan.setup.some((s: string) => /SET\s+LOCAL\s+statement_timeout/i.test(s))).toBe(true);
    expect(READ_ONLY_STATEMENT_TIMEOUT_MS).toBeGreaterThan(0);
    expect(READ_ONLY_STATEMENT_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });

  it('also bounds the idle-in-transaction window', () => {
    const plan = buildReadOnlyQueryPlan('SELECT 1');
    expect(plan.setup.some((s: string) => /idle_in_transaction_session_timeout/i.test(s))).toBe(true);
  });

  it('caps the returned rows', () => {
    expect(MAX_RESULT_ROWS).toBeGreaterThan(0);
    expect(buildReadOnlyQueryPlan('SELECT 1').maxRows).toBe(MAX_RESULT_ROWS);
  });

  it('always rolls back — a read-only transaction is never committed', () => {
    const plan = buildReadOnlyQueryPlan('SELECT 1');
    expect(plan.finish).toMatch(/ROLLBACK/i);
    expect(plan.finish).not.toMatch(/COMMIT/i);
  });

  it('passes the caller SQL through verbatim, never rewritten', () => {
    expect(buildReadOnlyQueryPlan('SELECT 1 /* keep */').text).toBe('SELECT 1 /* keep */');
  });
});
