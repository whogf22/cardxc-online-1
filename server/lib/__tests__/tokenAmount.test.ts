/**
 * @vitest-environment node
 *
 * TRON deposit amounts must reach Postgres as EXACT decimal values.
 *
 * The monitor computed `Number(rawAmount) / Math.pow(10, decimals)` and compared
 * that IEEE-754 double against a NUMERIC(20,8) column with `expected_amount = $1`.
 * For large base amounts the 6-decimal discriminator is not exactly representable
 * in a double, so a legitimate deposit silently fails to match and is parked as
 * unattributed. Conversely a double that prints differently than it compares can
 * make an exact SQL equality behave unpredictably.
 *
 * The fix converts base units to a decimal STRING with BigInt — no floating point
 * anywhere on the path. Matching stays EXACT: no epsilon, no tolerance.
 */
import { describe, it, expect } from 'vitest';
import { baseUnitsToExactDecimal } from '../tokenAmount';

describe('baseUnitsToExactDecimal — exact, no floating point', () => {
  it('converts a standard 6-decimal amount', () => {
    expect(baseUnitsToExactDecimal('1000000', 6)).toBe('1.000000');
    expect(baseUnitsToExactDecimal('1500000', 6)).toBe('1.500000');
    expect(baseUnitsToExactDecimal('123456789', 6)).toBe('123.456789');
  });

  it('keeps all 6 decimals including the trailing discriminator digit', () => {
    // The deposit-intent discriminator lives in the last decimal places.
    expect(baseUnitsToExactDecimal('100000001', 6)).toBe('100.000001');
    expect(baseUnitsToExactDecimal('1', 6)).toBe('0.000001');
  });

  it('supports 8 decimals', () => {
    expect(baseUnitsToExactDecimal('100000000', 8)).toBe('1.00000000');
    expect(baseUnitsToExactDecimal('1', 8)).toBe('0.00000001');
    expect(baseUnitsToExactDecimal('123456789012', 8)).toBe('1234.56789012');
  });

  it('supports 0 decimals', () => {
    expect(baseUnitsToExactDecimal('42', 0)).toBe('42');
  });

  it('handles the JS floating-point edge case that broke exact matching', () => {
    // 2^53 + 1 base units: Number() cannot represent this exactly.
    const raw = '9007199254740993'; // Number(raw) === 9007199254740992
    expect(Number(raw).toString()).not.toBe(raw); // precondition: double loses it
    const exact = baseUnitsToExactDecimal(raw, 6);
    expect(exact).toBe('9007199254.740993');
    // The old path produced a different value entirely.
    const legacy = (Number(raw) / 10 ** 6).toString();
    expect(legacy).not.toBe(exact);
  });

  it('a ONE base-unit difference produces a different string (no collapsing)', () => {
    const a = baseUnitsToExactDecimal('9007199254740993', 6);
    const b = baseUnitsToExactDecimal('9007199254740994', 6);
    expect(a).not.toBe(b);
  });

  it('accepts bigint and numeric-string inputs identically', () => {
    expect(baseUnitsToExactDecimal(1000000n, 6)).toBe('1.000000');
    expect(baseUnitsToExactDecimal('1000000', 6)).toBe('1.000000');
  });

  it('handles very large amounts without overflow', () => {
    const raw = '123456789012345678901234';
    expect(baseUnitsToExactDecimal(raw, 6)).toBe('123456789012345678.901234');
  });

  describe('fails closed on malformed input', () => {
    it.each([
      ['not-a-number'],
      [''],
      ['   '],
      ['1.5'],       // base units are integers
      ['-1000000'],  // negative
      ['1e6'],       // exponent notation
      ['0x10'],
      ['١٢٣'],       // non-ASCII digits
    ])('rejects %j', (raw) => {
      expect(baseUnitsToExactDecimal(raw as string, 6)).toBeNull();
    });

    it.each([[-1], [1.5], [NaN], [Infinity], [100]])('rejects decimals=%p', (d) => {
      expect(baseUnitsToExactDecimal('1000000', d as number)).toBeNull();
    });

    it('rejects nullish input', () => {
      expect(baseUnitsToExactDecimal(null as unknown as string, 6)).toBeNull();
      expect(baseUnitsToExactDecimal(undefined as unknown as string, 6)).toBeNull();
    });

    it('rejects zero (not a creditable deposit)', () => {
      expect(baseUnitsToExactDecimal('0', 6)).toBeNull();
    });
  });

  it('never uses floating point — result is derived only from BigInt', () => {
    // A value whose double representation would round: proves the string is not
    // produced by Number().toFixed().
    const raw = '999999999999999999';
    const exact = baseUnitsToExactDecimal(raw, 6);
    expect(exact).toBe('999999999999.999999');
    expect(exact).not.toBe((Number(raw) / 1e6).toFixed(6));
  });
});
