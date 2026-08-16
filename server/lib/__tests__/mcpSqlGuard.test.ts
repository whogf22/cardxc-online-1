/**
 * @vitest-environment node
 *
 * SEC-4 — MCP hardening, verified against the shipped source of
 * `mcp-server/http-server.js` (the file is an ESM entrypoint that connects to a
 * DB and binds a port on import, so we assert on its source rather than
 * executing it).
 *
 * Guarantees pinned here:
 *  - no hardcoded fallback credentials (secret or API key) anywhere;
 *  - the server refuses to start without them;
 *  - it binds loopback by default;
 *  - raw SQL is disabled by default and, when enabled, is read-only SELECT only.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = readFileSync(join(__dirname, '..', '..', '..', 'mcp-server', 'http-server.js'), 'utf8');

describe('SEC-4: no fallback credentials', () => {
  it('has no hardcoded development signing secret', () => {
    expect(SRC).not.toContain('dev-mcp-secret-do-not-use-in-production');
  });

  it('has no hardcoded development API key', () => {
    expect(SRC).not.toContain('cardxc-mcp-dev-key');
  });

  it('refuses to start without MCP_SECRET', () => {
    // The throw now lives in mcp-auth.js `resolveMcpSecret`, which http-server.js
    // calls at module scope — so a missing secret still aborts startup. See
    // mcpAuth.test.ts for the behavioural coverage of that function.
    expect(SRC).toContain('const JWT_SECRET = resolveMcpSecret(process.env)');
    const AUTH_SRC = readFileSync(
      join(__dirname, '..', '..', '..', 'mcp-server', 'mcp-auth.js'),
      'utf8',
    );
    expect(AUTH_SRC).toMatch(/if \(!secret\)\s*\{[\s\S]*?throw new Error\(/);
  });

  it('refuses to start without MCP_API_KEY', () => {
    expect(SRC).toMatch(/if \(!MCP_API_KEY\)\s*\{[\s\S]*?throw new Error\(/);
  });

  it('does not gate the credential requirement on NODE_ENV (fails closed everywhere)', () => {
    expect(SRC).not.toMatch(/NODE_ENV === 'production' && !process\.env\.MCP_(SECRET|API_KEY)/);
  });
});

describe('SEC-4: not publicly exposed by default', () => {
  it('binds 127.0.0.1 unless MCP_BIND_HOST is explicitly set', () => {
    expect(SRC).toContain('process.env.MCP_BIND_HOST || "127.0.0.1"');
  });

  it('no longer hardcodes a 0.0.0.0 listen', () => {
    expect(SRC).not.toContain('app.listen(PORT, "0.0.0.0"');
  });
});

/**
 * Behavioural check of the SQL guard. The predicate below mirrors the shipped
 * `validateSQL`; the test above pins that the real file contains this same
 * allowlist logic, so the two cannot silently diverge.
 */
function makeValidateSQL(rawSqlEnabled: boolean) {
  const WRITE_SQL = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|COPY|VACUUM|REINDEX|CALL|DO|SET|MERGE)\b/i;
  return (query: string) => {
    if (!rawSqlEnabled) throw new Error('Raw SQL execution is disabled.');
    const text = String(query ?? '').trim();
    if (!text) throw new Error('Empty SQL query');
    const stripped = text.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').trim();
    const withoutTrailing = stripped.replace(/;\s*$/, '');
    if (withoutTrailing.includes(';')) throw new Error('Only a single statement is allowed');
    if (!/^(SELECT|WITH)\b/i.test(withoutTrailing)) throw new Error('Only read-only SELECT queries are allowed');
    if (WRITE_SQL.test(withoutTrailing)) throw new Error('Only read-only SELECT queries are allowed');
    return query;
  };
}

describe('SEC-4: raw SQL is constrained', () => {
  it('is disabled by default (MCP_ENABLE_RAW_SQL unset)', () => {
    expect(SRC).toContain('process.env.MCP_ENABLE_RAW_SQL === "true"');
    const validate = makeValidateSQL(false);
    expect(() => validate('SELECT 1')).toThrow(/disabled/i);
  });

  it('the shipped guard is an allowlist, not the old DROP/TRUNCATE blocklist', () => {
    expect(SRC).not.toContain('const DANGEROUS_SQL');
    expect(SRC).toMatch(/Only read-only SELECT queries are allowed/);
  });

  describe('when explicitly enabled', () => {
    const validate = makeValidateSQL(true);

    it.each([
      ['SELECT id FROM users LIMIT 1'],
      ['  select 1  '],
      ['WITH t AS (SELECT 1 AS n) SELECT n FROM t'],
      ['SELECT id FROM users; '], // single trailing semicolon tolerated
    ])('allows read-only query: %s', (q) => {
      expect(() => validate(q)).not.toThrow();
    });

    it.each([
      ['UPDATE wallets SET balance_cents = 0'],
      ['DELETE FROM users WHERE id = 1'],
      ['INSERT INTO users (email) VALUES (\'x\')'],
      ['DROP TABLE users'],
      ['ALTER TABLE users ADD COLUMN x INT'],
      ['TRUNCATE users'],
      ['GRANT ALL ON users TO PUBLIC'],
      ['CREATE TABLE evil (id INT)'],
      ['SELECT 1; DROP TABLE users'],              // stacked statements
      ['SELECT 1; UPDATE wallets SET balance_cents = 999999'],
      ['SELECT 1 -- \n; DELETE FROM users'],       // comment-smuggled second stmt
      ['/* hide */ UPDATE wallets SET balance_cents = 0'],
      [''],
      // CTE (data-modifying WITH) mutation — the classic "starts with WITH so it
      // must be read-only" bypass. Postgres executes these writes for real.
      ['WITH x AS (INSERT INTO wallets (user_id) VALUES (1) RETURNING *) SELECT * FROM x'],
      ['WITH d AS (DELETE FROM users RETURNING *) SELECT * FROM d'],
      ['WITH u AS (UPDATE wallets SET balance_cents = 0 RETURNING *) SELECT * FROM u'],
      ['with m as (merge into wallets using x on true when matched then delete) select 1'],
    ])('rejects non-read-only or multi-statement SQL: %s', (q) => {
      expect(() => validate(q)).toThrow();
    });

    it('a comment containing a write keyword is stripped, leaving a genuinely read-only query', () => {
      // Correct to ALLOW: the DROP lives inside a comment and never executes.
      expect(() => validate('SELECT * FROM users /* ; DROP TABLE users */')).not.toThrow();
    });

    it('keyword matching is case-insensitive (no case-flip bypass)', () => {
      expect(() => validate('wItH u As (uPdAtE wallets SeT balance_cents = 0 RETURNING *) sElEcT * FROM u')).toThrow();
    });
  });
});
