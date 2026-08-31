/**
 * Canonical client-side USDT amount rule.
 *
 * PHASE 5 finding: the crypto withdrawal modal advertised `step="0.00000001"`
 * and a `0.00000000` placeholder, inviting up to 8 decimal places, while the
 * ledger stores `wallets.usdt_balance_cents` — TWO decimals. The server now
 * rejects anything finer than 2 dp (it must, or the chain can be sent more than
 * the wallet was debited), so an 8-decimal input produced a confusing 400 at
 * submit time.
 *
 * The system's accounting precision is 2 decimals. This helper is the single
 * client-side expression of that rule, deliberately mirroring the server's
 * `parseUsdtAmountToCents` in `server/services/cryptoProviderService.ts`:
 * it parses the DIGIT STRING rather than multiplying a float, so no rounding
 * decision is ever made, and it REJECTS rather than truncating.
 */

/** Decimal places of the USDT ledger unit. */
export const USDT_LEDGER_DECIMALS = 2;

/** Input step matching the ledger precision. */
export const USDT_AMOUNT_STEP = '0.01';

/**
 * Parse a user-entered USDT amount into integer ledger cents, or null when it is
 * not exactly representable.
 *
 * Rejects: more than 2 decimal places, exponent notation, hex, thousands
 * separators, negatives, non-finite values, and anything non-numeric.
 */
export function parseUsdtAmountToCents(input: unknown): number | null {
  let text: string;
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) return null;
    text = input.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
  } else if (typeof input === 'string') {
    text = input.trim();
  } else {
    return null;
  }

  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!m) return null;

  const frac = (m[2] ?? '').padEnd(USDT_LEDGER_DECIMALS, '0');
  const cents = Number(m[1]) * 10 ** USDT_LEDGER_DECIMALS + Number(frac);
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}

/** Whether a user-entered USDT amount is exactly representable in the ledger. */
export function isValidUsdtAmount(input: unknown): boolean {
  return parseUsdtAmountToCents(input) !== null;
}

/** Format a USDT amount for display at ledger precision. */
export function formatUsdt(amount: number): string {
  return Number.isFinite(amount) ? amount.toFixed(USDT_LEDGER_DECIMALS) : '0.00';
}
