/**
 * @vitest-environment node
 *
 * R3-5 (MEDIUM) — the USDT_RATE sanity band admitted its own documented dangerous
 * boundary.
 *
 * `server/lib/usdtRate.ts` opens by naming `USDT_RATE=0.5` as the worst case:
 * the rate is a DIVISOR, so 0.5 silently DOUBLES every stablecoin credit and
 * raises no error at all. The guard was then written as
 *
 *     if (rate < MIN_USDT_RATE || rate > MAX_USDT_RATE) return null;
 *
 * with `MIN_USDT_RATE = 0.5`, so `0.5 < 0.5` is false and the exact value the file
 * documents as value-minting was ACCEPTED. `0.49` was refused; `0.50` was not.
 *
 * The band is now the OPEN interval (MIN, MAX). Both edges represent a 2x peg
 * error on an asset whose whole premise is dollar parity — 0.5 mints half the
 * order again, 2.0 pays out half of what was charged — so neither is a rate a
 * correctly configured deployment can hold, and a fail-closed refusal is the only
 * safe reading of a value sitting exactly on the sanity limit.
 *
 * A refusal here is NOT a fallback: `resolveUsdtRate` returns null and callers must
 * skip the credit entirely (asserted at the bottom of this file). Guessing a rate
 * is what would mint or destroy value.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  resolveUsdtRate,
  usdtCentsForFiatCents,
  DEFAULT_USDT_RATE,
  MIN_USDT_RATE,
  MAX_USDT_RATE,
} from '../usdtRate';

const env = (v?: string) => ({ ...(v === undefined ? {} : { USDT_RATE: v }) }) as NodeJS.ProcessEnv;

describe('R3-5: the dangerous lower boundary fails closed', () => {
  it('exactly MIN_USDT_RATE is REFUSED', () => {
    // The reproduction. Before the fix this returned 0.5 and every stablecoin
    // credit downstream was doubled.
    expect(resolveUsdtRate(env(String(MIN_USDT_RATE)))).toBeNull();
  });

  it('every textual spelling of the boundary is refused, not just "0.5"', () => {
    // The regex accepts leading zeros and trailing zeros, so the same numeric
    // value can arrive in several shapes. All of them must fail closed.
    for (const spelling of ['0.5', '0.50', '0.500', '00.5']) {
      expect(resolveUsdtRate(env(spelling)), `spelling ${spelling}`).toBeNull();
    }
  });

  it('immediately below the boundary is refused', () => {
    expect(resolveUsdtRate(env('0.49'))).toBeNull();
    expect(resolveUsdtRate(env('0.499999'))).toBeNull();
    expect(resolveUsdtRate(env('0.1'))).toBeNull();
    expect(resolveUsdtRate(env('0.01'))).toBeNull();
  });

  it('immediately above the boundary is accepted', () => {
    // The band is open, not empty: a rate a hair inside it is still usable.
    expect(resolveUsdtRate(env('0.51'))).toBe(0.51);
    expect(resolveUsdtRate(env('0.500001'))).toBe(0.500001);
  });

  it('the doubling it prevented is real arithmetic, not a hypothetical', () => {
    // Pinned so the reason the boundary matters cannot be argued away later:
    // at 0.5 a $100.00 order would have credited 200.00 USDT.
    expect(usdtCentsForFiatCents(10_000, 0.5)).toBe(20_000);
    // And the resolver is what stands between a config value and that arithmetic.
    expect(resolveUsdtRate(env('0.5'))).toBeNull();
  });
});

describe('R3-5: the upper boundary fails closed the same way', () => {
  it('exactly MAX_USDT_RATE is REFUSED', () => {
    expect(resolveUsdtRate(env(String(MAX_USDT_RATE)))).toBeNull();
  });

  it('above the boundary is refused', () => {
    expect(resolveUsdtRate(env('2.01'))).toBeNull();
    expect(resolveUsdtRate(env('3'))).toBeNull();
    expect(resolveUsdtRate(env('100'))).toBeNull();
  });

  it('immediately below the boundary is accepted', () => {
    expect(resolveUsdtRate(env('1.99'))).toBe(1.99);
  });

  it('at 2.0 the user would have been paid half of what was charged', () => {
    expect(usdtCentsForFiatCents(10_000, 2)).toBe(5_000);
    expect(resolveUsdtRate(env('2.0'))).toBeNull();
  });

  it('the band is a non-empty OPEN interval', () => {
    expect(MIN_USDT_RATE).toBeLessThan(MAX_USDT_RATE);
    expect(resolveUsdtRate(env(String(MIN_USDT_RATE)))).toBeNull();
    expect(resolveUsdtRate(env(String(MAX_USDT_RATE)))).toBeNull();
    // Parity — the only rate a dollar-pegged stablecoin should normally hold —
    // sits strictly inside it.
    expect(DEFAULT_USDT_RATE).toBeGreaterThan(MIN_USDT_RATE);
    expect(DEFAULT_USDT_RATE).toBeLessThan(MAX_USDT_RATE);
    expect(resolveUsdtRate(env(String(DEFAULT_USDT_RATE)))).toBe(DEFAULT_USDT_RATE);
  });
});

describe('R3-5: absent / blank / malformed configuration', () => {
  it('missing, empty and whitespace-only default to parity', () => {
    // Parity is the ONLY safe default for a dollar-pegged asset: it is the identity
    // for the division, so an unset rate cannot change any amount.
    expect(resolveUsdtRate(env())).toBe(DEFAULT_USDT_RATE);
    expect(resolveUsdtRate(env(''))).toBe(DEFAULT_USDT_RATE);
    expect(resolveUsdtRate(env('   '))).toBe(DEFAULT_USDT_RATE);
    expect(resolveUsdtRate(env('\t\n'))).toBe(DEFAULT_USDT_RATE);
    expect(DEFAULT_USDT_RATE).toBe(1);
  });

  it('zero is refused — the Infinity case', () => {
    expect(resolveUsdtRate(env('0'))).toBeNull();
    expect(resolveUsdtRate(env('0.0'))).toBeNull();
    expect(resolveUsdtRate(env('0.000'))).toBeNull();
    expect(resolveUsdtRate(env('00'))).toBeNull();
  });

  it('negative rates are refused — the negative-credit case', () => {
    expect(resolveUsdtRate(env('-1'))).toBeNull();
    expect(resolveUsdtRate(env('-0.5'))).toBeNull();
    expect(resolveUsdtRate(env('-0.0'))).toBeNull();
  });

  it('malformed text is refused, including every parseFloat-lenient form', () => {
    for (const bad of [
      'abc', '1abc', '1.0abc', 'NaN', 'Infinity', '-Infinity',
      '1e0', '1E0', '1e2', '0x1', '0b1', '1,0', '1 0',
      '+1', '1.', '.5', '1.2.3', '--1', ' 1 . 0 ', 'null', 'undefined', 'true',
    ]) {
      expect(resolveUsdtRate(env(bad)), `input ${JSON.stringify(bad)}`).toBeNull();
    }
  });

  it('huge values are refused rather than overflowing the division', () => {
    expect(resolveUsdtRate(env('999999999999999999999999'))).toBeNull();
    expect(resolveUsdtRate(env('1'.repeat(400)))).toBeNull();
    // Number('1'.repeat(400)) is Infinity; it must not slip past as "in band".
    expect(Number('1'.repeat(400))).toBe(Number.POSITIVE_INFINITY);
  });

  it('a refusal is null, never a guessed substitute rate', () => {
    // If the resolver ever returned DEFAULT_USDT_RATE for a bad value, a
    // misconfigured deployment would credit at parity while believing it had
    // applied a rate. Every rejected input must be exactly null.
    for (const bad of ['0', '-1', 'abc', '0.5', '2.0', '100']) {
      const out = resolveUsdtRate(env(bad));
      expect(out, `input ${bad}`).toBeNull();
      expect(out).not.toBe(DEFAULT_USDT_RATE);
    }
  });
});

describe('R3-5: canonical integer money handling is preserved', () => {
  it('BIGINT-string fiat cents convert identically to the number form', () => {
    // node-postgres returns int8/BIGINT as a STRING; both must work and agree.
    const rate = resolveUsdtRate(env('1.25'))!;
    expect(rate).toBe(1.25);
    expect(usdtCentsForFiatCents('10000' as unknown as number, rate)).toBe(8_000);
    expect(usdtCentsForFiatCents(10_000, rate)).toBe(8_000);
    expect(usdtCentsForFiatCents('10000' as unknown as number, rate))
      .toBe(usdtCentsForFiatCents(10_000, rate));
  });

  it('the result is always a non-negative safe integer number of cents', () => {
    for (const cents of [0, 1, 7, 99, 10_000, 250_000, 999_999_99]) {
      for (const rate of [0.51, 1, 1.07, 1.99]) {
        const v = usdtCentsForFiatCents(cents, rate);
        expect(v, `${cents}@${rate}`).not.toBeNull();
        expect(Number.isSafeInteger(v)).toBe(true);
        expect(v as number).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('a fractional or unsafe fiat amount is refused, not truncated', () => {
    expect(usdtCentsForFiatCents(10.5, 1)).toBeNull();
    expect(usdtCentsForFiatCents(Number.MAX_SAFE_INTEGER + 2, 1)).toBeNull();
    expect(usdtCentsForFiatCents('10.5' as unknown as number, 1)).toBeNull();
    expect(usdtCentsForFiatCents('1e5' as unknown as number, 1)).toBeNull();
  });

  it('an unusable rate never yields Infinity, NaN or a negative credit', () => {
    for (const rate of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(usdtCentsForFiatCents(10_000, rate), `rate ${rate}`).toBeNull();
    }
  });
});

describe('R3-5: callers treat a refused rate as "do not credit"', () => {
  const ROOT = join(__dirname, '..', '..');
  const read = (p: string) => readFileSync(join(ROOT, p), 'utf8').replace(/\s+/g, ' ');

  // Both stablecoin fulfillment paths must branch on the null and skip the credit.
  // A `?? DEFAULT_USDT_RATE` or `|| 1` anywhere near these calls would reintroduce
  // exactly the silent-fallback behaviour the resolver exists to prevent.
  for (const file of ['routes/cardCheckout.ts', 'routes/depositOtp.ts']) {
    it(`${file} skips the stablecoin credit when the rate is refused`, () => {
      const src = read(file);
      expect(src).toContain('resolveUsdtRate()');
      expect(src).toMatch(/rate === null|rate == null|!rate/);
      expect(src).not.toMatch(/resolveUsdtRate\(\)\s*(\?\?|\|\|)/);
      expect(src).not.toMatch(/parseFloat\(\s*process\.env\.USDT_RATE/);
    });
  }

  it('no file computes a USDT amount by dividing by a raw env rate', () => {
    for (const file of ['routes/cardCheckout.ts', 'routes/depositOtp.ts']) {
      expect(read(file)).not.toMatch(/\/\s*USDT_RATE/);
    }
  });
});
