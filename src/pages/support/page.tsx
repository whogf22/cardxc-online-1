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

export default function SupportPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-dark-bg text-white pb-24">
      <SEOHead
        title="CardXC Support | Contact & Help"
        description="Contact CardXC support for account help, service questions, disputes, or compliance inquiries."
      />

      <header className="bg-dark-bg/95 backdrop-blur-xl border-b border-dark-border sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-lime-500 rounded-xl flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-all">
              <i className="ri-wallet-3-line text-black text-xl" aria-hidden />
            </div>
            <span className="text-xl font-bold">CardXC</span>
          </Link>
          <Link to="/" className="text-sm text-neutral-400 hover:text-lime-400 transition-colors flex items-center gap-2">
            <i className="ri-arrow-left-line" aria-hidden />
            Back to Home
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <section className="mb-10">
          <span className="inline-flex items-center px-3 py-1.5 rounded-full border border-lime-500/20 bg-lime-500/10 text-lime-400 text-xs font-semibold uppercase tracking-wider mb-4">
            Public support
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">How can we help?</h1>
          <p className="text-neutral-400 leading-relaxed max-w-2xl">
            You do not need to be signed in to view this page. Use the channels below for account access, transaction questions, disputes, security concerns, or general product support.
          </p>
        </section>

        <section className="grid md:grid-cols-2 gap-5 mb-8">
          <div className="bg-dark-card rounded-2xl border border-dark-border p-6 sm:p-7">
            <div className="w-12 h-12 mb-5 bg-lime-500/15 rounded-xl flex items-center justify-center">
              <i className="ri-mail-line text-2xl text-lime-400" aria-hidden />
            </div>
            <h2 className="text-lg font-semibold mb-2">Email support</h2>
            <p className="text-neutral-400 text-sm leading-relaxed mb-5">
              Best for account questions, technical issues, and requests that may need screenshots or supporting documents.
            </p>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-lime-400 hover:text-lime-300 font-medium break-all">
              {SUPPORT_EMAIL}
            </a>
          </div>

          <div className="bg-dark-card rounded-2xl border border-dark-border p-6 sm:p-7">
            <div className="w-12 h-12 mb-5 bg-lime-500/15 rounded-xl flex items-center justify-center">
              <i className="ri-phone-line text-2xl text-lime-400" aria-hidden />
            </div>
            <h2 className="text-lg font-semibold mb-2">Phone / WhatsApp</h2>
            <p className="text-neutral-400 text-sm leading-relaxed mb-5">
              Use the published contact number for support. Never send passwords, one-time codes, private keys, or full payment credentials in a message.
            </p>
            <div className="flex flex-col gap-2 items-start">
              <a href={SUPPORT_PHONE_TEL} className="text-lime-400 hover:text-lime-300 font-medium">
                {SUPPORT_PHONE}
              </a>
              <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="text-neutral-300 hover:text-lime-400 text-sm inline-flex items-center gap-2">
                <i className="ri-whatsapp-line" aria-hidden />
                Open WhatsApp
              </a>
            </div>
          </div>
        </section>

        <section className="bg-dark-card rounded-2xl border border-dark-border p-6 sm:p-7 mb-8">
          <h2 className="text-lg font-semibold mb-4">Before contacting us</h2>
          <ul className="space-y-3 text-sm text-neutral-400">
            <li className="flex gap-3"><i className="ri-checkbox-circle-line text-lime-400 mt-0.5" aria-hidden /><span>Include the email associated with your account when it is safe to do so.</span></li>
            <li className="flex gap-3"><i className="ri-checkbox-circle-line text-lime-400 mt-0.5" aria-hidden /><span>For a transaction issue, include the date, amount, currency, and transaction reference — not your password or full card credentials.</span></li>
            <li className="flex gap-3"><i className="ri-checkbox-circle-line text-lime-400 mt-0.5" aria-hidden /><span>If you suspect unauthorized access, state that clearly in the subject so the request can be triaged appropriately.</span></li>
          </ul>
        </section>

        <section className="grid sm:grid-cols-3 gap-4 mb-10">
          <Link to="/refund-policy" className="bg-dark-card border border-dark-border rounded-xl p-5 hover:border-lime-500/30 transition-colors">
            <i className="ri-refund-2-line text-lime-400 text-xl" aria-hidden />
            <h3 className="font-semibold mt-3 mb-1">Refunds & disputes</h3>
            <p className="text-xs text-neutral-500">Review the dispute and refund policy.</p>
          </Link>
          <Link to="/privacy" className="bg-dark-card border border-dark-border rounded-xl p-5 hover:border-lime-500/30 transition-colors">
            <i className="ri-shield-keyhole-line text-lime-400 text-xl" aria-hidden />
            <h3 className="font-semibold mt-3 mb-1">Privacy</h3>
            <p className="text-xs text-neutral-500">See how personal information is handled.</p>
          </Link>
          <a href={`mailto:${COMPLIANCE_EMAIL}`} className="bg-dark-card border border-dark-border rounded-xl p-5 hover:border-lime-500/30 transition-colors">
            <i className="ri-scales-3-line text-lime-400 text-xl" aria-hidden />
            <h3 className="font-semibold mt-3 mb-1">Compliance</h3>
            <p className="text-xs text-neutral-500 break-all">{COMPLIANCE_EMAIL}</p>
          </a>
        </section>

        <p className="text-xs text-neutral-600 leading-relaxed">
          CardXC will never ask you to disclose your password, one-time authentication code, recovery secret, or private key through support. Service and response times can vary; no guaranteed 24/7 response SLA is represented on this page.
        </p>
      </main>
    </div>
  );
}
