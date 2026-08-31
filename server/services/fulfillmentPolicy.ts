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
 *
 * Production detection goes through isProductionEnv(), which normalises casing
 * and whitespace. A literal `NODE_ENV === 'production'` comparison meant a
 * deployment set to `NODE_ENV=PRODUCTION` was treated as non-production and both
 * production-only protections below failed OPEN.
 */

import { isProductionEnv } from '../lib/env';

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
  if (isProductionEnv()) {
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

/**
 * Whether a deposit may be fulfilled WITHOUT a confirmed Stripe payment.
 *
 * This exists only so local/demo environments can walk the deposit flow end to
 * end without a real card charge. It is fail-closed and requires ALL of:
 *   1. the environment is NOT production, AND
 *   2. an operator explicitly opts in (`ALLOW_UNCONFIRMED_DEPOSITS=true`), AND
 *   3. Stripe is actually pointed at a test key (`sk_test_...`).
 *
 * A test-mode key ALONE must never bypass confirmation: a production-shaped
 * deployment that still holds an `sk_test_` key would otherwise credit an
 * unpaid wallet. Production always fails closed, whatever the flags say.
 */
export function isUnconfirmedDepositBypassAllowed(): boolean {
  if (isProductionEnv()) {
    return false;
  }
  const optedIn = process.env.ALLOW_UNCONFIRMED_DEPOSITS === 'true';
  const usingTestKey = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ?? false;
  return optedIn && usingTestKey;
}

/** Honest, non-randomized display name for a card-funded wallet deposit. */
export const DEPOSIT_MERCHANT_DISPLAY_NAME = 'CardXC Wallet Deposit';

/** Honest, non-randomized description for a card-funded wallet deposit. */
export function depositDescription(): string {
  return 'Card deposit to CardXC wallet';
}
