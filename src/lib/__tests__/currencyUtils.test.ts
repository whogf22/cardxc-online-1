/**
 * Currency Utilities Tests
 */

import { convertAmount, formatCurrency, getCurrencySymbol, parseToUSD } from '../currencyUtils';
import type { CurrencyRate } from '../currencyUtils';

describe('Currency Utilities', () => {
  const mockRates: CurrencyRate[] = [
    { currency_code: 'USD', rate_to_usd: 1 },
    { currency_code: 'NGN', rate_to_usd: 1500 },
    { currency_code: 'BDT', rate_to_usd: 110 },
  ];

  describe('getCurrencySymbol', () => {
    it('should return correct symbol for USD', () => {
      expect(getCurrencySymbol('USD')).toBe('$');
    });

    it('should return correct symbol for NGN', () => {
      expect(getCurrencySymbol('NGN')).toBe('₦');
    });

    it('should return correct symbol for BDT', () => {
      expect(getCurrencySymbol('BDT')).toBe('৳');
    });
  });

  describe('convertAmount', () => {
    it('should return same amount for USD', () => {
      expect(convertAmount(100, 'USD', mockRates)).toBe(100);
    });

    it('should convert USD to NGN correctly', () => {
      expect(convertAmount(1, 'NGN', mockRates)).toBe(1500);
    });

    it('should convert USD to BDT correctly', () => {
      expect(convertAmount(1, 'BDT', mockRates)).toBe(110);
    });

    it('should use fallback rates if rate not found', () => {
      const emptyRates: CurrencyRate[] = [];
      expect(convertAmount(1, 'NGN', emptyRates)).toBe(1500); // Fallback
    });
  });

  describe('parseToUSD', () => {
    it('should return same amount for USD', () => {
      expect(parseToUSD(100, 'USD', mockRates)).toBe(100);
    });

    it('should convert NGN to USD correctly', () => {
      expect(parseToUSD(1500, 'NGN', mockRates)).toBe(1);
    });

    it('should convert BDT to USD correctly', () => {
      expect(parseToUSD(110, 'BDT', mockRates)).toBe(1);
    });
  });

  describe('formatCurrency', () => {
    it('should format USD correctly', () => {
      const result = formatCurrency(100, 'USD', mockRates);
      expect(result).toContain('$');
      expect(result).toContain('100');
    });

    it('should format NGN correctly', () => {
      const result = formatCurrency(1, 'NGN', mockRates);
      expect(result).toContain('₦');
      expect(result).toContain('1,500');
    });
  });
});
