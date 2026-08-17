/**
 * Exact token-amount conversion for on-chain deposits.
 *
 * FIN-1 attribution matches an incoming transfer to a server-generated
 * `expected_amount` with EXACT SQL equality against a NUMERIC(20,8) column.
 * That equality is only trustworthy if the value reaching Postgres is exact.
 *
 * The previous path was `Number(rawAmount) / Math.pow(10, decimals)`, which
 * routes the amount through an IEEE-754 double. Above 2^53 base units the
 * low-order decimal digits — exactly where the attribution discriminator lives —
 * are no longer representable, so a legitimate deposit fails to match and is
 * parked as unattributed.
 *
 * This module converts base units to a decimal STRING using BigInt only. No
 * floating point is involved at any point. Matching remains EXACT: there is
 * deliberately no epsilon or tolerance anywhere.
 *
 * Covered by `server/lib/__tests__/tokenAmount.test.ts`.
 */

/** Only ASCII digits; base units are non-negative integers. */
const INTEGER_ONLY = /^[0-9]+$/;

/** Upper bound on token decimals we will accept (USDT-TRC20 is 6). */
const MAX_DECIMALS = 30;

/**
 * Convert raw base units to an exact decimal string.
 *
 * @param rawAmount base units, as a decimal string or bigint
 * @param decimals  token decimals (USDT-TRC20 = 6)
 * @returns exact decimal string, or null when the input is malformed / zero.
 *          Null means FAIL CLOSED — the caller must not credit anything.
 */
export function baseUnitsToExactDecimal(
  rawAmount: string | bigint,
  decimals: number,
): string | null {
  if (
    typeof decimals !== 'number' ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > MAX_DECIMALS
  ) {
    return null;
  }

  let units: bigint;
  if (typeof rawAmount === 'bigint') {
    units = rawAmount;
  } else if (typeof rawAmount === 'string') {
    const trimmed = rawAmount.trim();
    // Reject anything that is not a plain non-negative integer literal:
    // no signs, no decimal point, no exponent, no hex, no non-ASCII digits.
    if (!INTEGER_ONLY.test(trimmed)) return null;
    try {
      units = BigInt(trimmed);
    } catch {
      return null;
    }
  } else {
    return null;
  }

  if (units <= 0n) return null; // zero or negative is not a creditable deposit

  if (decimals === 0) return units.toString();

  const scale = 10n ** BigInt(decimals);
  const whole = units / scale;
  const frac = units % scale;

  // Left-pad the fraction so positional digits are preserved exactly.
  return `${whole.toString()}.${frac.toString().padStart(decimals, '0')}`;
}
