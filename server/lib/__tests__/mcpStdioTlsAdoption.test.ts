/**
 * @vitest-environment node
 *
 * MEDIUM-3 — MCP stdio DB connections must adopt the centralized TLS policy.
 *
 * `mcp-server/http-server.js` already passes `buildPgSslConfig()` into every
 * `pg.Client` it creates. `mcp-server/index.js` (the stdio transport) currently
 * constructs `pg.Client` with only a `connectionString`, so it bypasses the
 * fail-closed policy in `mcp-server/env.js`.
 *
 * This is an adoption test: every `pg.Client` / `pg.Pool` created under
 * `mcp-server/**` must route the connection through `buildPgSslConfig` (or an
 * equivalent central helper), and no call site may hardcode
 * `rejectUnauthorized: false`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MCP_DIR = join(process.cwd(), 'mcp-server');

/**
 * Find all `new pg.Client(<balanced-args>)` and `new pg.Pool(<balanced-args>)`
 * calls in a JS/TS source and return the argument strings.
 */
function findPgConstructorArgs(source: string): string[] {
  const args: string[] = [];
  const pattern = /new\s+(?:pg\s*\.\s*)?(?:Client|Pool)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === '"' || ch === "'" || ch === '`') {
        // Skip over string literal.
        const quote = ch;
        i++;
        while (i < source.length && source[i] !== quote) {
          if (source[i] === '\\' && i + 1 < source.length) i++;
          i++;
        }
      } else if (source.slice(i, i + 2) === '//') {
        // Skip to end of line for single-line comment.
        while (i < source.length && source[i] !== '\n') i++;
        continue;
      } else if (source.slice(i, i + 2) === '/*') {
        // Skip block comment.
        i += 2;
        while (i < source.length - 1 && !(source[i] === '*' && source[i + 1] === '/')) i++;
        i++;
      }
      i++;
    }
    if (depth === 0) {
      args.push(source.slice(start, i - 1).trim());
    }
  }
  return args;
}

function assertConstructorAdoptsTls(fileName: string, src: string, arg: string) {
  // Direct adoption: the constructor argument calls buildPgSslConfig.
  if (/buildPgSslConfig\s*\(/.test(arg)) {
    expect(arg, `${fileName} DB client hardcodes rejectUnauthorized=false`)
      .not.toMatch(/rejectUnauthorized\s*:\s*false/);
    return;
  }

  // Indirect adoption: ssl:<var> where <var> is assigned buildPgSslConfig(...) in scope.
  const sslMatch = arg.match(/ssl\s*:\s*([A-Za-z_$][A-Za-z0-9_$]*)\b/);
  if (sslMatch) {
    const varName = sslMatch[1];
    const assignment = new RegExp(
      `(?:const|let|var)\\s+${varName}\\s*=\\s*buildPgSslConfig\\s*\\(`,
    );
    expect(src, `${fileName} DB client ssl variable ${varName} is not built by buildPgSslConfig`)
      .toMatch(assignment);
    expect(arg, `${fileName} DB client hardcodes rejectUnauthorized=false`)
      .not.toMatch(/rejectUnauthorized\s*:\s*false/);
    return;
  }

  throw new Error(`${fileName} DB client is missing centralized TLS config: ${arg}`);
}

describe('MEDIUM-3: mcp-server DB clients adopt centralized TLS policy', () => {
  it('every pg.Client / pg.Pool in mcp-server/index.js uses buildPgSslConfig', () => {
    const src = readFileSync(join(MCP_DIR, 'index.js'), 'utf8');
    const args = findPgConstructorArgs(src);
    expect(args.length).toBeGreaterThan(0);
    for (const arg of args) {
      assertConstructorAdoptsTls('mcp-server/index.js', src, arg);
    }
  });

  it('every pg.Client / pg.Pool in mcp-server/http-server.js uses buildPgSslConfig', () => {
    const src = readFileSync(join(MCP_DIR, 'http-server.js'), 'utf8');
    const args = findPgConstructorArgs(src);
    expect(args.length).toBeGreaterThan(0);
    for (const arg of args) {
      assertConstructorAdoptsTls('mcp-server/http-server.js', src, arg);
    }
  });

  it('no mcp-server source sets NODE_TLS_REJECT_UNAUTHORIZED=0', () => {
    for (const f of ['index.js', 'http-server.js', 'env.js']) {
      const src = readFileSync(join(MCP_DIR, f), 'utf8');
      expect(src).not.toMatch(/NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0['"]?/);
      expect(src).not.toMatch(/process\.env\.NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0['"]?/);
    }
  });
});
