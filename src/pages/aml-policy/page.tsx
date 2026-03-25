import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { COMPLIANCE_EMAIL, SUPPORT_EMAIL } from '../../lib/contactPlaceholders';

export default function AMLPolicyPage() {
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
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Anti-Money Laundering Policy</h1>
        <p className="text-neutral-400 mb-12">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>

        <div className="space-y-8 text-neutral-300">
          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <div className="flex items-start gap-4 p-4 bg-primary-500/10 border border-primary-500/30 rounded-xl mb-6">
              <i className="ri-shield-star-line text-primary-400 text-2xl mt-0.5"></i>
              <div>
                <h3 className="font-semibold text-primary-400 mb-1">Our Commitment to Compliance</h3>
                <p className="text-sm text-neutral-300">
                  CardXC, a digital wallet and payments platform operated by CARDXC LLC, is committed to maintaining the highest standards of anti-money laundering (AML) and counter-terrorism financing (CTF) compliance. We work closely with regulatory bodies and financial partners to ensure our platform is not used for illicit activities.
                </p>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-information-line text-lime-400"></i>
              1. Introduction
            </h2>
            <p className="leading-relaxed">
              This Anti-Money Laundering (AML) Policy outlines CardXC's commitment to preventing money laundering, terrorist financing, and other financial crimes. We maintain a comprehensive compliance program designed to detect, prevent, and report suspicious activities in accordance with applicable laws and regulations.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-user-search-line text-lime-400"></i>
              2. Know Your Customer (KYC)
            </h2>
            <p className="leading-relaxed mb-4">
              We implement robust KYC procedures to verify the identity of our customers:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Identity Verification:</strong> Government-issued photo ID verification</li>
              <li><strong>Address Verification:</strong> Proof of residence documentation</li>
              <li><strong>Enhanced Due Diligence:</strong> Additional verification for high-risk customers or transactions</li>
              <li><strong>Ongoing Monitoring:</strong> Continuous review of customer activity and risk profiles</li>
              <li><strong>Periodic Review:</strong> Regular updates to customer information</li>
            </ul>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-scales-3-line text-lime-400"></i>
              3. Risk-Based Approach
            </h2>
            <p className="leading-relaxed mb-4">
              CardXC employs a risk-based approach to AML compliance:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Customer Risk Assessment:</strong> Evaluating risk based on customer profile, geography, and transaction patterns</li>
              <li><strong>Transaction Monitoring:</strong> Automated systems to detect unusual or suspicious activity</li>
              <li><strong>Geographic Risk:</strong> Enhanced scrutiny for high-risk jurisdictions</li>
              <li><strong>Product Risk:</strong> Assessment of risk levels for different service offerings</li>
              <li><strong>Volume Thresholds:</strong> Monitoring transactions above specified amounts</li>
            </ul>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-alarm-warning-line text-lime-400"></i>
              4. Suspicious Activity Detection
            </h2>
            <p className="leading-relaxed mb-4">
              We monitor for indicators of suspicious activity including:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Unusual transaction patterns or volumes</li>
              <li>Transactions with no apparent economic purpose</li>
              <li>Rapid movement of funds in and out of accounts</li>
              <li>Transactions inconsistent with customer's stated purpose</li>
              <li>Attempts to avoid reporting thresholds</li>
              <li>Use of multiple accounts to obscure activity</li>
              <li>Transactions involving high-risk jurisdictions</li>
            </ul>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-file-warning-line text-lime-400"></i>
              5. Reporting Obligations
            </h2>
            <p className="leading-relaxed mb-4">
              CardXC fulfills its reporting obligations by:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Filing Suspicious Activity Reports (SARs) with relevant authorities when required</li>
              <li>Maintaining records of all transactions as required by law</li>
              <li>Cooperating with law enforcement investigations</li>
              <li>Reporting large cash transactions where applicable</li>
              <li>Responding promptly to regulatory inquiries</li>
            </ul>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-global-line text-lime-400"></i>
              6. Sanctions Compliance
            </h2>
            <p className="leading-relaxed mb-4">
              We maintain strict sanctions compliance including:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Screening customers against OFAC, EU, UN, and other sanctions lists</li>
              <li>Real-time transaction screening for sanctioned parties</li>
              <li>Blocking transactions with sanctioned countries or entities</li>
              <li>Regular updates to sanctions screening databases</li>
              <li>Investigation and escalation of potential matches</li>
            </ul>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-government-line text-lime-400"></i>
              7. Politically Exposed Persons (PEPs)
            </h2>
            <p className="leading-relaxed mb-4">
              We apply enhanced due diligence for PEPs:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Identification of current and former PEPs, their family members, and close associates</li>
              <li>Enhanced ongoing monitoring of PEP accounts</li>
              <li>Senior management approval for PEP relationships</li>
              <li>Source of funds verification</li>
              <li>More frequent periodic reviews</li>
            </ul>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-database-2-line text-lime-400"></i>
              8. Record Keeping
            </h2>
            <p className="leading-relaxed mb-4">
              CardXC maintains comprehensive records including:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Customer identification documents and verification records</li>
              <li>Transaction records for a minimum of 5 years</li>
              <li>Risk assessment documentation</li>
              <li>Training records for all employees</li>
              <li>Suspicious activity reports and investigation files</li>
              <li>Correspondence with regulators and law enforcement</li>
            </ul>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-graduation-cap-line text-lime-400"></i>
              9. Training & Awareness
            </h2>
            <p className="leading-relaxed">
              All CardXC employees receive regular AML training covering recognition of suspicious activities, reporting procedures, and regulatory requirements. Training is updated annually and when significant regulatory changes occur. New employees receive AML training as part of their onboarding process.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-shield-user-line text-lime-400"></i>
              10. Compliance Officer
            </h2>
            <p className="leading-relaxed">
              CardXC has designated a Compliance Officer responsible for implementing and overseeing the AML program. The Compliance Officer reports directly to senior management and has the authority to halt suspicious transactions and report concerns to regulatory authorities.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-customer-service-2-line text-lime-400"></i>
              11. Contact Information
            </h2>
            <p className="leading-relaxed">
              For questions about our AML policy or to report suspicious activity:
            </p>
            <ul className="mt-4 space-y-2 ml-4">
              <li><strong>Compliance:</strong> <a href={`mailto:${COMPLIANCE_EMAIL}`} className="text-lime-400 hover:underline">{COMPLIANCE_EMAIL}</a></li>
              <li><strong>General Support:</strong> <a href={`mailto:${SUPPORT_EMAIL}`} className="text-lime-400 hover:underline">{SUPPORT_EMAIL}</a></li>
            </ul>
          </section>
        </div>

        <div className="mt-12 flex gap-4">
          <Link
            to="/terms"
            className="text-lime-400 hover:text-lime-200 transition-colors flex items-center gap-2"
          >
            <i className="ri-file-text-line"></i>
            Terms of Service
          </Link>
          <Link
            to="/privacy"
            className="text-lime-400 hover:text-lime-200 transition-colors flex items-center gap-2"
          >
            <i className="ri-shield-keyhole-line"></i>
            Privacy Policy
          </Link>
          <Link
            to="/refund-policy"
            className="text-lime-400 hover:text-lime-200 transition-colors flex items-center gap-2"
          >
            <i className="ri-refund-2-line"></i>
            Refund Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
