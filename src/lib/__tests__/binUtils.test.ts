/**
 * BIN Utilities Tests
 */
import { describe, it, expect } from 'vitest';
import {
  isBinSupported,
  getCardBrand,
  getBinValidation,
  getFormattedBinList,
  SUPPORTED_BINS,
} from '../binUtils';

describe('BIN Utilities', () => {
  describe('isBinSupported', () => {
    it('returns true for a supported Visa BIN', () => {
      expect(isBinSupported('414398')).toBe(true);
    });

    it('returns true for a supported Mastercard BIN', () => {
      expect(isBinSupported('542543')).toBe(true);
    });

    it('returns false for an unsupported BIN', () => {
      expect(isBinSupported('999999')).toBe(false);
    });

    it('returns false when card number is too short', () => {
      expect(isBinSupported('12345')).toBe(false);
    });

    it('returns true for a card number longer than 6 digits with a supported BIN prefix', () => {
      expect(isBinSupported('4143981234567890')).toBe(true);
    });

    it('returns false for empty string', () => {
      expect(isBinSupported('')).toBe(false);
    });
  });

  describe('getCardBrand', () => {
    it('returns VISA for card starting with 4', () => {
      expect(getCardBrand('4111111111111111')).toBe('VISA');
    });

    it('returns MASTERCARD for card starting with 51', () => {
      expect(getCardBrand('5100000000000000')).toBe('MASTERCARD');
    });

    it('returns MASTERCARD for card starting with 55', () => {
      expect(getCardBrand('5500000000000000')).toBe('MASTERCARD');
    });

    it('returns AMEX for card starting with 34', () => {
      expect(getCardBrand('340000000000000')).toBe('AMEX');
    });

    it('returns AMEX for card starting with 37', () => {
      expect(getCardBrand('370000000000000')).toBe('AMEX');
    });

    it('returns DISCOVER for card starting with 6011', () => {
      expect(getCardBrand('6011000000000000')).toBe('DISCOVER');
    });

    it('returns DISCOVER for card starting with 65', () => {
      expect(getCardBrand('6500000000000000')).toBe('DISCOVER');
    });

    it('returns UNKNOWN for unrecognized card prefix', () => {
      expect(getCardBrand('9999999999999999')).toBe('UNKNOWN');
    });
  });

  describe('getBinValidation', () => {
    it('returns isSupported false and no warning for short card numbers', () => {
      const result = getBinValidation('12345');
      expect(result.isSupported).toBe(false);
      expect(result.showWarning).toBe(false);
      expect(result.message).toBe('');
    });

    it('returns isSupported true and success message for supported BIN', () => {
      const result = getBinValidation('4143981234567890');
      expect(result.isSupported).toBe(true);
      expect(result.showWarning).toBe(false);
      expect(result.message).toContain('✓');
      expect(result.brand).toBe('VISA');
      expect(result.bin).toBe('414398');
    });

    it('returns isSupported false and warning for unsupported BIN', () => {
      const result = getBinValidation('999999');
      expect(result.isSupported).toBe(false);
      expect(result.showWarning).toBe(true);
      expect(result.message).toContain('✗');
      expect(result.message).toContain('999999');
    });

    it('returns MASTERCARD brand for Mastercard BIN', () => {
      const result = getBinValidation('542543');
      expect(result.brand).toBe('MASTERCARD');
      expect(result.isSupported).toBe(true);
    });
  });

  describe('getFormattedBinList', () => {
    it('returns a comma-separated list of all supported BINs', () => {
      const result = getFormattedBinList();
      expect(typeof result).toBe('string');
      SUPPORTED_BINS.forEach(bin => {
        expect(result).toContain(bin);
      });
    });
  });
});
