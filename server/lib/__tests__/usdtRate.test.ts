/**
 * @vitest-environment node
 *
 * CONFIRMED LOW — an unvalidated USDT_RATE divisor.
 *
 * Both card-deposit fulfillment files did
 * `parseFloat(process.env.USDT_RATE || '1.0')` and divided by it with no checks:
 *   USDT_RATE=0    -> Infinity
 *   USDT_RATE=abc  -> NaN
 *   USDT_RATE=-1   -> a negative credit
 *   USDT_RATE=0.5  -> silently DOUBLES every stablecoin credit (no error at all)
 *
 * The rate must be refused rather than defaulted when it cannot be trusted, so a
 * misconfiguration can never mint value.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveUsdtRate,
  usdtCentsForFiatCents,
  DEFAULT_USDT_RATE,
  MIN_USDT_RATE,
  MAX_USDT_RATE,
} from '../usdtRate';

const env = (v?: string) => ({ ...(v === undefined ? {} : { USDT_RATE: v }) }) as NodeJS.ProcessEnv;

describe('resolveUsdtRate', () => {
  it('defaults to parity when unset or blank', () => {
    expect(resolveUsdtRate(env())).toBe(DEFAULT_USDT_RATE);
    expect(resolveUsdtRate(env(''))).toBe(DEFAULT_USDT_RATE);
    expect(resolveUsdtRate(env('   '))).toBe(DEFAULT_USDT_RATE);
  });

  it('accepts a plain in-band decimal', () => {
    expect(resolveUsdtRate(env('1'))).toBe(1);
    expect(resolveUsdtRate(env('1.0'))).toBe(1);
    expect(resolveUsdtRate(env('1.01'))).toBe(1.01);
    expect(resolveUsdtRate(env('0.99'))).toBe(0.99);
  });

  it('REFUSES zero — the Infinity case', () => {
    expect(resolveUsdtRate(env('0'))).toBeNull();
    expect(resolveUsdtRate(env('0.0'))).toBeNull();
  });

  it('REFUSES a negative rate', () => {
    expect(resolveUsdtRate(env('-1'))).toBeNull();
    expect(resolveUsdtRate(env('-0.5'))).toBeNull();
  });

  it('REFUSES non-numeric text, including parseFloat-lenient forms', () => {
    // parseFloat('1abc') === 1, which would have silently been accepted.
    expect(resolveUsdtRate(env('1abc'))).toBeNull();
    expect(resolveUsdtRate(env('abc'))).toBeNull();
    expect(resolveUsdtRate(env('NaN'))).toBeNull();
    expect(resolveUsdtRate(env('Infinity'))).toBeNull();
    expect(resolveUsdtRate(env('1e0'))).toBeNull();
    expect(resolveUsdtRate(env('0x1'))).toBeNull();
    expect(resolveUsdtRate(env('1,0'))).toBeNull();
  });

  it('REFUSES an out-of-band rate that would silently multiply the credit', () => {
    // 0.5 would DOUBLE every credit; 2.0 is the upper bound; beyond is refused.
    expect(resolveUsdtRate(env('0.49'))).toBeNull();
    expect(resolveUsdtRate(env('2.01'))).toBeNull();
    expect(resolveUsdtRate(env('100'))).toBeNull();
    // The boundaries themselves are accepted.
    expect(resolveUsdtRate(env(String(MIN_USDT_RATE)))).toBe(MIN_USDT_RATE);
    expect(resolveUsdtRate(env(String(MAX_USDT_RATE)))).toBe(MAX_USDT_RATE);
  });
});

describe('usdtCentsForFiatCents', () => {
  it('converts at parity', () => {
    expect(usdtCentsForFiatCents(10_000, 1)).toBe(10_000);
  });

  it('converts at an in-band rate', () => {
    expect(usdtCentsForFiatCents(10_000, 1.25)).toBe(8_000);
    expect(usdtCentsForFiatCents(10_000, 0.8)).toBe(12_500);
  });

  it('is fail-safe on an unusable rate rather than producing Infinity/NaN', () => {
    expect(usdtCentsForFiatCents(10_000, 0)).toBeNull();
    expect(usdtCentsForFiatCents(10_000, -1)).toBeNull();
    expect(usdtCentsForFiatCents(10_000, Number.NaN)).toBeNull();
    expect(usdtCentsForFiatCents(10_000, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('is fail-safe on an unusable amount', () => {
    expect(usdtCentsForFiatCents(-1, 1)).toBeNull();
    expect(usdtCentsForFiatCents(Number.NaN, 1)).toBeNull();
    expect(usdtCentsForFiatCents(Number.POSITIVE_INFINITY, 1)).toBeNull();
  });

  it('always returns a safe integer', () => {
    for (const cents of [0, 1, 99, 10_000, 250_000]) {
      const v = usdtCentsForFiatCents(cents, 1.07);
      expect(v).not.toBeNull();
      expect(Number.isSafeInteger(v)).toBe(true);
    }
  });
});
