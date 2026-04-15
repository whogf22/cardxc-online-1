import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_TEL, SUPPORT_WHATSAPP_URL } from '../../lib/contactPlaceholders';

const EFFECTIVE_DATE = 'January 10, 2026';

export default function PrivacyPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Privacy Notice | CardXC';
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

      <main className="max-w-4xl mx-auto px-6 py-16" role="document" aria-label="Privacy Notice">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">Privacy Notice</h1>
        <p className="text-neutral-400 text-sm uppercase tracking-wide mb-10">Effective Date: {EFFECTIVE_DATE}</p>

        <div className="space-y-8 text-neutral-300">
          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-information-line text-lime-400"></i>
              Introduction
            </h2>
            <p className="leading-relaxed mb-4">
              Welcome to CardXC. CardXC, a digital wallet and payments platform operated by CARDXC LLC (“we”, “us”, or “our”), operates the CardXC platform, including the CardXC website and applications (the “Services”). This Privacy Notice explains how we collect, use, disclose, and safeguard your information when you use our virtual payment card and digital payment services.
            </p>
            <p className="leading-relaxed text-neutral-400 text-sm">
              Please read this Privacy Notice carefully. If you do not agree with its terms, please do not access or use our Services.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-database-2-line text-lime-400"></i>
              2. Information We Collect
            </h2>
            <p className="leading-relaxed mb-4">
              We collect information that you provide directly to us when using our services:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Personal identification information (name, email address, phone number)</li>
              <li>Identity verification documents for KYC compliance</li>
              <li>Payment and transaction information</li>
              <li>Virtual card usage and transaction history</li>
              <li>Communication records with our support team</li>
              <li>Device information and IP addresses</li>
              <li>Usage data and browsing behavior on our platform</li>
            </ul>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-settings-3-line text-lime-400"></i>
              3. How We Use Your Information
            </h2>
            <p className="leading-relaxed mb-4">
              We use the information we collect for the following purposes:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>To process and complete your virtual card transactions</li>
              <li>To verify your identity and comply with KYC/AML regulations</li>
              <li>To communicate with you about your transactions and our services</li>
              <li>To provide customer support and respond to your inquiries</li>
              <li>To detect and prevent fraud and unauthorized access</li>
              <li>To improve our services and user experience</li>
              <li>To comply with legal obligations and enforce our terms</li>
              <li>To send you service updates and promotional materials (with your consent)</li>
            </ul>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-share-line text-lime-400"></i>
              4. Information Sharing and Disclosure
            </h2>
            <p className="leading-relaxed mb-4">
              We may share your information in the following circumstances:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Payment Processors:</strong> We share transaction data with our payment partners to process your virtual card payments</li>
              <li><strong>Identity Verification:</strong> We may share information with KYC/AML verification providers</li>
              <li><strong>Service Providers:</strong> We may share information with third-party service providers who perform services on our behalf</li>
              <li><strong>Legal Requirements:</strong> We may disclose information if required by law or in response to valid legal requests</li>
              <li><strong>Business Transfers:</strong> Information may be transferred in connection with a merger, sale, or acquisition of our business</li>
              <li><strong>Fraud Prevention:</strong> We may share information to prevent fraud and protect the security of our services</li>
            </ul>
            <p className="leading-relaxed mt-4">
              We do not sell your personal information to third parties for their marketing purposes.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-shield-keyhole-line text-lime-400"></i>
              5. Data Security
            </h2>
            <p className="leading-relaxed">
              We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include encryption (TLS/SSL), secure servers, access controls, and regular security assessments. All sensitive data is encrypted at rest and in transit. However, no method of transmission over the internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-time-line text-lime-400"></i>
              6. Data Retention
            </h2>
            <p className="leading-relaxed">
              We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Notice, unless a longer retention period is required or permitted by law. Transaction records are retained for a minimum of 5 years to comply with financial regulations and AML requirements. When we no longer need your information, we will securely delete or anonymize it.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-pie-chart-line text-lime-400"></i>
              7. Cookies and Tracking Technologies
            </h2>
            <p className="leading-relaxed mb-4">
              We use cookies and similar tracking technologies to enhance your experience on our platform:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Essential Cookies:</strong> Required for the platform to function properly</li>
              <li><strong>Security Cookies:</strong> Help detect and prevent fraudulent activity</li>
              <li><strong>Analytics Cookies:</strong> Help us understand how visitors use our platform</li>
              <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
            </ul>
            <p className="leading-relaxed mt-4">
              You can control cookies through your browser settings, but disabling certain cookies may affect platform functionality.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-user-settings-line text-lime-400"></i>
              8. Your Privacy Rights
            </h2>
            <p className="leading-relaxed mb-4">
              Depending on your location, you may have the following rights regarding your personal information:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Right to access and receive a copy of your personal information</li>
              <li>Right to correct inaccurate or incomplete information</li>
              <li>Right to delete your personal information (subject to legal retention requirements)</li>
              <li>Right to restrict or object to processing of your information</li>
              <li>Right to data portability</li>
              <li>Right to withdraw consent at any time</li>
            </ul>
            <p className="leading-relaxed mt-4">
              To exercise these rights, please contact us using the information provided below. We will respond to your request within 30 days.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-external-link-line text-lime-400"></i>
              9. Third-Party Links
            </h2>
            <p className="leading-relaxed">
              Our platform may contain links to third-party websites or services. We are not responsible for the privacy practices or content of these third parties. We encourage you to read the privacy policies of any third-party websites you visit.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-parent-line text-lime-400"></i>
              10. Children's Privacy
            </h2>
            <p className="leading-relaxed">
              Our services are not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected information from a child without parental consent, we will take steps to delete that information immediately.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-global-line text-lime-400"></i>
              11. International Data Transfers
            </h2>
            <p className="leading-relaxed">
              Your information may be transferred to and processed in countries other than your country of residence, including the United States and European Union. These countries may have different data protection laws. We take appropriate measures to ensure your information receives adequate protection in accordance with this Privacy Notice and applicable data protection laws.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-refresh-line text-lime-400"></i>
              12. Changes to This Privacy Notice
            </h2>
            <p className="leading-relaxed">
              We may update this Privacy Notice from time to time to reflect changes in our practices or for legal, operational, or regulatory reasons. We will notify you of any material changes by posting the new Privacy Notice on this page and updating the Effective Date. For significant changes, we may also notify you via email. Your continued use of our services after such changes constitutes your acceptance of the updated Privacy Notice.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-mail-line text-lime-400"></i>
              13. Contact Us
            </h2>
            <p className="leading-relaxed mb-4">
              If you have any questions, concerns, or requests regarding this Privacy Notice or our privacy practices, please contact us. We will respond to all privacy-related requests within <strong>30 days</strong> of receipt.
            </p>
            <div className="space-y-3">
              <p className="flex items-center gap-2">
                <i className="ri-mail-line text-lime-400"></i>
                <span className="text-neutral-400 min-w-[80px]">Email:</span>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-neutral-300 hover:text-lime-400 transition-colors">{SUPPORT_EMAIL}</a>
              </p>
              <p className="flex items-center gap-2">
                <i className="ri-building-line text-lime-400"></i>
                <span className="text-neutral-400 min-w-[80px]">Address:</span>
                <span className="text-neutral-300">CARDXC LLC, United States</span>
              </p>
              <p className="flex items-center gap-2">
                <i className="ri-whatsapp-line text-lime-400"></i>
                <span className="text-neutral-400 min-w-[80px]">WhatsApp:</span>
                <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="text-neutral-300 hover:text-lime-400 transition-colors">{SUPPORT_PHONE}</a>
              </p>
              <p className="flex items-center gap-2">
                <i className="ri-phone-line text-lime-400"></i>
                <span className="text-neutral-400 min-w-[80px]">Phone:</span>
                <a href={SUPPORT_PHONE_TEL} className="text-neutral-300 hover:text-lime-400 transition-colors">{SUPPORT_PHONE}</a>
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
