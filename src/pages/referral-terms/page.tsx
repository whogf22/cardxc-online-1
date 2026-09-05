import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SUPPORT_EMAIL } from '../../lib/contactPlaceholders';

export default function ReferralTermsPage() {
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
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Referral Program Terms</h1>
        <p className="text-neutral-400 mb-4">
          Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 mb-12">
          <p className="text-sm text-amber-200/90 leading-relaxed">
            {/* [LEGAL REVIEW REQUIRED] Confirm the final referral reward structure, amounts,
                eligibility, and jurisdictional limits before publishing. The terms below are a
                good-faith placeholder and must be verified by counsel. */}
            <strong className="text-amber-100">Note:</strong> These terms describe the general rules
            of the CardXC referral program. Specific reward amounts and eligibility may be presented
            to you in-product and are subject to confirmation.
          </p>
        </div>

        <div className="space-y-8 text-neutral-300">
          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-user-add-line text-lime-400"></i>
              1. Overview
            </h2>
            <p className="leading-relaxed">
              The CardXC referral program, operated by CARDXC LLC, lets eligible members invite
              others to join CardXC. When a referral meets the program requirements, the referrer
              and/or the referred user may receive a reward. Participation is voluntary and subject
              to these terms and our{' '}
              <Link to="/terms" className="text-lime-400 hover:underline">Terms of Service</Link>.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-checkbox-circle-line text-lime-400"></i>
              2. Eligibility
            </h2>
            <ul className="space-y-3 list-disc list-inside leading-relaxed">
              <li>You must have an account in good standing to participate.</li>
              <li>
                Referred users must be new to CardXC, complete any required identity verification
                (KYC), and meet the qualifying activity described in-product.
              </li>
              <li>
                Self-referrals, duplicate accounts, and referrals that do not represent genuine,
                independent users are not eligible.
              </li>
            </ul>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-gift-line text-lime-400"></i>
              3. Rewards Are Discretionary
            </h2>
            <p className="leading-relaxed">
              Referral rewards are discretionary and are provided at the sole discretion of CardXC.
              Reward amounts, forms, and availability may change or be withdrawn at any time. Rewards
              are <strong className="text-white">not guaranteed</strong>, are not interest, and do
              not constitute income, earnings, or investment returns. Any figures shown in marketing
              or in-product are illustrative unless expressly confirmed as payable to you.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-shield-cross-line text-lime-400"></i>
              4. Anti-Abuse and Compliance
            </h2>
            <p className="leading-relaxed">
              We may withhold, reverse, or cancel rewards, and may suspend participation, if we
              reasonably believe the program is being abused or that activity violates these terms,
              our Terms of Service, or applicable law. Rewards may be subject to verification and to
              anti-money-laundering and fraud checks. You are responsible for any taxes that may
              apply to rewards you receive.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-edit-line text-lime-400"></i>
              5. Changes to the Program
            </h2>
            <p className="leading-relaxed">
              We may modify, suspend, or end the referral program, or update these terms, at any
              time. Material changes will be reflected by updating the date above. Continued
              participation after changes take effect constitutes acceptance of the updated terms.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-mail-line text-lime-400"></i>
              6. Contact Us
            </h2>
            <p className="leading-relaxed">
              Questions about the referral program? Contact us at{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-lime-400 hover:underline">
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
