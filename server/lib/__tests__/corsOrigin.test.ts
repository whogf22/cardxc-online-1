/**
 * @vitest-environment node
 *
 * CSO finding #3 (MEDIUM) — CORS allowlist defects.
 *
 *   (a) `http://localhost:5000` and `http://localhost:5173` were hardcoded with
 *       no NODE_ENV guard, so production granted credentialed CORS to any page
 *       served from those local ports.
 *   (b) The comparison stripped the scheme before matching
 *       (`origin.replace(/^https?:\/\//, '')`), so `http://cardxc.online` was
 *       accepted wherever `https://cardxc.online` had been configured.
 *
 * Both are exercised here against the extracted pure helpers.
 */
import { describe, it, expect } from 'vitest';
import { buildAllowedOrigins, isOriginAllowed } from '../corsOrigin';

const PROD_ENV = {
  REPLIT_DOMAINS: 'cardxc.online,www.cardxc.online',
};

describe('buildAllowedOrigins — localhost is non-production only', () => {
  it('excludes localhost origins in production', () => {
    const allowed = buildAllowedOrigins(PROD_ENV, true);
    expect(allowed).not.toContain('http://localhost:5000');
    expect(allowed).not.toContain('http://localhost:5173');
    expect(allowed.some((o) => o.includes('localhost'))).toBe(false);
  });

  it('includes localhost origins outside production', () => {
    const allowed = buildAllowedOrigins(PROD_ENV, false);
    expect(allowed).toContain('http://localhost:5000');
    expect(allowed).toContain('http://localhost:5173');
  });

  it('still honours configured domains in production', () => {
    const allowed = buildAllowedOrigins(PROD_ENV, true);
    expect(allowed).toContain('https://cardxc.online');
    expect(allowed).toContain('https://www.cardxc.online');
  });

  it('normalises bare REPLIT_DOMAINS entries to https', () => {
    const allowed = buildAllowedOrigins({ REPLIT_DOMAINS: 'example.com' }, true);
    expect(allowed).toContain('https://example.com');
    expect(allowed).not.toContain('http://example.com');
  });

  it('preserves an explicit https scheme in REPLIT_DOMAINS', () => {
    const allowed = buildAllowedOrigins({ REPLIT_DOMAINS: 'https://a.example' }, true);
    expect(allowed).toContain('https://a.example');
  });

  it('drops an explicit http:// entry in production', () => {
    // A misconfigured cleartext entry would hand out credentialed CORS over
    // plain HTTP — the exact downgrade scheme-exact matching exists to stop.
    const allowed = buildAllowedOrigins({ REPLIT_DOMAINS: 'http://cardxc.online' }, true);
    expect(allowed).not.toContain('http://cardxc.online');
    expect(allowed).toEqual([]);
  });

  it('keeps an explicit http:// entry outside production', () => {
    const allowed = buildAllowedOrigins({ REPLIT_DOMAINS: 'http://dev.local' }, false);
    expect(allowed).toContain('http://dev.local');
  });

  it('drops an http:// REPLIT_DEV_DOMAIN in production too', () => {
    const allowed = buildAllowedOrigins({ REPLIT_DEV_DOMAIN: 'http://d.example' }, true);
    expect(allowed).not.toContain('http://d.example');
  });

  it('drops an http:// REPLIT_DEV_DOMAIN outside production as well when https is implied', () => {
    const allowed = buildAllowedOrigins({ REPLIT_DEV_DOMAIN: 'd.example' }, false);
    expect(allowed).toContain('https://d.example');
  });

  it('includes REPLIT_DEV_DOMAIN outside production', () => {
    const allowed = buildAllowedOrigins({ REPLIT_DEV_DOMAIN: 'dev.example' }, false);
    expect(allowed).toContain('https://dev.example');
  });

  it('EXCLUDES REPLIT_DEV_DOMAIN in production', () => {
    // A preview host is the same class of risk as loopback: a production deploy
    // that inherits a stale value must not grant it credentialed CORS.
    const allowed = buildAllowedOrigins({ REPLIT_DEV_DOMAIN: 'dev.example' }, true);
    expect(allowed).not.toContain('https://dev.example');
    expect(allowed).toEqual([]);
  });

  it('still honours REPLIT_DOMAINS in production when a dev domain is also set', () => {
    const allowed = buildAllowedOrigins(
      { REPLIT_DEV_DOMAIN: 'dev.example', REPLIT_DOMAINS: 'cardxc.online' },
      true,
    );
    expect(allowed).toEqual(['https://cardxc.online']);
  });

  it('drops empty entries and trims whitespace', () => {
    const allowed = buildAllowedOrigins({ REPLIT_DOMAINS: ' a.example , , b.example ' }, true);
    expect(allowed).toEqual(expect.arrayContaining(['https://a.example', 'https://b.example']));
    expect(allowed).not.toContain('');
    expect(allowed.every((o) => o === o.trim())).toBe(true);
  });

  it('produces an empty allowlist in production with nothing configured', () => {
    // Fail closed: no configured domains means no cross-origin credentials.
    expect(buildAllowedOrigins({}, true)).toEqual([]);
  });
});

