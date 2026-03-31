/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { generateStatementDescriptor, getRandomMCC } from '../paymentHelper';

describe('paymentHelper', () => {
  describe('generateStatementDescriptor', () => {
    it('returns a string of 22 characters or less', () => {
      const descriptor = generateStatementDescriptor();
      expect(descriptor.length).toBeLessThanOrEqual(22);
      expect(typeof descriptor).toBe('string');
    });

    it('contains a number (the order ID)', () => {
      const descriptor = generateStatementDescriptor();
      expect(descriptor).toMatch(/\d+/);
    });

    it('produces results across multiple calls without breaking', () => {
      for (let i = 0; i < 20; i++) {
        const descriptor = generateStatementDescriptor();
        expect(descriptor.length).toBeGreaterThan(0);
        expect(descriptor.length).toBeLessThanOrEqual(22);
      }
    });
  });

  describe('getRandomMCC', () => {
    it('returns one of the valid MCC codes', () => {
      const validMCCs = ['5411', '5732', '5812', '5651', '5999'];
      const mcc = getRandomMCC();
      expect(validMCCs).toContain(mcc);
    });

    it('produces results across multiple calls without breaking', () => {
      const validMCCs = ['5411', '5732', '5812', '5651', '5999'];
      for (let i = 0; i < 20; i++) {
        const mcc = getRandomMCC();
        expect(validMCCs).toContain(mcc);
      }
    });
  });
});
