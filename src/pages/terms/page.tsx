import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_TEL, SUPPORT_WHATSAPP_URL } from '../../lib/contactPlaceholders';

const LAST_UPDATED = '27 June 2025';

export default function TermsPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Terms and Conditions | CardXC';
  }, []);

  return (
    <div className="min-h-screen bg-dark-bg">
      <header className="bg-dark-bg/95 backdrop-blur-xl border-b border-dark-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 cursor-pointer group">
              <div className="w-10 h-10 bg-lime-500 rounded-xl flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-all duration-300">
                <i className="ri-wallet-3-line text-black text-xl"></i>
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

      <main className="max-w-4xl mx-auto px-6 py-16" role="document" aria-label="Terms and Conditions">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">Terms and Conditions</h1>
        <p className="text-neutral-400 text-sm uppercase tracking-wide mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-8 text-neutral-300">
          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
              <i className="ri-hand-heart-line text-lime-400"></i>
              Welcome to CardXC
            </h2>
            <p className="leading-relaxed mb-4">
              Thank you for visiting CardXC, a digital wallet and payments platform operated by CARDXC LLC (the “Company”). By accessing or using our website, applications, or services (collectively, the “Services”), you agree to be bound by these Terms and Conditions. Please read them carefully before using our Services.
            </p>
            <p className="leading-relaxed text-neutral-400 text-sm">
              If you do not agree to these terms, you may not access or use our Services.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <div className="flex items-start gap-4 p-4 bg-warning-500/10 border border-warning-500/30 rounded-xl mb-6">
              <i className="ri-information-line text-warning-500 text-2xl mt-0.5"></i>
              <div>
                <h3 className="font-semibold text-warning-500 mb-1">Important Disclaimer</h3>
                <p className="text-sm text-neutral-300">
                  CardXC provides <strong>virtual payment cards only</strong>. These are digital cards for online transactions and do not represent physical plastic cards. Virtual cards are issued for online use and cannot be used at physical point-of-sale terminals or ATMs. By using our services, you acknowledge and accept this limitation.
                </p>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-file-text-line text-lime-400"></i>
              1. Agreement to Terms
            </h2>
            <p className="leading-relaxed mb-4">
              By accessing and using CardXC services, you agree to be bound by these Terms and Conditions. If you disagree with any part of these terms, you may not access our services.
            </p>
            <p className="leading-relaxed">
              We reserve the right to modify these terms at any time. Your continued use of our services after changes are posted constitutes acceptance of those changes.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-bank-card-line text-lime-400"></i>
              2. Virtual Card Services
            </h2>
            <p className="leading-relaxed mb-4">
              CardXC provides virtual payment card services for online transactions. Our virtual cards:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Are issued digitally and exist only in electronic form</li>
              <li>Can be used for online purchases where card payments are accepted</li>
              <li>Are subject to spending limits that you set and can modify</li>
              <li>Can be frozen or cancelled at any time through your account</li>
              <li>Are not physical cards and cannot be used at ATMs or physical stores</li>
            </ul>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-wallet-3-line text-lime-400"></i>
              3. Digital Wallet Services
            </h2>
            <p className="leading-relaxed mb-4">
              CardXC provides digital wallet services for managing your funds:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Deposit and withdraw funds in supported currencies</li>
              <li>Transfer funds to virtual cards for spending</li>
              <li>View transaction history and account statements</li>
              <li>All transactions are subject to verification and compliance checks</li>
            </ul>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-shield-check-line text-lime-400"></i>
              4. User Responsibilities
            </h2>
            <p className="leading-relaxed mb-4">
              As a user of our services, you agree to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Provide accurate and truthful information during registration</li>
              <li>Complete identity verification (KYC) when requested</li>
              <li>Not engage in fraudulent activities or money laundering</li>
              <li>Comply with all applicable laws and regulations</li>
              <li>Maintain the confidentiality of your account credentials</li>
              <li>Report any unauthorized access to your account immediately</li>
            </ul>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-error-warning-line text-lime-400"></i>
              5. Prohibited Activities
            </h2>
            <p className="leading-relaxed mb-4">
              The following activities are strictly prohibited:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Using our services for illegal purposes</li>
              <li>Attempting to circumvent spending limits or security measures</li>
              <li>Creating multiple accounts to evade restrictions</li>
              <li>Using virtual cards for prohibited merchant categories</li>
              <li>Interfering with the proper functioning of our services</li>
            </ul>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-refund-line text-lime-400"></i>
              6. Refunds and Disputes
            </h2>
            <p className="leading-relaxed mb-4">
              All virtual card transactions are processed through our payment partners. For disputes:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Contact us within 48 hours of discovering an issue</li>
              <li>Provide transaction details and supporting documentation</li>
              <li>Allow up to 5-7 business days for investigation</li>
              <li>Chargebacks are subject to our payment partner's policies</li>
            </ul>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-lock-line text-lime-400"></i>
              7. Privacy and Data Protection
            </h2>
            <p className="leading-relaxed mb-4">
              We take your privacy seriously and are committed to protecting your personal information. By using our services, you consent to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Collection of necessary transaction and identity information</li>
              <li>Storage of data for compliance and security purposes</li>
              <li>Sharing data with payment processors and verification services</li>
              <li>Use of information to improve our services and prevent fraud</li>
            </ul>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-alert-line text-lime-400"></i>
              8. Limitation of Liability
            </h2>
            <p className="leading-relaxed mb-4">
              CardXC shall not be liable for:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Merchant refusal to accept virtual card payments</li>
              <li>Delays caused by third-party payment processors</li>
              <li>Technical issues beyond our reasonable control</li>
              <li>Indirect, incidental, or consequential damages</li>
              <li>Losses due to user negligence or unauthorized account access</li>
            </ul>
            <p className="leading-relaxed mt-4">
              Our total liability shall not exceed the balance held in your account at the time of the incident.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-mail-line text-lime-400"></i>
              9. Contact Information
            </h2>
            <p className="leading-relaxed mb-4">
              If you have any questions about these Terms & Conditions, please contact us:
            </p>
            <div className="space-y-2">
              <p className="flex items-center gap-2">
                <i className="ri-whatsapp-line text-lime-400"></i>
                <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="text-neutral-300 hover:text-lime-400 transition-colors">{SUPPORT_PHONE}</a>
              </p>
              <p className="flex items-center gap-2">
                <i className="ri-phone-line text-lime-400"></i>
                <a href={SUPPORT_PHONE_TEL} className="text-neutral-300 hover:text-lime-400 transition-colors">{SUPPORT_PHONE}</a>
              </p>
              <p className="flex items-center gap-2">
                <i className="ri-mail-line text-lime-400"></i>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-neutral-300 hover:text-lime-400 transition-colors">{SUPPORT_EMAIL}</a>
              </p>
            </div>
          </section>
        </div>

        <div className="mt-12 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-lime-500 text-black px-8 py-4 rounded-xl font-semibold transition-all duration-300 shadow-glow-sm hover:shadow-glow cursor-pointer whitespace-nowrap"
          >
            <i className="ri-home-line"></i>
            Back to Home
          </Link>
        </div>
      </main>

      <footer className="bg-dark-elevated border-t border-dark-border mt-20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center text-neutral-500 text-sm">
            <p>&copy; {new Date().getFullYear()} CardXC. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
