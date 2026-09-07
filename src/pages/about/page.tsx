import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import SEOHead from '../../components/SEOHead';
import {
  COMPLIANCE_EMAIL,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  SUPPORT_PHONE_TEL,
  SUPPORT_WHATSAPP_URL,
} from '../../lib/contactPlaceholders';

const facts = [
  ['Legal entity', 'CARDXC LLC'],
  ['Product', 'CardXC digital wallet and payments platform'],
  ['Website', 'cardxc.online'],
  ['Support', SUPPORT_EMAIL],
  ['Compliance', COMPLIANCE_EMAIL],
] as const;

export default function AboutPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-dark-bg text-white">
      <SEOHead
        title="About CardXC | Company & Service Information"
        description="Learn about CARDXC LLC, the company operating CardXC, our product scope, security approach, service availability, and support contacts."
      />

      <header className="bg-dark-bg/95 backdrop-blur-xl border-b border-dark-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-lime-500 rounded-xl flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-all">
              <i className="ri-wallet-3-line text-black text-xl" aria-hidden />
            </div>
            <span className="text-xl font-bold">CardXC</span>
          </Link>
          <Link to="/" className="text-neutral-400 hover:text-lime-400 transition-colors flex items-center gap-2">
            <i className="ri-arrow-left-line" aria-hidden />
            Back to Home
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-14 sm:py-20">
        <section className="mb-12">
          <span className="inline-flex items-center px-3 py-1.5 rounded-full border border-lime-500/20 bg-lime-500/10 text-lime-400 text-xs font-semibold uppercase tracking-wider mb-5">
            Company information
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-5">About CardXC</h1>
          <p className="text-lg text-neutral-300 leading-relaxed max-w-3xl">
            CardXC is a digital wallet and payments platform operated by CARDXC LLC. We are building tools for wallet management, payment workflows, virtual-card experiences, gift cards, transaction tracking, and security controls.
          </p>
        </section>

        <section className="grid md:grid-cols-2 gap-5 mb-12" aria-label="Company facts">
          {facts.map(([label, value]) => (
            <div key={label} className="bg-dark-card border border-dark-border rounded-2xl p-6">
              <p className="text-xs uppercase tracking-wider text-neutral-500 mb-2">{label}</p>
              <p className="text-base font-semibold text-white break-words">{value}</p>
            </div>
          ))}
        </section>

        <section className="grid lg:grid-cols-3 gap-5 mb-12">
          <div className="bg-dark-card border border-dark-border rounded-2xl p-7">
            <div className="w-11 h-11 rounded-xl bg-lime-500/15 flex items-center justify-center mb-5">
              <i className="ri-shield-check-line text-lime-400 text-xl" aria-hidden />
            </div>
            <h2 className="text-xl font-semibold mb-3">Security approach</h2>
            <p className="text-neutral-400 leading-relaxed text-sm">
              The platform includes controls such as multi-factor authentication, rate limiting, webhook verification, fraud checks, audit-oriented logging, and production error monitoring. Security controls reduce risk but do not make any system risk-free.
            </p>
          </div>

          <div className="bg-dark-card border border-dark-border rounded-2xl p-7">
            <div className="w-11 h-11 rounded-xl bg-lime-500/15 flex items-center justify-center mb-5">
              <i className="ri-checkbox-circle-line text-lime-400 text-xl" aria-hidden />
            </div>
            <h2 className="text-xl font-semibold mb-3">Service availability</h2>
            <p className="text-neutral-400 leading-relaxed text-sm">
              Features may be development, beta, conditional, or production-enabled depending on geography, user eligibility, provider configuration, compliance checks, and external approvals. An integration in our codebase does not by itself mean a provider has approved production use.
            </p>
          </div>

          <div className="bg-dark-card border border-dark-border rounded-2xl p-7">
            <div className="w-11 h-11 rounded-xl bg-lime-500/15 flex items-center justify-center mb-5">
              <i className="ri-scales-3-line text-lime-400 text-xl" aria-hidden />
            </div>
            <h2 className="text-xl font-semibold mb-3">Compliance</h2>
            <p className="text-neutral-400 leading-relaxed text-sm">
              Access to regulated or higher-risk functionality can require identity verification, sanctions screening, transaction review, provider-specific eligibility, and other compliance controls. Availability can be restricted or disabled where requirements are not satisfied.
            </p>
          </div>
        </section>

        <section className="bg-dark-card border border-dark-border rounded-2xl p-7 sm:p-8 mb-12">
          <h2 className="text-2xl font-semibold mb-4">Contact and support</h2>
          <p className="text-neutral-400 leading-relaxed mb-6">
            For account help, technical questions, or service issues, use the support channels below. For compliance-specific inquiries, contact the compliance address above.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href={`mailto:${SUPPORT_EMAIL}`} className="btn-primary inline-flex items-center gap-2">
              <i className="ri-mail-line" aria-hidden />
              Email Support
            </a>
            <a href={SUPPORT_PHONE_TEL} className="px-5 py-3 rounded-xl border border-dark-border text-neutral-200 hover:border-lime-500/40 transition-colors inline-flex items-center gap-2">
              <i className="ri-phone-line text-lime-400" aria-hidden />
              {SUPPORT_PHONE}
            </a>
            <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="px-5 py-3 rounded-xl border border-dark-border text-neutral-200 hover:border-lime-500/40 transition-colors inline-flex items-center gap-2">
              <i className="ri-whatsapp-line text-lime-400" aria-hidden />
              WhatsApp
            </a>
          </div>
        </section>

        <section className="border-t border-dark-border pt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm">
          <Link to="/terms" className="text-lime-400 hover:text-lime-300">Terms</Link>
          <Link to="/privacy" className="text-lime-400 hover:text-lime-300">Privacy</Link>
          <Link to="/refund-policy" className="text-lime-400 hover:text-lime-300">Refund & Disputes</Link>
          <Link to="/aml-policy" className="text-lime-400 hover:text-lime-300">AML Policy</Link>
          <Link to="/support" className="text-lime-400 hover:text-lime-300">Support</Link>
        </section>
      </main>
    </div>
  );
}
