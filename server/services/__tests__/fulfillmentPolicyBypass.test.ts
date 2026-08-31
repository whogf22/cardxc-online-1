/**
 * @vitest-environment node
 *
 * Unit tests for HIGH-1: the OTP-deposit payment-confirmation bypass policy.
 *
 * A demo/local bypass of real Stripe payment confirmation must be fail-closed
 * and production-hard. It is permitted ONLY when ALL of the following hold:
 *   1. the environment is NOT production, AND
 *   2. an operator explicitly opts in (ALLOW_UNCONFIRMED_DEPOSITS=true), AND
 *   3. Stripe is actually pointed at a test key (sk_test_...).
 *
 * A test-mode key ALONE must never bypass confirmation — the pre-fix defect
 * was that any environment holding an sk_test_ key skipped confirmation, so a
 * production-shaped deployment could credit an unpaid wallet.
 */
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { isUnconfirmedDepositBypassAllowed } from '../fulfillmentPolicy';

const KEYS = ['NODE_ENV', 'STRIPE_SECRET_KEY', 'ALLOW_UNCONFIRMED_DEPOSITS'] as const;
let saved: Record<string, string | undefined>;

function setEnv(over: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
});
afterEach(() => setEnv(saved));

describe('isUnconfirmedDepositBypassAllowed()', () => {
  it('is FALSE in production even with a test key AND the opt-in set (fail-closed)', () => {
    setEnv({ NODE_ENV: 'production', STRIPE_SECRET_KEY: 'sk_test_abc', ALLOW_UNCONFIRMED_DEPOSITS: 'true' });
    expect(isUnconfirmedDepositBypassAllowed()).toBe(false);
  });

  it('is TRUE only when non-production AND opted-in AND using a test key', () => {
    setEnv({ NODE_ENV: 'development', STRIPE_SECRET_KEY: 'sk_test_abc', ALLOW_UNCONFIRMED_DEPOSITS: 'true' });
    expect(isUnconfirmedDepositBypassAllowed()).toBe(true);
  });

  it('is FALSE when opted-in with a LIVE key (a test key is required)', () => {
    setEnv({ NODE_ENV: 'development', STRIPE_SECRET_KEY: 'sk_live_abc', ALLOW_UNCONFIRMED_DEPOSITS: 'true' });
    expect(isUnconfirmedDepositBypassAllowed()).toBe(false);
  });

  it('is FALSE with a test key but NO explicit opt-in (a test key alone is insufficient)', () => {
    setEnv({ NODE_ENV: 'development', STRIPE_SECRET_KEY: 'sk_test_abc', ALLOW_UNCONFIRMED_DEPOSITS: undefined });
    expect(isUnconfirmedDepositBypassAllowed()).toBe(false);
  });

  it('treats an unset NODE_ENV as non-production (bypass allowed with opt-in + test key)', () => {
    setEnv({ NODE_ENV: undefined, STRIPE_SECRET_KEY: 'sk_test_abc', ALLOW_UNCONFIRMED_DEPOSITS: 'true' });
    expect(isUnconfirmedDepositBypassAllowed()).toBe(true);
  });
});
