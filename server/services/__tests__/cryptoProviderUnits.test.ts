/**
 * @vitest-environment node
 *
 * MEDIUM — USDT precision / rounding drift.
 *
 * `toUsdtMinorUnits` is the single canonical conversion from a USDT amount to
 * on-chain minor units (6 decimals for TRC20). It must:
 *   - use round-to-nearest, NOT Math.floor, so binary-float representation
 *     error does not silently under-send (0.29 * 1e6 === 289999.9999999999);
 *   - never emit fractional minor units;
 *   - fail safe (return 0) for non-finite or negative input rather than
 *     producing NaN / negative on-chain amounts.
 */
import { describe, it, expect } from 'vitest';
import { toUsdtMinorUnits, USDT_DECIMALS } from '../cryptoProviderService';

describe('toUsdtMinorUnits — canonical USDT minor-unit conversion', () => {
  it('uses 6 decimals', () => {
    expect(USDT_DECIMALS).toBe(6);
  });

  it('converts whole amounts exactly', () => {
    expect(toUsdtMinorUnits(10)).toBe(10_000_000);
    expect(toUsdtMinorUnits(1)).toBe(1_000_000);
  });

  it('does NOT under-send on float-error-prone values (round, not floor)', () => {
    // 0.29 * 1e6 === 289999.9999999999 in IEEE-754; Math.floor would give
    // 289999 and under-send. Round-to-nearest gives the correct 290000.
    expect(toUsdtMinorUnits(0.29)).toBe(290_000);
    expect(toUsdtMinorUnits(1.1)).toBe(1_100_000);
    expect(toUsdtMinorUnits(8.4)).toBe(8_400_000);
  });

  it('handles the smallest representable minor unit', () => {
    expect(toUsdtMinorUnits(0.000001)).toBe(1);
  });

  it('rounds sub-minor-unit dust to the nearest minor unit', () => {
    // 0.0000004 USDT is below half a minor unit → rounds down to 0.
    expect(toUsdtMinorUnits(0.0000004)).toBe(0);
    // 0.0000006 USDT is above half a minor unit → rounds up to 1.
    expect(toUsdtMinorUnits(0.0000006)).toBe(1);
  });

  it('preserves full 6-dp precision', () => {
    expect(toUsdtMinorUnits(123.456789)).toBe(123_456_789);
  });

  it('never emits fractional minor units', () => {
    for (const amount of [0.29, 1.1, 8.4, 123.456789, 0.333333, 99.999999]) {
      expect(Number.isInteger(toUsdtMinorUnits(amount))).toBe(true);
    }
  });

  it('handles large amounts without drift', () => {
    expect(toUsdtMinorUnits(1_000_000)).toBe(1_000_000_000_000);
  });

  it('fails safe (0) for invalid or negative input', () => {
    expect(toUsdtMinorUnits(-1)).toBe(0);
    expect(toUsdtMinorUnits(Number.NaN)).toBe(0);
    expect(toUsdtMinorUnits(Number.POSITIVE_INFINITY)).toBe(0);
    expect(toUsdtMinorUnits(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(toUsdtMinorUnits(0)).toBe(0);
  });
});
