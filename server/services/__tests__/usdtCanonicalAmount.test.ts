/**
 * @vitest-environment node
 *
 * NEW-6 (MEDIUM) — the USDT ledger debit and the on-chain send amount must be
 * derived from ONE canonical integer.
 *
 * Two independent conversions ran off the same float:
 *   debit: Math.round(request.amount * 100)   -> 2-dp cents (the ledger unit)
 *   send:  Math.round(request.amount * 1e6)   -> 6-dp minor units (on chain)
 *
 * `POST /api/withdraw/crypto` validated only `isFloat({ min: 10 })`, with no
 * decimal-place constraint, so sub-cent precision reached both. Measured
 * over-send (chain minus ledger):
 *
 *   10.004      debits 10.00, sends 10.004000  -> +0.004000 USDT
 *   10.0049     debits 10.00, sends 10.004900  -> +0.004900 USDT
 *   10.0049999  debits 10.00, sends 10.005000  -> +0.005000 USDT
 *   99.994999   debits 99.99, sends 99.994999  -> +0.004999 USDT
 *
 * Repeatable per request and bounded only by the rate limiter: a real
 * ledger-versus-chain divergence.
 *
 * Also corrected here: the comment on `toUsdtMinorUnits` claimed
 * `0.29 * 1e6 === 289999.9999999999`. That is factually wrong — it evaluates to
 * exactly 290000 in IEEE-754 double precision, so the Math.floor -> Math.round
 * change was a no-op for every value its own test exercised. This suite pins the
 * real invariant instead.
 */
import { describe, it, expect } from 'vitest';
import {
  parseUsdtAmountToCents,
  centsToUsdtMinorUnits,
  toUsdtMinorUnits,
  USDT_DECIMALS,
  USDT_LEDGER_DECIMALS,
} from '../cryptoProviderService';

describe('parseUsdtAmountToCents — strict decimal parsing to the ledger unit', () => {
  it('accepts a plain decimal string and returns integer cents', () => {
    expect(parseUsdtAmountToCents('0.01')).toBe(1);
    expect(parseUsdtAmountToCents('0.29')).toBe(29);
    expect(parseUsdtAmountToCents('8.40')).toBe(840);
    expect(parseUsdtAmountToCents('10')).toBe(1000);
    expect(parseUsdtAmountToCents('10.5')).toBe(1050);
    expect(parseUsdtAmountToCents('99.99')).toBe(9999);
  });

  it('accepts a number and returns integer cents', () => {
    expect(parseUsdtAmountToCents(0.01)).toBe(1);
    expect(parseUsdtAmountToCents(8.4)).toBe(840);
    expect(parseUsdtAmountToCents(10)).toBe(1000);
  });

  it('REJECTS more than 2 decimal places rather than silently truncating', () => {
    // These are exactly the values that produced the over-send.
    expect(parseUsdtAmountToCents('10.004')).toBeNull();
    expect(parseUsdtAmountToCents('10.005')).toBeNull();
    expect(parseUsdtAmountToCents('10.0049999')).toBeNull();
    expect(parseUsdtAmountToCents('10.999999')).toBeNull();
    expect(parseUsdtAmountToCents('99.994999')).toBeNull();
    expect(parseUsdtAmountToCents(10.004)).toBeNull();
  });

  it('REJECTS exponent notation', () => {
    expect(parseUsdtAmountToCents('1e2')).toBeNull();
    expect(parseUsdtAmountToCents('1E2')).toBeNull();
    expect(parseUsdtAmountToCents('1.5e1')).toBeNull();
  });

  it('REJECTS malformed, negative, non-finite and non-numeric input', () => {
    expect(parseUsdtAmountToCents('')).toBeNull();
    expect(parseUsdtAmountToCents('   ')).toBeNull();
    expect(parseUsdtAmountToCents('abc')).toBeNull();
    expect(parseUsdtAmountToCents('10.00.00')).toBeNull();
    expect(parseUsdtAmountToCents('10,00')).toBeNull();
    expect(parseUsdtAmountToCents('0x10')).toBeNull();
    expect(parseUsdtAmountToCents('-1.00')).toBeNull();
    expect(parseUsdtAmountToCents('Infinity')).toBeNull();
    expect(parseUsdtAmountToCents(Number.NaN)).toBeNull();
    expect(parseUsdtAmountToCents(Number.POSITIVE_INFINITY)).toBeNull();
    expect(parseUsdtAmountToCents(-1)).toBeNull();
    expect(parseUsdtAmountToCents(null)).toBeNull();
    expect(parseUsdtAmountToCents(undefined)).toBeNull();
    expect(parseUsdtAmountToCents({} as unknown)).toBeNull();
    expect(parseUsdtAmountToCents('  10.00  ')).toBe(1000); // surrounding space is fine
  });

  it('rejects an amount beyond the safe-integer ledger range', () => {
    // 10^15 USDT would overflow safe integer arithmetic once scaled to 6 dp.
    expect(parseUsdtAmountToCents('1000000000000000')).toBeNull();
    // A large but safe amount is accepted.
    expect(parseUsdtAmountToCents('1000000.00')).toBe(100_000_000);
  });

  it('never returns a non-integer', () => {
    for (const v of ['0.01', '0.29', '8.40', '10', '10.5', '99.99', '1000000.00']) {
      const cents = parseUsdtAmountToCents(v);
      expect(cents).not.toBeNull();
      expect(Number.isInteger(cents)).toBe(true);
    }
  });
});

