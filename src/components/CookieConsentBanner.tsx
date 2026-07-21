import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { hasConsentDecision, setConsent } from '../lib/consent';

/**
 * Cookie consent banner.
 *
 * Shown until the user makes a choice. Non-essential analytics/performance
 * tracking stays OFF until the user clicks Accept (see src/lib/consent.ts,
 * src/lib/analytics.ts, src/lib/webVitals.ts). Rejecting keeps only essential
 * cookies, which are required for the platform to function.
 *
 * This banner does not detect location, user-agent, or IP. It presents the same
 * honest choice to every visitor.
 */
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show the banner if the user has not decided yet.
    setVisible(!hasConsentDecision());
  }, []);

  if (!visible) {
    return null;
  }

  const choose = (value: 'accepted' | 'rejected') => {
    setConsent(value);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-[80] p-3 sm:p-4"
    >
      <div className="max-w-4xl mx-auto bg-[#0d0d0d] border border-white/[0.1] rounded-2xl shadow-2xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white mb-1">We value your privacy</p>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              We use essential cookies to make CardXC work. With your consent, we also use
              analytics and performance cookies to understand how the platform is used. You can
              change your choice at any time. Read our{' '}
              <Link to="/cookie-policy" className="text-lime-400 hover:underline">Cookie Policy</Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-lime-400 hover:underline">Privacy Notice</Link>.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => choose('rejected')}
              className="px-4 py-2.5 text-sm font-medium text-neutral-300 bg-white/[0.04] rounded-lg border border-white/[0.1] hover:bg-white/[0.08] transition-colors"
            >
              Reject non-essential
            </button>
            <button
              onClick={() => choose('accepted')}
              className="px-5 py-2.5 text-sm font-semibold text-black bg-lime-500 rounded-lg hover:bg-lime-400 transition-colors"
            >
              Accept all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
