/**
 * Central policy for card-funded deposit fulfillment.
 *
 * Production-safety posture (fail-closed by default):
 * - A card payment (Stripe or provider) credits ONLY the user's fiat wallet
 *   balance. Automatic stablecoin/crypto (USDT) fulfillment from card funds is
 *   DISABLED unless an operator explicitly opts in — this avoids using a card
 *   network to fund a crypto/stablecoin purchase without the required licensing,
 *   provider agreements, and disclosures.
 * - KYC is mandatory for card checkout in production regardless of any flag.
 * - Deposit descriptions must honestly reflect the real purpose (a wallet
 *   top-up funded by card); we never synthesize fake merchant names.
 *
 * All flags are read at call time (not module load) so behavior is deterministic
 * in tests and can be toggled per-environment without re-importing.
 */

/**
 * Whether stablecoin/crypto (USDT) fulfillment from card-funded deposits is
 * enabled. OFF unless `ENABLE_STABLECOIN_FULFILLMENT=true` is explicitly set.
 */
export function isStablecoinFulfillmentEnabled(): boolean {
  return process.env.ENABLE_STABLECOIN_FULFILLMENT === 'true';
}

/**
 * Whether KYC (approved status) is required before a user may fund their wallet
 * with a card. Always required in production; opt-in elsewhere via
 * `REQUIRE_KYC_FOR_CARD_CHECKOUT=true`.
 */
export function isKycRequiredForCardCheckout(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return true;
  }
  return process.env.REQUIRE_KYC_FOR_CARD_CHECKOUT === 'true';
}

/**
 * Whether a verified email is required before card checkout. On by default;
 * disable only with `REQUIRE_EMAIL_VERIFIED_FOR_CARD_CHECKOUT=false`.
 */
export function isEmailVerificationRequiredForCardCheckout(): boolean {
  return process.env.REQUIRE_EMAIL_VERIFIED_FOR_CARD_CHECKOUT !== 'false';
}

/** Honest, non-randomized display name for a card-funded wallet deposit. */
export const DEPOSIT_MERCHANT_DISPLAY_NAME = 'CardXC Wallet Deposit';

/** Honest, non-randomized description for a card-funded wallet deposit. */
export function depositDescription(): string {
  return 'Card deposit to CardXC wallet';
}
