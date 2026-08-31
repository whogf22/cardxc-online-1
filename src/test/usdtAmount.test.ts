/**
 * PHASE 5 — the client-side USDT amount rule must agree EXACTLY with the server.
 *
 * The server rejects anything finer than 2 dp on POST /api/withdraw/crypto (it
 * must, or the chain can receive more USDT than the wallet was debited). The
 * withdrawal modal advertised `step="0.00000001"` and a `0.00000000`
 * placeholder, so a user entering 10.005 got an opaque 400 at submit time.
 *
 * The system's accounting precision is 2 decimals (`usdt_balance_cents`). These
 * tests pin that one rule client-side, using the SAME boundary set the server
 * suite uses so the two cannot drift.
 */
import { describe, it, expect } from 'vitest';
import {
  parseUsdtAmountToCents,
  isValidUsdtAmount,
  formatUsdt,
  USDT_AMOUNT_STEP,
  USDT_LEDGER_DECIMALS,
} from '../lib/usdtAmount';

describe('parseUsdtAmountToCents (client)', () => {
  it('accepts amounts at or coarser than ledger precision', () => {
    expect(parseUsdtAmountToCents('0')).toBe(0);
    expect(parseUsdtAmountToCents('0.01')).toBe(1);
    expect(parseUsdtAmountToCents('0.10')).toBe(10);
    expect(parseUsdtAmountToCents('0.29')).toBe(29);
    expect(parseUsdtAmountToCents('1.00')).toBe(100);
    expect(parseUsdtAmountToCents('8.40')).toBe(840);
    expect(parseUsdtAmountToCents('10')).toBe(1000);
    expect(parseUsdtAmountToCents('10.99')).toBe(1099);
  });

  it('accepts leading zeros', () => {
    expect(parseUsdtAmountToCents('010.50')).toBe(1050);
    expect(parseUsdtAmountToCents('0000.01')).toBe(1);
  });

  it('accepts a large but safe amount', () => {
    expect(parseUsdtAmountToCents('1000000.00')).toBe(100_000_000);
  });

  it('REJECTS 3 and 6 decimal places — the over-send inputs', () => {
    expect(parseUsdtAmountToCents('10.001')).toBeNull();
    expect(parseUsdtAmountToCents('10.004')).toBeNull();
    expect(parseUsdtAmountToCents('10.005')).toBeNull();
    expect(parseUsdtAmountToCents('0.123456')).toBeNull();
    expect(parseUsdtAmountToCents('10.999999')).toBeNull();
  });

  it('REJECTS scientific notation', () => {
    expect(parseUsdtAmountToCents('1e2')).toBeNull();
    expect(parseUsdtAmountToCents('1E2')).toBeNull();
    expect(parseUsdtAmountToCents('1.5e1')).toBeNull();
  });

  it('REJECTS negatives', () => {
    expect(parseUsdtAmountToCents('-1')).toBeNull();
    expect(parseUsdtAmountToCents('-0.01')).toBeNull();
    expect(parseUsdtAmountToCents(-5)).toBeNull();
  });

  it('REJECTS NaN-like strings and non-finite numbers', () => {
    expect(parseUsdtAmountToCents('NaN')).toBeNull();
    expect(parseUsdtAmountToCents('Infinity')).toBeNull();
    expect(parseUsdtAmountToCents('abc')).toBeNull();
    expect(parseUsdtAmountToCents('1abc')).toBeNull();
    expect(parseUsdtAmountToCents(Number.NaN)).toBeNull();
    expect(parseUsdtAmountToCents(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('REJECTS separators, hex and malformed decimals', () => {
    expect(parseUsdtAmountToCents('1,000')).toBeNull();
    expect(parseUsdtAmountToCents('0x10')).toBeNull();
    expect(parseUsdtAmountToCents('10.00.00')).toBeNull();
    expect(parseUsdtAmountToCents('.5')).toBeNull();
    expect(parseUsdtAmountToCents('10.')).toBeNull();
  });

  it('tolerates surrounding whitespace but nothing else', () => {
    expect(parseUsdtAmountToCents('  10.00  ')).toBe(1000);
    expect(parseUsdtAmountToCents('1 0.00')).toBeNull();
  });

  it('REJECTS non-string, non-number input', () => {
    expect(parseUsdtAmountToCents(null)).toBeNull();
    expect(parseUsdtAmountToCents(undefined)).toBeNull();
    expect(parseUsdtAmountToCents({})).toBeNull();
    expect(parseUsdtAmountToCents([])).toBeNull();
  });

  it('always returns an integer', () => {
    for (const v of ['0', '0.01', '8.40', '10', '10.99', '1000000.00']) {
      const cents = parseUsdtAmountToCents(v);
      expect(cents).not.toBeNull();
      expect(Number.isInteger(cents)).toBe(true);
    }
  });
});

describe('isValidUsdtAmount', () => {
  it('mirrors the parser', () => {
    for (const v of ['10.00', '10.001', 'abc', '-1', '1e2', '0.01']) {
      expect(isValidUsdtAmount(v)).toBe(parseUsdtAmountToCents(v) !== null);
    }
  });
});

describe('display and input constants match the ledger', () => {
  it('the input step is ledger precision, not 8 decimals', () => {
    expect(USDT_AMOUNT_STEP).toBe('0.01');
    expect(USDT_LEDGER_DECIMALS).toBe(2);
  });

  it('formatUsdt renders at ledger precision', () => {
    expect(formatUsdt(10)).toBe('10.00');
    expect(formatUsdt(10.5)).toBe('10.50');
    expect(formatUsdt(0)).toBe('0.00');
    expect(formatUsdt(Number.NaN)).toBe('0.00');
  });
});

describe('the client rule agrees with the server rule', () => {
  it('the same boundary set produces the same accept/reject decision', () => {
    // These are the exact vectors asserted in
    // server/services/__tests__/usdtCanonicalAmount.test.ts.
    const accepted = ['0.01', '0.29', '8.40', '10', '10.5', '99.99', '1000000.00'];
    const rejected = ['10.004', '10.005', '10.0049999', '10.999999', '99.994999',
                      '1e2', '1E2', '1.5e1', '', '   ', 'abc', '10.00.00', '10,00',
                      '0x10', '-1.00', 'Infinity'];

    for (const v of accepted) expect(isValidUsdtAmount(v)).toBe(true);
    for (const v of rejected) expect(isValidUsdtAmount(v)).toBe(false);
  });
});
