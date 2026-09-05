/**
 * Consent module tests.
 *
 * COMPLIANCE FEEDBACK LOOP: these lock in the privacy-by-default behavior that
 * non-essential analytics/tracking must stay OFF until the user explicitly
 * accepts. If someone later changes the default or the gating, these fail.
 */

import {
  getConsent,
  hasAnalyticsConsent,
  hasConsentDecision,
  setConsent,
  onConsentChange,
} from '../consent';

const STORAGE_KEY = 'cardxc_cookie_consent';

describe('cookie consent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to no decision and no analytics consent (privacy-by-default OFF)', () => {
    expect(getConsent()).toBeNull();
    expect(hasConsentDecision()).toBe(false);
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('treats rejection as no analytics consent but a recorded decision', () => {
    setConsent('rejected');
    expect(getConsent()).toBe('rejected');
    expect(hasConsentDecision()).toBe(true);
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('grants analytics consent only after explicit acceptance', () => {
    setConsent('accepted');
    expect(getConsent()).toBe('accepted');
    expect(hasConsentDecision()).toBe(true);
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it('persists the choice to localStorage under the expected key', () => {
    setConsent('accepted');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('accepted');
  });

  it('ignores unknown/corrupt stored values (fails closed to OFF)', () => {
    localStorage.setItem(STORAGE_KEY, 'yes-please');
    expect(getConsent()).toBeNull();
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('notifies subscribers when consent changes and stops after unsubscribe', () => {
    const seen: string[] = [];
    const unsubscribe = onConsentChange((value) => seen.push(value));

    setConsent('accepted');
    setConsent('rejected');
    unsubscribe();
    setConsent('accepted');

    expect(seen).toEqual(['accepted', 'rejected']);
  });
});
