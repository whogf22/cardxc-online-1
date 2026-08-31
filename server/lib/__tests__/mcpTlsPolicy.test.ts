/**
 * @vitest-environment node
 *
 * R3-6 (MEDIUM) — MCP TLS fail-open.
 *
 * `mcp-server/http-server.js` compared `process.env.NODE_ENV === 'production'`
 * literally in two places, each falling back to `{ rejectUnauthorized: false }`.
 * `NODE_ENV=PRODUCTION`, `Production`, a value with stray whitespace, or an unset
 * value all took the insecure branch, so the MCP server's PostgreSQL connection
 * accepted any certificate — credentials and query traffic exposed to an active
 * MITM. `server/**` was migrated to a normalising helper; `mcp-server/**` was not.
 *
 * The replacement is fail-CLOSED: verification is on unless a development-only
 * opt-in is set AND the process is not production AND the target is local.
 */
import { describe, it, expect } from 'vitest';
import {
  isProductionEnv,
  nodeEnv,
  isLocalDatabaseTarget,
  buildPgSslConfig,
} from '../../../mcp-server/env.js';

const LOCAL = 'postgres://u:p@localhost:5432/db';
const REMOTE = 'postgres://u:p@db.example.com:5432/db';

describe('R3-6: production detection is not defeated by casing or whitespace', () => {
  it('recognises the conventional value', () => {
    expect(isProductionEnv({ NODE_ENV: 'production' })).toBe(true);
  });

  it('recognises production regardless of case', () => {
    for (const v of ['PRODUCTION', 'Production', 'PrOdUcTiOn']) {
      expect(isProductionEnv({ NODE_ENV: v })).toBe(true);
    }
  });

  it('tolerates surrounding whitespace', () => {
    for (const v of [' production', 'production ', '\tproduction\n']) {
      expect(isProductionEnv({ NODE_ENV: v })).toBe(true);
    }
  });

  it('accepts the prod shorthand', () => {
    expect(isProductionEnv({ NODE_ENV: 'prod' })).toBe(true);
    expect(isProductionEnv({ NODE_ENV: 'PROD' })).toBe(true);
  });

  it('is false for non-production values and when unset', () => {
    for (const v of ['development', 'dev', 'test', 'staging', '']) {
      expect(isProductionEnv({ NODE_ENV: v })).toBe(false);
    }
    expect(isProductionEnv({})).toBe(false);
  });

  it('does not match a value that merely CONTAINS production', () => {
    for (const v of ['not-production', 'preproduction', 'production-like']) {
      expect(isProductionEnv({ NODE_ENV: v })).toBe(false);
    }
  });

  it('nodeEnv normalises', () => {
    expect(nodeEnv({ NODE_ENV: '  PRODUCTION ' })).toBe('production');
    expect(nodeEnv({})).toBe('');
  });
});

describe('R3-6: certificate verification is ON unless narrowly opted out', () => {
  it('UNSET NODE_ENV verifies the certificate (the old code did not)', () => {
    expect(buildPgSslConfig(REMOTE, {})).toEqual({ rejectUnauthorized: true });
    expect(buildPgSslConfig(LOCAL, {})).toEqual({ rejectUnauthorized: true });
  });

  it('mis-cased PRODUCTION verifies the certificate (the old code did not)', () => {
    expect(buildPgSslConfig(REMOTE, { NODE_ENV: 'PRODUCTION' })).toEqual({ rejectUnauthorized: true });
  });

  it('lower-case production verifies the certificate', () => {
    expect(buildPgSslConfig(REMOTE, { NODE_ENV: 'production' })).toEqual({ rejectUnauthorized: true });
  });

  it('development WITHOUT the opt-in still verifies', () => {
    expect(buildPgSslConfig(LOCAL, { NODE_ENV: 'development' })).toEqual({ rejectUnauthorized: true });
  });

  it('test WITHOUT the opt-in still verifies', () => {
    expect(buildPgSslConfig(LOCAL, { NODE_ENV: 'test' })).toEqual({ rejectUnauthorized: true });
  });

  it('development WITH the opt-in and a LOCAL target may skip verification', () => {
    expect(buildPgSslConfig(LOCAL, { NODE_ENV: 'development', MCP_ALLOW_INSECURE_DB_TLS: 'true' }))
      .toEqual({ rejectUnauthorized: false });
  });

  it('the opt-in is IGNORED for a REMOTE target, even in development', () => {
    expect(buildPgSslConfig(REMOTE, { NODE_ENV: 'development', MCP_ALLOW_INSECURE_DB_TLS: 'true' }))
      .toEqual({ rejectUnauthorized: true });
  });

  it('the opt-in is IGNORED in production, even for a local target', () => {
    for (const v of ['production', 'PRODUCTION', 'prod']) {
      expect(buildPgSslConfig(LOCAL, { NODE_ENV: v, MCP_ALLOW_INSECURE_DB_TLS: 'true' }))
        .toEqual({ rejectUnauthorized: true });
    }
  });

  it('the opt-in requires the exact string "true"', () => {
    for (const v of ['TRUE', 'True', '1', 'yes', 'on', '']) {
      expect(buildPgSslConfig(LOCAL, { NODE_ENV: 'development', MCP_ALLOW_INSECURE_DB_TLS: v }))
        .toEqual({ rejectUnauthorized: true });
    }
  });

  it('an unparseable or empty connection string is treated as NOT local', () => {
    expect(isLocalDatabaseTarget('')).toBe(false);
    expect(isLocalDatabaseTarget('not a url')).toBe(false);
    expect(isLocalDatabaseTarget(undefined)).toBe(false);
    expect(buildPgSslConfig('not a url', { NODE_ENV: 'development', MCP_ALLOW_INSECURE_DB_TLS: 'true' }))
      .toEqual({ rejectUnauthorized: true });
  });

  it('recognises the usual local hosts and only those', () => {
    for (const h of ['localhost', '127.0.0.1', '[::1]', 'db.localhost']) {
      expect(isLocalDatabaseTarget(`postgres://u:p@${h}:5432/db`)).toBe(true);
    }
    for (const h of ['db.example.com', '10.0.0.5', 'localhost.evil.com']) {
      expect(isLocalDatabaseTarget(`postgres://u:p@${h}:5432/db`)).toBe(false);
    }
  });
});

describe('R3-6: no literal NODE_ENV comparison remains in mcp-server', () => {
  it('mcp-server sources contain no case-sensitive production literal', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    for (const f of ['mcp-server/http-server.js', 'mcp-server/index.js']) {
      const src = readFileSync(join(process.cwd(), f), 'utf8');
      expect(src, `${f} still compares NODE_ENV literally`).not.toMatch(/NODE_ENV\s*===\s*['"]production['"]/);
    }
  });

  it('server-side TLS controls were not weakened', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const pool = readFileSync(join(process.cwd(), 'server/db/pool.ts'), 'utf8');
    // server/db/pool.ts must still gate SSL on the normalised production check.
    expect(pool).toMatch(/isProductionEnv\(\)/);
  });
});
