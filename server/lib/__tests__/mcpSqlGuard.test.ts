/**
 * @vitest-environment node
 *
 * SEC-4 / HIGH-5 — MCP hardening.
 *
 * The credential and bind guarantees are verified against the shipped source of
 * `mcp-server/http-server.js` (an ESM entrypoint that connects to a DB and binds
 * a port on import, so it is asserted on as text, not executed).
 *
 * The SQL guard now lives in a single shared module, `mcp-server/sql-guard.js`,
 * which is pure (no import side effects) and is therefore imported and executed
 * directly here — the behavioural table runs against the real shipped code, and
 * separate source assertions pin that BOTH the stdio server (`index.js`) and the
 * HTTP server (`http-server.js`) route through it, so the two entrypoints cannot
 * silently diverge.
 *
 * Guarantees pinned here:
 *  - no hardcoded fallback credentials (secret or API key) anywhere;
 *  - the server refuses to start without them;
 *  - it binds loopback by default;
 *  - raw SQL is disabled by default and, when enabled, is read-only SELECT only;
 *  - the stdio server no longer uses the old DROP/TRUNCATE blocklist.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { validateSQL, isRawSqlEnabled } from '../../../mcp-server/sql-guard.js';

const MCP_DIR = join(__dirname, '..', '..', '..', 'mcp-server');
const SRC = readFileSync(join(MCP_DIR, 'http-server.js'), 'utf8');
const STDIO_SRC = readFileSync(join(MCP_DIR, 'index.js'), 'utf8');
const GUARD_SRC = readFileSync(join(MCP_DIR, 'sql-guard.js'), 'utf8');

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
    const AUTH_SRC = readFileSync(join(MCP_DIR, 'mcp-auth.js'), 'utf8');
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

describe('HIGH-5: a single shared SQL guard, used by both MCP entrypoints', () => {
  it('the shared guard is the source of the enable gate and the allowlist message', () => {
    // The gate keys off MCP_ENABLE_RAW_SQL === "true" (read from an injectable
    // env that defaults to process.env), and the read-only allowlist message
    // lives here in the one shared module.
    expect(GUARD_SRC).toContain('MCP_ENABLE_RAW_SQL === "true"');
    expect(GUARD_SRC).toContain('process.env');
    expect(GUARD_SRC).toMatch(/Only read-only SELECT queries are allowed/);
  });

  it('the stdio server imports the shared guard and calls it for query_database', () => {
    expect(STDIO_SRC).toContain('from "./sql-guard.js"');
    expect(STDIO_SRC).toMatch(/validateSQL\(toolInput\.query\)/);
  });

  it('the HTTP server imports the shared guard rather than defining its own', () => {
    expect(SRC).toContain('from "./sql-guard.js"');
    expect(SRC).not.toMatch(/function validateSQL/);
    expect(SRC).not.toContain('const WRITE_SQL');
  });

  it('the stdio server no longer uses the old DROP/TRUNCATE blocklist', () => {
    expect(STDIO_SRC).not.toContain('const DANGEROUS_SQL');
    expect(STDIO_SRC).not.toContain('Destructive SQL blocked');
  });
});

describe('SEC-4: raw SQL is constrained (real shared guard)', () => {
  it('is disabled by default (MCP_ENABLE_RAW_SQL unset)', () => {
    expect(isRawSqlEnabled({})).toBe(false);
    expect(isRawSqlEnabled({ MCP_ENABLE_RAW_SQL: 'false' })).toBe(false);
    expect(isRawSqlEnabled({ MCP_ENABLE_RAW_SQL: 'true' })).toBe(true);
    // With the gate off, even a benign SELECT is refused.
    expect(() => validateSQL('SELECT 1', { rawSqlEnabled: false })).toThrow(/disabled/i);
  });

  describe('when explicitly enabled', () => {
    const validate = (q: string) => validateSQL(q, { rawSqlEnabled: true });

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
