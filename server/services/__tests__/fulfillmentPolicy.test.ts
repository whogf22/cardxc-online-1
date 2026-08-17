/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import {
  isStablecoinFulfillmentEnabled,
  isKycRequiredForCardCheckout,
  isEmailVerificationRequiredForCardCheckout,
  DEPOSIT_MERCHANT_DISPLAY_NAME,
  depositDescription,
} from '../fulfillmentPolicy';

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.ENABLE_STABLECOIN_FULFILLMENT;
  delete process.env.REQUIRE_KYC_FOR_CARD_CHECKOUT;
  delete process.env.REQUIRE_EMAIL_VERIFIED_FOR_CARD_CHECKOUT;
  delete process.env.NODE_ENV;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('fulfillmentPolicy', () => {
  describe('isStablecoinFulfillmentEnabled', () => {
    it('is disabled (fail-closed) by default', () => {
      expect(isStablecoinFulfillmentEnabled()).toBe(false);
    });
    it('stays disabled for any value other than the exact string "true"', () => {
      process.env.ENABLE_STABLECOIN_FULFILLMENT = '1';
      expect(isStablecoinFulfillmentEnabled()).toBe(false);
      process.env.ENABLE_STABLECOIN_FULFILLMENT = 'yes';
      expect(isStablecoinFulfillmentEnabled()).toBe(false);
    });
    it('is enabled only when explicitly set to "true"', () => {
      process.env.ENABLE_STABLECOIN_FULFILLMENT = 'true';
      expect(isStablecoinFulfillmentEnabled()).toBe(true);
    });
  });

  describe('isKycRequiredForCardCheckout', () => {
    it('is mandatory in production regardless of the opt-in flag', () => {
      process.env.NODE_ENV = 'production';
      expect(isKycRequiredForCardCheckout()).toBe(true);
      process.env.REQUIRE_KYC_FOR_CARD_CHECKOUT = 'false';
      expect(isKycRequiredForCardCheckout()).toBe(true);
    });
    it('is optional (off) by default outside production', () => {
      process.env.NODE_ENV = 'development';
      expect(isKycRequiredForCardCheckout()).toBe(false);
    });
    it('can be opted into outside production', () => {
      process.env.NODE_ENV = 'development';
      process.env.REQUIRE_KYC_FOR_CARD_CHECKOUT = 'true';
      expect(isKycRequiredForCardCheckout()).toBe(true);
    });
  });

  describe('isEmailVerificationRequiredForCardCheckout', () => {
    it('is on by default', () => {
      expect(isEmailVerificationRequiredForCardCheckout()).toBe(true);
    });
    it('can be disabled explicitly', () => {
      process.env.REQUIRE_EMAIL_VERIFIED_FOR_CARD_CHECKOUT = 'false';
      expect(isEmailVerificationRequiredForCardCheckout()).toBe(false);
    });
  });

  describe('honest naming', () => {
    it('uses a fixed, honest deposit display name (no randomization)', () => {
      expect(DEPOSIT_MERCHANT_DISPLAY_NAME).toBe('CardXC Wallet Deposit');
      expect(depositDescription()).toMatch(/deposit/i);
    });
  });
});
