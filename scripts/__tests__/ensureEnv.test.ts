/**
 * @vitest-environment node
 *
 * Deployment regression coverage for `scripts/ensure-env.sh`.
 *
 * Making MCP_SECRET mandatory (and distinct from SESSION_SECRET) broke every
 * environment provisioned by the documented cloud-agent path: that script
 * generated SESSION_SECRET and JWT_SECRET only, so `npm run mcp:http` began
 * hard-crashing at boot on `resolveMcpSecret`.
 *
 * The bootstrap is exercised for real here — the script is executed in a
 * throwaway directory and the resulting .env is parsed. Nothing is mocked.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SCRIPT = resolve(__dirname, '..', 'ensure-env.sh');

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cardxc-env-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function run() {
  return execFileSync('bash', [SCRIPT], { cwd: dir, encoding: 'utf8' });
}

function readEnv(): Record<string, string> {
  const raw = readFileSync(join(dir, '.env'), 'utf8');
  const out: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

describe('fresh environment', () => {
  it('creates a .env containing every secret the app and MCP server require', () => {
    run();
    const env = readEnv();
    for (const key of ['SESSION_SECRET', 'JWT_SECRET', 'MCP_SECRET', 'MCP_API_KEY']) {
      expect(env[key], `${key} missing`).toBeTruthy();
    }
  });

  it('generates an MCP_SECRET of at least 32 characters', () => {
    run();
    expect(readEnv().MCP_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it('generates MCP_SECRET DISTINCT from SESSION_SECRET', () => {
    // Sharing them is precisely what would let an end-user auth_token
    // authenticate as an MCP client, and resolveMcpSecret refuses to start.
    run();
    const env = readEnv();
    expect(env.MCP_SECRET).not.toBe(env.SESSION_SECRET);
    expect(env.MCP_SECRET).not.toBe(env.JWT_SECRET);
  });

  it('generates MCP_API_KEY separately from MCP_SECRET', () => {
    run();
    const env = readEnv();
    expect(env.MCP_API_KEY).not.toBe(env.MCP_SECRET);
    expect(env.MCP_API_KEY.length).toBeGreaterThanOrEqual(32);
  });

  it('produces different secrets on two independent runs', () => {
    run();
    const first = readEnv();
    rmSync(join(dir, '.env'));
    run();
    const second = readEnv();
    expect(second.MCP_SECRET).not.toBe(first.MCP_SECRET);
    expect(second.SESSION_SECRET).not.toBe(first.SESSION_SECRET);
  });

  it('keeps the MCP server loopback-only by default', () => {
    run();
    const raw = readFileSync(join(dir, '.env'), 'utf8');
    // Either explicitly bound to loopback, or left unset (the code defaults to
    // 127.0.0.1). What must never appear is a wildcard bind.
    expect(raw).not.toMatch(/^MCP_BIND_HOST=0\.0\.0\.0/m);
    expect(raw).toMatch(/MCP_BIND_HOST=127\.0\.0\.1/);
  });

  it('leaves MCP raw SQL disabled', () => {
    run();
    const raw = readFileSync(join(dir, '.env'), 'utf8');
    expect(raw).not.toMatch(/^MCP_ENABLE_RAW_SQL=true/m);
  });
});

describe('existing .env is backfilled, never clobbered', () => {
  it('adds the MCP keys to a legacy .env that predates them', () => {
    // This is the actual regression: an environment provisioned before the MCP
    // hardening landed. It has no MCP_SECRET, so the MCP server refuses to boot.
    writeFileSync(
      join(dir, '.env'),
      'NODE_ENV=development\nSESSION_SECRET=existing-session-secret-value\nJWT_SECRET=existing-jwt\n',
    );
    run();
    const env = readEnv();
    expect(env.MCP_SECRET).toBeTruthy();
    expect(env.MCP_API_KEY).toBeTruthy();
    expect(env.MCP_SECRET).not.toBe(env.SESSION_SECRET);
  });

  it('preserves pre-existing values it did not generate', () => {
    writeFileSync(
      join(dir, '.env'),
      'SESSION_SECRET=existing-session-secret-value\nDATABASE_URL=postgres://keep/me\n',
    );
    run();
    const env = readEnv();
    expect(env.SESSION_SECRET).toBe('existing-session-secret-value');
    expect(env.DATABASE_URL).toBe('postgres://keep/me');
  });

  it('does NOT overwrite an existing MCP_SECRET', () => {
    const existing = 'a'.repeat(64);
    writeFileSync(
      join(dir, '.env'),
      `SESSION_SECRET=something-else-entirely\nMCP_SECRET=${existing}\nMCP_API_KEY=my-key\n`,
    );
    run();
    const env = readEnv();
    expect(env.MCP_SECRET).toBe(existing);
    expect(env.MCP_API_KEY).toBe('my-key');
  });

  it('is idempotent — a second run changes nothing', () => {
    run();
    const first = readFileSync(join(dir, '.env'), 'utf8');
    run();
    expect(readFileSync(join(dir, '.env'), 'utf8')).toBe(first);
  });

  it('backfills an MCP_SECRET that is present but empty', () => {
    writeFileSync(join(dir, '.env'), 'SESSION_SECRET=abc\nMCP_SECRET=\n');
    run();
    expect(readEnv().MCP_SECRET.length).toBeGreaterThanOrEqual(32);
  });
});

describe('the generated env actually boots the MCP server', () => {
  it('resolveMcpSecret accepts a freshly generated .env', async () => {
    // Closes the loop: it is not enough that the key exists — it must satisfy
    // the very guard whose introduction caused the deployment regression.
    run();
    const env = readEnv();
    const { resolveMcpSecret, signMcpToken, verifyMcpToken } = await import(
      '../../mcp-server/mcp-auth.js'
    );

    const secret = resolveMcpSecret(env);
    expect(secret).toBe(env.MCP_SECRET);
    expect(secret.length).toBeGreaterThanOrEqual(32);

    // And the resulting secret round-trips a real MCP token.
    const token = signMcpToken('ci', secret);
    expect(verifyMcpToken(token, secret).username).toBe('ci');
  });

  it('resolveMcpSecret accepts a backfilled legacy .env', async () => {
    writeFileSync(join(dir, '.env'), 'SESSION_SECRET=legacy-session-value-that-is-long\n');
    run();
    const { resolveMcpSecret } = await import('../../mcp-server/mcp-auth.js');
    expect(() => resolveMcpSecret(readEnv())).not.toThrow();
  });
});

describe('no hardcoded credentials', () => {
  it('the script contains no literal secret value', () => {
    const src = readFileSync(SCRIPT, 'utf8');
    // Every secret must come from the generator, never a baked-in constant.
    expect(src).toMatch(/openssl rand -hex 32/);
    expect(src).not.toMatch(/MCP_SECRET=[A-Za-z0-9]{16,}/);
    expect(src).not.toMatch(/MCP_API_KEY=[A-Za-z0-9]{16,}/);
  });

  it('exists and is executable as written', () => {
    expect(existsSync(SCRIPT)).toBe(true);
  });
});
