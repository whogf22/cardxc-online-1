/**
 * Cookie / tracking consent.
 *
 * COMPLIANCE: Non-essential tracking (analytics, performance/Web Vitals
 * reporting) must not run until the user has given consent, where consent is
 * required (e.g. GDPR/ePrivacy in the EU/UK, CPRA opt-out signals in California).
 * Essential functionality (auth, security, load balancing) is always allowed and
 * is NOT gated by this module.
 *
 * We deliberately keep this simple and honest: a single stored choice of
 * 'accepted' | 'rejected'. There is no fingerprinting, geo/IP detection, or
 * per-visitor cloaking here. If no choice has been made yet, non-essential
 * tracking stays OFF (privacy-by-default).
 */

export type ConsentValue = 'accepted' | 'rejected';

const STORAGE_KEY = 'cardxc_cookie_consent';
const EVENT_NAME = 'cardxc:consent-changed';

function safeGet(): ConsentValue | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'accepted' || raw === 'rejected') {
      return raw;
    }
  } catch {
    // localStorage may be unavailable (private mode, SSR). Fail closed.
  }
  return null;
}

/** Returns the stored consent choice, or null if the user has not chosen yet. */
export function getConsent(): ConsentValue | null {
  return safeGet();
}

/** True only when the user has explicitly accepted analytics/tracking. */
export function hasAnalyticsConsent(): boolean {
  return safeGet() === 'accepted';
}

/** True when the user has made any choice (used to hide the banner). */
export function hasConsentDecision(): boolean {
  return safeGet() !== null;
}

/** Persist a consent choice and notify listeners. */
export function setConsent(value: ConsentValue): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Ignore storage failures; consent simply won't persist.
  }
  try {
    window.dispatchEvent(new CustomEvent<ConsentValue>(EVENT_NAME, { detail: value }));
  } catch {
    // Ignore if CustomEvent/window is unavailable.
  }
}

/** Subscribe to consent changes. Returns an unsubscribe function. */
export function onConsentChange(listener: (value: ConsentValue) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<ConsentValue>).detail;
    if (detail === 'accepted' || detail === 'rejected') {
      listener(detail);
    }
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
