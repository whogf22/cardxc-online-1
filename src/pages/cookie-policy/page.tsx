import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PRIVACY_EMAIL } from '../../lib/contactPlaceholders';

export default function CookiePolicyPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-dark-bg">
      <header className="bg-dark-bg/95 backdrop-blur-xl border-b border-dark-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 cursor-pointer group">
              <div className="w-10 h-10 bg-lime-500 rounded-xl flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-all duration-300">
                <i className="ri-bank-card-line text-black text-xl"></i>
              </div>
              <span className="text-xl font-bold text-white">CardXC</span>
            </Link>
            <Link
              to="/"
              className="text-neutral-400 hover:text-lime-400 transition-colors cursor-pointer flex items-center gap-2"
            >
              <i className="ri-arrow-left-line"></i>
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Cookie Policy</h1>
        <p className="text-neutral-400 mb-12">
          Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>

        <div className="space-y-8 text-neutral-300">
          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-information-line text-lime-400"></i>
              1. What This Policy Covers
            </h2>
            <p className="leading-relaxed">
              This Cookie Policy explains how CardXC, a digital wallet and payments platform
              operated by CARDXC LLC, uses cookies and similar technologies (such as local storage)
              on our website and applications. It should be read together with our{' '}
              <Link to="/privacy" className="text-lime-400 hover:underline">Privacy Notice</Link>.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-question-line text-lime-400"></i>
              2. What Are Cookies?
            </h2>
            <p className="leading-relaxed">
              Cookies are small text files placed on your device when you visit a website. Similar
              technologies, such as local storage, store data in your browser. They help websites
              function, remember your preferences, keep your session secure, and understand how the
              website is used.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-list-check-2 text-lime-400"></i>
              3. Types of Cookies We Use
            </h2>
            <ul className="space-y-3 list-disc list-inside leading-relaxed">
              <li>
                <strong className="text-white">Essential cookies:</strong> Required for the platform
                to function, including authentication, session management, security, and fraud
                prevention. These are always active and cannot be switched off through our consent
                banner because the service would not work without them.
              </li>
              <li>
                <strong className="text-white">Preference storage:</strong> Remembers choices such
                as your selected currency and your cookie consent decision.
              </li>
              <li>
                <strong className="text-white">Analytics and performance cookies:</strong> Help us
                understand how visitors use the platform and monitor performance. These are
                <strong className="text-white"> non-essential</strong> and are only used if you
                consent.
              </li>
            </ul>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-shield-check-line text-lime-400"></i>
              4. Your Choices and Consent
            </h2>
            <p className="leading-relaxed mb-4">
              When you first visit CardXC, we ask whether you consent to non-essential analytics and
              performance cookies. Non-essential tracking stays off until you choose to accept it.
              You can accept or reject non-essential cookies at any time. If you reject them, only
              essential cookies remain active.
            </p>
            <p className="leading-relaxed">
              You can also control cookies through your browser settings, including deleting existing
              cookies or blocking new ones. Disabling essential cookies may affect how the platform
              works. To reset your choice on this site, clear your browser storage for CardXC and
              reload the page, and the consent banner will appear again.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-global-line text-lime-400"></i>
              5. Third-Party Services
            </h2>
            <p className="leading-relaxed">
              Some features rely on third-party providers (for example, payment processing and error
              monitoring) that may set their own cookies or process data under their own policies.
              We encourage you to review the privacy and cookie policies of those providers.
              {/* [BUSINESS/LEGAL: list specific third-party cookie providers and links once finalized.] */}
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-mail-line text-lime-400"></i>
              6. Contact Us
            </h2>
            <p className="leading-relaxed">
              If you have questions about this Cookie Policy, contact us at{' '}
              <a href={`mailto:${PRIVACY_EMAIL}`} className="text-lime-400 hover:underline">
                {PRIVACY_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
