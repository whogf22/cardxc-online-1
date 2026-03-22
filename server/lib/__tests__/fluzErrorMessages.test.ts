/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { getUserFriendlyMessage } from '../fluzErrorMessages';

describe('fluzErrorMessages', () => {
  describe('getUserFriendlyMessage', () => {
    it('maps insufficient balance to user message', () => {
      expect(getUserFriendlyMessage('Insufficient balance in account')).toBe(
        'Insufficient balance. Please add funds and try again.'
      );
    });

    it('maps invalid offer to user message', () => {
      expect(getUserFriendlyMessage('Offer not found or invalid')).toBe(
        'This card offer is no longer available. Please refresh and select another.'
      );
    });

    it('maps unauthorized to user message', () => {
      expect(getUserFriendlyMessage('Unauthorized: token expired')).toBe(
        'Session expired. Please sign in again.'
      );
    });

    it('maps rate limit to user message', () => {
      expect(getUserFriendlyMessage('Rate limit exceeded. Too many requests.')).toBe(
        'Too many requests. Please wait a moment and try again.'
      );
    });

    it('maps gift card already revealed to user message', () => {
      expect(getUserFriendlyMessage('Gift card already revealed')).toBe(
        'This gift card code was already revealed.'
      );
    });

    it('returns fallback for empty/undefined', () => {
      expect(getUserFriendlyMessage('', 'Custom fallback')).toBe('Custom fallback');
      expect(getUserFriendlyMessage(undefined, 'Default')).toBe('Default');
    });

    it('returns safe short messages as-is', () => {
      const msg = 'Please verify your email address.';
      expect(getUserFriendlyMessage(msg)).toBe(msg);
    });

    it('truncates long safe messages', () => {
      const long = 'A'.repeat(150);
      const result = getUserFriendlyMessage(long);
      expect(result.length).toBeLessThanOrEqual(121);
      expect(result.endsWith('…')).toBe(true);
    });

    it('does not expose tokens or UUIDs', () => {
      const unsafe = 'Error: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
      expect(getUserFriendlyMessage(unsafe)).toBe('Something went wrong. Please try again.');
    });
  });
});