describe('centsToUsdtMinorUnits — one canonical integer drives the chain amount', () => {
  it('scales ledger cents to on-chain minor units with pure integer maths', () => {
    expect(centsToUsdtMinorUnits(1)).toBe(10_000);          // 0.01 USDT
    expect(centsToUsdtMinorUnits(29)).toBe(290_000);        // 0.29 USDT
    expect(centsToUsdtMinorUnits(840)).toBe(8_400_000);     // 8.40 USDT
    expect(centsToUsdtMinorUnits(1000)).toBe(10_000_000);   // 10.00 USDT
    expect(centsToUsdtMinorUnits(9999)).toBe(99_990_000);   // 99.99 USDT
  });

  it('the scale factor matches the declared decimal difference', () => {
    expect(USDT_DECIMALS - USDT_LEDGER_DECIMALS).toBe(4);
    expect(centsToUsdtMinorUnits(1)).toBe(10 ** (USDT_DECIMALS - USDT_LEDGER_DECIMALS));
  });

  it('NEVER sends more than was debited, across the boundary set', () => {
    for (const v of ['0.01', '0.29', '8.40', '10', '10.00', '10.5', '99.99', '1000000.00']) {
      const cents = parseUsdtAmountToCents(v)!;
      const sentMinor = centsToUsdtMinorUnits(cents);
      // Convert both to a common scale and compare exactly.
      const debitedMinor = cents * 10 ** (USDT_DECIMALS - USDT_LEDGER_DECIMALS);
      expect(sentMinor).toBe(debitedMinor);
      expect(sentMinor).toBeLessThanOrEqual(debitedMinor);
    }
  });

  it('is fail-safe on invalid input', () => {
    expect(centsToUsdtMinorUnits(-1)).toBe(0);
    expect(centsToUsdtMinorUnits(Number.NaN)).toBe(0);
    expect(centsToUsdtMinorUnits(Number.POSITIVE_INFINITY)).toBe(0);
    expect(centsToUsdtMinorUnits(1.5)).toBe(0); // cents must already be an integer
  });
});

describe('the documented float-precision claim was wrong', () => {
  it('0.29 * 1e6 is EXACTLY 290000 — floor and round agree', () => {
    // The old comment asserted 289999.9999999999, which made the
    // Math.floor -> Math.round change a no-op for its own test vectors.
    expect(0.29 * 1e6).toBe(290_000);
    expect(Math.floor(0.29 * 1e6)).toBe(Math.round(0.29 * 1e6));
    expect(Math.floor(8.4 * 1e6)).toBe(Math.round(8.4 * 1e6));
    expect(Math.floor(10.004 * 1e6)).toBe(Math.round(10.004 * 1e6));
  });

  it('toUsdtMinorUnits remains the raw 6-dp helper, no longer used to size a payout', () => {
    // Kept for unit conversion, but the payout path now derives from cents so a
    // sub-cent amount can never reach the chain.
    expect(toUsdtMinorUnits(0.000001)).toBe(1);
    expect(toUsdtMinorUnits(123.456789)).toBe(123_456_789);
  });
});
