/**
 * @vitest-environment node
 *
 * CSO finding #2 (HIGH) — the MCP admin server accepted any ordinary CardXC
 * user JWT.
 *
 * Two defects combined:
 *   1. `JWT_SECRET` fell back to `SESSION_SECRET`, the same key the main app
 *      uses to sign user `auth_token` cookies, so user tokens verified here.
 *   2. `jwt.verify(token, JWT_SECRET)` passed no `issuer`/`audience`/`algorithms`
 *      options, so the `iss`/`aud` claims the server itself mints were never
 *      actually checked.
 *
 * The auth primitives now live in `mcp-server/mcp-auth.js` so they can be
 * exercised directly — `http-server.js` binds a port and opens a DB pool on
 * import, so it cannot be executed under test.
 */
import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  MCP_ISSUER,
  MCP_AUDIENCE,
  resolveMcpSecret,
  signMcpToken,
  verifyMcpToken,
} from '../../../mcp-server/mcp-auth.js';

const MCP_SECRET = 'mcp-test-secret-at-least-32-characters-long';
const SESSION_SECRET = 'session-test-secret-at-least-32-characters';

const SRC = readFileSync(
  join(__dirname, '..', '..', '..', 'mcp-server', 'http-server.js'),
  'utf8',
);

describe('resolveMcpSecret — no SESSION_SECRET fallback', () => {
  it('returns MCP_SECRET when set', () => {
    expect(resolveMcpSecret({ MCP_SECRET })).toBe(MCP_SECRET);
  });

  it('throws when MCP_SECRET is missing, even if SESSION_SECRET is present', () => {
    expect(() => resolveMcpSecret({ SESSION_SECRET })).toThrow(/MCP_SECRET/);
  });

  it('throws when MCP_SECRET is missing entirely', () => {
    expect(() => resolveMcpSecret({})).toThrow(/MCP_SECRET/);
  });

  it('refuses an MCP_SECRET that is merely a copy of SESSION_SECRET', () => {
    expect(() =>
      resolveMcpSecret({ MCP_SECRET: SESSION_SECRET, SESSION_SECRET }),
    ).toThrow(/must not be the same value as SESSION_SECRET/);
  });

  it('refuses a too-short MCP_SECRET', () => {
    expect(() => resolveMcpSecret({ MCP_SECRET: 'short' })).toThrow(/32 characters/);
  });
});

describe('verifyMcpToken — a CardXC user token cannot authenticate to MCP', () => {
  /**
   * Exactly the shape `createSession` mints for a logged-in end user: a
   * userId/sessionId pair, no `iss`, no `aud`.
   */
  function cardxcUserToken(secret: string) {
    return jwt.sign(
      {
        userId: '11111111-1111-1111-1111-111111111111',
        sessionId: '22222222-2222-2222-2222-222222222222',
        email: 'attacker@example.com',
      },
      secret,
      { expiresIn: '8h' },
    );
  }

  it('rejects a user token even when MCP and the app share one secret', () => {
    // The pre-fix deployment: MCP_SECRET unset, so both signed with SESSION_SECRET.
    const userToken = cardxcUserToken(SESSION_SECRET);
    expect(() => verifyMcpToken(userToken, SESSION_SECRET)).toThrow();
  });

  it('rejects a user token minted with the MCP secret itself', () => {
    // Belt and braces: even a signature-valid token fails on iss/aud.
    const userToken = cardxcUserToken(MCP_SECRET);
    expect(() => verifyMcpToken(userToken, MCP_SECRET)).toThrow(/jwt issuer invalid|jwt audience invalid/);
  });

  it('accepts a genuine MCP token', () => {
    const token = signMcpToken('mcp-client', MCP_SECRET);
    const decoded = verifyMcpToken(token, MCP_SECRET);
    expect(decoded.username).toBe('mcp-client');
    expect(decoded.role).toBe('ai-assistant');
    expect(decoded.iss).toBe(MCP_ISSUER);
    expect(decoded.aud).toBe(MCP_AUDIENCE);
  });

  it('rejects an MCP-shaped token signed with the wrong secret', () => {
    const token = signMcpToken('mcp-client', SESSION_SECRET);
    expect(() => verifyMcpToken(token, MCP_SECRET)).toThrow(/invalid signature/);
  });

  it('rejects a token with the right audience but a foreign issuer', () => {
    const token = jwt.sign({ username: 'x', role: 'ai-assistant' }, MCP_SECRET, {
      issuer: 'not-cardxc-mcp',
      audience: MCP_AUDIENCE,
      expiresIn: '8h',
    });
    expect(() => verifyMcpToken(token, MCP_SECRET)).toThrow(/jwt issuer invalid/);
  });

  it('rejects a token with the right issuer but a foreign audience', () => {
    const token = jwt.sign({ username: 'x', role: 'ai-assistant' }, MCP_SECRET, {
      issuer: MCP_ISSUER,
      audience: 'someone-else',
      expiresIn: '8h',
    });
    expect(() => verifyMcpToken(token, MCP_SECRET)).toThrow(/jwt audience invalid/);
  });

  it('rejects an expired MCP token', () => {
    const token = jwt.sign({ username: 'x' }, MCP_SECRET, {
      issuer: MCP_ISSUER,
      audience: MCP_AUDIENCE,
      expiresIn: -10,
    });
    expect(() => verifyMcpToken(token, MCP_SECRET)).toThrow(/jwt expired/);
  });

  it('pins HS256 so an alg-confusion token cannot be substituted', () => {
    const token = jwt.sign({ username: 'x' }, MCP_SECRET, {
      algorithm: 'HS512',
      issuer: MCP_ISSUER,
      audience: MCP_AUDIENCE,
      expiresIn: '8h',
    });
    expect(() => verifyMcpToken(token, MCP_SECRET)).toThrow(/invalid algorithm/);
  });

  it('rejects a garbage token', () => {
    expect(() => verifyMcpToken('not-a-jwt', MCP_SECRET)).toThrow();
    expect(() => verifyMcpToken('', MCP_SECRET)).toThrow();
  });
});

describe('http-server.js wires the hardened primitives', () => {
  it('no longer falls back to SESSION_SECRET', () => {
    expect(SRC).not.toContain('process.env.MCP_SECRET || process.env.SESSION_SECRET');
  });

  it('does not call jwt.verify without verification options', () => {
    expect(SRC).not.toMatch(/jwt\.verify\(\s*token\s*,\s*JWT_SECRET\s*\)/);
  });

  it('delegates verification to the shared module', () => {
    expect(SRC).toContain('verifyMcpToken');
    expect(SRC).toContain('signMcpToken');
    expect(SRC).toContain('resolveMcpSecret');
  });
});
