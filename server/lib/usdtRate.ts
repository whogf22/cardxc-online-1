/**
 * Validated USDT conversion rate for card-funded stablecoin fulfillment.
 *
 * CONFIRMED LOW — both fulfillment files did:
 *
 *   const USDT_RATE = parseFloat(process.env.USDT_RATE || '1.0');
 *   const usdtAmountCents = Math.round(order.amount_cents / USDT_RATE);
 *
 * with no validation of the divisor:
 *   - `USDT_RATE=0`      -> Infinity  (BIGINT insert fails loudly, but late)
 *   - `USDT_RATE=abc`    -> NaN       (same)
 *   - `USDT_RATE=-1`     -> a NEGATIVE credit
 *   - `USDT_RATE=0.5`    -> silently DOUBLES every stablecoin credit
 *
 * The last case is the dangerous one: it is not an error at all, just twice the
 * money. Mitigated in practice by the default-off ENABLE_STABLECOIN_FULFILLMENT
 * gate, but a misconfigured rate must never be able to mint value.
 *
 * Policy here is fail-closed: an absent rate defaults to 1.0 (USDT is a
 * dollar-pegged stablecoin, so parity is the only safe default), and anything
 * non-finite, non-positive, or outside a sane band is REFUSED rather than used.
 */

/** Default parity rate when USDT_RATE is unset. */
export const DEFAULT_USDT_RATE = 1.0;

/**
 * Accepted band for a USD/USDT rate. A dollar-pegged stablecoin trading outside
 * this range indicates a configuration error, not a market move.
 */
export const MIN_USDT_RATE = 0.5;
export const MAX_USDT_RATE = 2.0;

/**
 * Parse and validate USDT_RATE.
 *
 * Returns the rate, or null when the configured value cannot be trusted. Callers
 * MUST treat null as "do not credit" rather than substituting a fallback — a
 * silent fallback is how a misconfigured rate would mint or destroy value.
 */
export function resolveUsdtRate(env: NodeJS.ProcessEnv = process.env): number | null {
  const raw = env.USDT_RATE;
  if (raw === undefined || String(raw).trim() === '') return DEFAULT_USDT_RATE;

  // Reject anything that is not a plain decimal number, so '1abc' cannot parse
  // to 1 the way parseFloat would.
  const text = String(raw).trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;

  const rate = Number(text);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  if (rate < MIN_USDT_RATE || rate > MAX_USDT_RATE) return null;
  return rate;
}

/**
 * Normalise an amount-in-cents that may arrive as a BIGINT STRING.
 *
 * node-postgres maps OID 20 (int8/BIGINT) to `parseBigInteger`, which returns a
 * string, and this repository installs no `setTypeParser` override — so
 * `card_orders.amount_cents` and friends reach JavaScript as e.g. "10000".
 *
 * `Number.isFinite` does NOT coerce (ES2015: a non-Number argument returns
 * false), so guarding a DB value with it rejects every real row. Parse
 * explicitly instead, and stay strict: a digit string only, no exponent form, no
 * separators, no sign.
 */
function normaliseCents(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value === 'bigint') {
    return value >= 0n && value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
  }
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Convert a fiat amount in cents to a USDT amount in ledger cents at the given
 * validated rate. Fail-safe: returns null when either input is unusable, so the
 * caller skips the credit instead of writing a NaN/Infinity/negative value.
 *
 * Accepts the BIGINT string form as well as a number — see normaliseCents.
 */
export function usdtCentsForFiatCents(fiatCents: number, rate: number): number | null {
  const cents = normaliseCents(fiatCents);
  if (cents === null) return null;
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const out = Math.round(cents / rate);
  if (!Number.isSafeInteger(out) || out < 0) return null;
  return out;
}