describe('isOriginAllowed — full-origin comparison including scheme', () => {
  const prodAllowed = buildAllowedOrigins(PROD_ENV, true);

  it('accepts an exact configured origin', () => {
    expect(isOriginAllowed('https://cardxc.online', prodAllowed)).toBe(true);
    expect(isOriginAllowed('https://www.cardxc.online', prodAllowed)).toBe(true);
  });

  it('rejects the http:// variant of an https:// allowlisted domain', () => {
    expect(isOriginAllowed('http://cardxc.online', prodAllowed)).toBe(false);
  });

  it('rejects localhost in production', () => {
    expect(isOriginAllowed('http://localhost:5173', prodAllowed)).toBe(false);
    expect(isOriginAllowed('http://localhost:5000', prodAllowed)).toBe(false);
  });

  it('accepts localhost outside production', () => {
    const devAllowed = buildAllowedOrigins(PROD_ENV, false);
    expect(isOriginAllowed('http://localhost:5173', devAllowed)).toBe(true);
  });

  it('rejects a subdomain that was not explicitly configured', () => {
    expect(isOriginAllowed('https://evil.cardxc.online', prodAllowed)).toBe(false);
  });

  it('rejects a suffix-collision domain', () => {
    expect(isOriginAllowed('https://cardxc.online.evil.com', prodAllowed)).toBe(false);
    expect(isOriginAllowed('https://notcardxc.online', prodAllowed)).toBe(false);
  });

  it('rejects a port-appended variant of an allowlisted origin', () => {
    expect(isOriginAllowed('https://cardxc.online:8443', prodAllowed)).toBe(false);
  });

  it('rejects a non-http scheme', () => {
    expect(isOriginAllowed('file://cardxc.online', prodAllowed)).toBe(false);
    expect(isOriginAllowed('null', prodAllowed)).toBe(false);
  });

  it('rejects a trailing-slash variant (Origin headers never carry a path)', () => {
    expect(isOriginAllowed('https://cardxc.online/', prodAllowed)).toBe(false);
  });

  it('rejects an empty or undefined origin (caller handles the no-Origin case)', () => {
    expect(isOriginAllowed('', prodAllowed)).toBe(false);
    expect(isOriginAllowed(undefined, prodAllowed)).toBe(false);
  });

  it('fails closed against an empty allowlist', () => {
    expect(isOriginAllowed('https://cardxc.online', [])).toBe(false);
  });

  it('is case-insensitive on scheme and host only', () => {
    // Origin comparison per RFC 6454 is case-insensitive for scheme and host.
    expect(isOriginAllowed('HTTPS://CARDXC.ONLINE', prodAllowed)).toBe(true);
  });
});
