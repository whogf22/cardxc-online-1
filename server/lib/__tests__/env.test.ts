/**
 * @vitest-environment node
 *
 * CONFIRMED LOW — production detection must not be defeated by casing.
 *
 * `process.env.NODE_ENV === 'production'` was compared literally in ~16 places.
 * A deployment set to `NODE_ENV=PRODUCTION` (or `Production`, or with stray
 * whitespace from a CI variable) was therefore treated as non-production, and
 * every production-only protection failed OPEN: mandatory KYC stopped being
 * mandatory, the unconfirmed-deposit bypass became reachable, cookies lost the
 * Secure flag, DB/SMTP TLS verification relaxed, stack traces were exposed, and
 * rate limits dropped to dev values.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { isProductionEnv, isNonProductionEnv, nodeEnv } from '../env';

const saved = process.env.NODE_ENV;
afterEach(() => {
  if (saved === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = saved;
});

describe('isProductionEnv', () => {
  it('recognises the conventional value', () => {
    expect(isProductionEnv({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('recognises production regardless of CASE', () => {
    for (const v of ['PRODUCTION', 'Production', 'PrOdUcTiOn']) {
      expect(isProductionEnv({ NODE_ENV: v } as NodeJS.ProcessEnv)).toBe(true);
    }
  });

  it('tolerates surrounding whitespace', () => {
    for (const v of [' production', 'production ', '  production  ', '\tproduction\n']) {
      expect(isProductionEnv({ NODE_ENV: v } as NodeJS.ProcessEnv)).toBe(true);
    }
  });

  it('accepts the common prod shorthand', () => {
    expect(isProductionEnv({ NODE_ENV: 'prod' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isProductionEnv({ NODE_ENV: 'PROD' } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('is FALSE for non-production values', () => {
    for (const v of ['development', 'dev', 'test', 'staging', 'preview', 'local', '']) {
      expect(isProductionEnv({ NODE_ENV: v } as NodeJS.ProcessEnv)).toBe(false);
    }
  });

  it('is FALSE when unset — never assume production by accident', () => {
    expect(isProductionEnv({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it('does not match a value that merely CONTAINS production', () => {
    // Guard against a loose substring implementation.
    for (const v of ['not-production', 'production-like', 'preproduction', 'productions']) {
      expect(isProductionEnv({ NODE_ENV: v } as NodeJS.ProcessEnv)).toBe(false);
    }
  });

  it('reads process.env by default', () => {
    process.env.NODE_ENV = 'PRODUCTION';
    expect(isProductionEnv()).toBe(true);
    process.env.NODE_ENV = 'test';
    expect(isProductionEnv()).toBe(false);
  });
});

describe('isNonProductionEnv', () => {
  it('is the exact inverse', () => {
    for (const v of ['production', 'PRODUCTION', 'prod', 'development', 'test', '']) {
      const env = { NODE_ENV: v } as NodeJS.ProcessEnv;
      expect(isNonProductionEnv(env)).toBe(!isProductionEnv(env));
    }
  });
});

describe('nodeEnv', () => {
  it('normalises to a trimmed lower-case string', () => {
    expect(nodeEnv({ NODE_ENV: '  PRODUCTION ' } as NodeJS.ProcessEnv)).toBe('production');
    expect(nodeEnv({ NODE_ENV: 'Test' } as NodeJS.ProcessEnv)).toBe('test');
  });

  it('is an empty string when unset', () => {
    expect(nodeEnv({} as NodeJS.ProcessEnv)).toBe('');
  });
});
