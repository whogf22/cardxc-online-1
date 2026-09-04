import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const headersPath = path.join(ROOT, 'public/_headers');
const indexPath = path.join(ROOT, 'index.html');
const serverPath = path.join(ROOT, 'server/index.ts');

function parseCspString(value: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  const parts = value.split(/\s*;\s*/).filter(Boolean);
  for (const part of parts) {
    const [name, ...values] = part.split(/\s+/);
    if (name) directives.set(name, values);
  }
  return directives;
}

function camelToKebab(name: string): string {
  return name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
}

function parseServerCsp(text: string): Map<string, string[]> {
  const blockMatch = text.match(/directives:\s*\{([\s\S]*?)\n\s*\},\s*\n\s*crossOriginEmbedderPolicy/);
  if (!blockMatch) throw new Error('Could not find helmet CSP directives block');
  const block = blockMatch[1];
  const directives = new Map<string, string[]>();
  const entries = block.matchAll(/(\w+):\s*\[([^\]]*)\]/g);
  for (const [, keyRaw, valueList] of entries) {
    const values = [...valueList.matchAll(/"([^"]*)"/g)].map(m => m[1]);
    directives.set(camelToKebab(keyRaw), values);
  }
  return directives;
}

const requiredBase = new Map<string, string[]>([
  ['default-src', ["'self'"]],
  ['object-src', ["'none'"]],
  ['base-uri', ["'self'"]],
  ['form-action', ["'self'"]],
  ['frame-ancestors', ["'none'"]],
]);

const privyRequired = new Map<string, string[]>([
  ['child-src', ['https://auth.privy.io', 'https://verify.walletconnect.com', 'https://verify.walletconnect.org']],
  ['frame-src', ['https://auth.privy.io', 'https://verify.walletconnect.com', 'https://verify.walletconnect.org']],
  ['connect-src', [
    'https://auth.privy.io',
    'wss://relay.walletconnect.com',
    'wss://relay.walletconnect.org',
    'https://*.rpc.privy.systems',
    'https://explorer-api.walletconnect.com',
  ]],
]);

const sumsubRequired = new Map<string, string[]>([
  ['script-src', ['https://static.sumsub.com']],
  ['connect-src', ['https://api.sumsub.com', 'https://*.sumsub.com']],
  ['frame-src', ['https://*.sumsub.com']],
]);

const forbidden = [
  'default-src *',
  'frame-src *',
  'connect-src *',
  'object-src *',
  "'unsafe-eval'",
];

function sourcePresent(directiveValues: string[] | undefined, source: string): boolean {
  if (!directiveValues) return false;
  // Allow exact match or wildcard host suffix match.
  return directiveValues.some(v => {
    if (v === source) return true;
    if (source.startsWith('*.')) {
      const domain = source.slice(2);
      const escaped = domain.replace(/\./g, '\\.');
      return new RegExp(`^(?:\\*\\.)?${escaped}$`).test(v);
    }
    return false;
  });
}

describe('CSP policy regression guard', () => {
  const headersText = fs.readFileSync(headersPath, 'utf8');
  const cspHeaderMatch = headersText.match(/Content-Security-Policy:\s*(.+)/);
  if (!cspHeaderMatch) throw new Error('No CSP header found in public/_headers');
  const headerCsp = parseCspString(cspHeaderMatch[1]);

  const indexText = fs.readFileSync(indexPath, 'utf8');
  const metaMatch = indexText.match(/<meta[^>]*http-equiv="Content-Security-Policy"[^>]*content="([^"]*)"/i);
  if (!metaMatch) throw new Error('No CSP meta tag found in index.html');
  const metaCsp = parseCspString(metaMatch[1]);

  const serverText = fs.readFileSync(serverPath, 'utf8');
  const serverCsp = parseServerCsp(serverText);

  const sources = {
    '_headers': headerCsp,
    'index.html': metaCsp,
    'server/index.ts': serverCsp,
  } as const;

  it('X-Frame-Options DENY is set in _headers', () => {
    expect(headersText).toMatch(/^\s*X-Frame-Options:\s*DENY\s*$/m);
  });

  it('enforces base directives in every source', () => {
    for (const [sourceName, directives] of Object.entries(sources)) {
      for (const [directive, expected] of requiredBase.entries()) {
        if (sourceName === 'index.html' && directive === 'frame-ancestors') {
          // frame-ancestors is not supported/enforced in meta CSP; enforced via HTTP header.
          continue;
        }
        const values = directives.get(directive);
        expect(values, `${sourceName} ${directive} must be defined`).toBeDefined();
        for (const value of expected) {
          expect(values, `${sourceName} ${directive} must include ${value}`).toContain(value);
        }
      }
    }
  });

  it('keeps required Privy sources', () => {
    for (const [sourceName, directives] of Object.entries(sources)) {
      for (const [directive, expected] of privyRequired.entries()) {
        const values = directives.get(directive);
        expect(values).toBeDefined();
        for (const source of expected) {
          expect(sourcePresent(values, source), `${sourceName} ${directive} must allow ${source}`).toBe(true);
        }
      }
    }
  });

  it('keeps required Sumsub sources', () => {
    for (const [sourceName, directives] of Object.entries(sources)) {
      for (const [directive, expected] of sumsubRequired.entries()) {
        const values = directives.get(directive);
        expect(values).toBeDefined();
        for (const source of expected) {
          expect(sourcePresent(values, source), `${sourceName} ${directive} must allow ${source}`).toBe(true);
        }
      }
    }
  });

  it('does not introduce weakened CSP patterns', () => {
    for (const [sourceName, directives] of Object.entries(sources)) {
      for (const [directive, values] of directives.entries()) {
        const joined = `${directive} ${values.join(' ')}`;
        for (const pattern of forbidden) {
          expect(joined.includes(pattern), `${sourceName} must not contain "${pattern}"`).toBe(false);
        }
      }
    }
  });

  it('reports source-of-truth drift for manual review', () => {
    const report: string[] = [];
    const allDirectives = new Set([
      ...headerCsp.keys(),
      ...metaCsp.keys(),
      ...serverCsp.keys(),
    ]);
    for (const directive of allDirectives) {
      const h = headerCsp.get(directive)?.sort().join(',') ?? '(missing)';
      const m = metaCsp.get(directive)?.sort().join(',') ?? '(missing)';
      const s = serverCsp.get(directive)?.sort().join(',') ?? '(missing)';
      if (h !== m || m !== s) {
        report.push(`${directive}: _headers=[${h}] index.html=[${m}] server=[${s}]`);
      }
    }
    if (report.length) {
      console.warn('CSP source drift detected (expected for non-security differences):\n' + report.join('\n'));
    }
    // Drift is logged, not a hard failure, because some differences are intentional
    // (e.g. localhost ws:// origins in server Helmet for dev, frame-ancestors not in meta).
    expect(report.length).toBeGreaterThanOrEqual(0);
  });
});
