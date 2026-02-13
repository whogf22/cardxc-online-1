import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DISPUTES_EMAIL, SUPPORT_EMAIL } from '../../lib/contactPlaceholders';

export default function RefundPolicyPage() {
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
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Refund & Dispute Policy</h1>
        <p className="text-neutral-400 mb-12">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>

        <div className="space-y-8 text-neutral-300">
          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-refund-2-line text-lime-400"></i>
              1. Overview
            </h2>
            <p className="leading-relaxed">
              CardXC, a digital wallet and payments platform operated by GameNova Vault LLC, is committed to providing fair and transparent refund and dispute resolution processes. This policy outlines how we handle refund requests, chargebacks, and disputes related to transactions made with your CardXC virtual payment cards. We work diligently to resolve all issues promptly and fairly.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-exchange-funds-line text-lime-400"></i>
              2. Refund Eligibility
            </h2>
            <p className="leading-relaxed mb-4">
              You may be eligible for a refund in the following circumstances:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Unauthorized transactions on your virtual card</li>
              <li>Duplicate charges for the same transaction</li>
              <li>Merchant did not deliver goods or services as promised</li>
              <li>Goods or services received were significantly different from description</li>
              <li>Technical errors resulting in incorrect charges</li>
              <li>Cancelled subscriptions that continued to charge</li>
            </ul>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-time-line text-lime-400"></i>
              3. Timeframes
            </h2>
            <p className="leading-relaxed mb-4">
              Important timeframes for refund and dispute requests:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Dispute filing:</strong> Within 120 days of the transaction date</li>
              <li><strong>Initial response:</strong> We will acknowledge your dispute within 2 business days</li>
              <li><strong>Investigation:</strong> Typically completed within 45 days</li>
              <li><strong>Provisional credit:</strong> May be issued within 10 business days for qualifying disputes</li>
              <li><strong>Final resolution:</strong> Communicated within 90 days of filing</li>
            </ul>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-file-list-3-line text-lime-400"></i>
              4. How to File a Dispute
            </h2>
            <p className="leading-relaxed mb-4">
              To initiate a dispute or refund request:
            </p>
            <ol className="list-decimal list-inside space-y-3 ml-4">
              <li>Log in to your CardXC account</li>
              <li>Navigate to your transaction history</li>
              <li>Select the transaction you wish to dispute</li>
              <li>Click "Report Issue" or "Dispute Transaction"</li>
              <li>Provide detailed information about the issue</li>
              <li>Upload any supporting documentation (receipts, correspondence with merchant)</li>
              <li>Submit your dispute for review</li>
            </ol>
            <p className="leading-relaxed mt-4">
              Alternatively, you can contact our support team at <a href={`mailto:${DISPUTES_EMAIL}`} className="text-lime-400 hover:underline">{DISPUTES_EMAIL}</a> with your dispute details.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-search-eye-line text-lime-400"></i>
              5. Investigation Process
            </h2>
            <p className="leading-relaxed mb-4">
              Our dispute investigation process includes:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Review of transaction details and your submitted evidence</li>
              <li>Contact with the merchant's acquiring bank when necessary</li>
              <li>Analysis of similar dispute patterns for fraud detection</li>
              <li>Verification of your identity and account ownership</li>
              <li>Communication with you regarding any additional information needed</li>
            </ul>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-money-dollar-circle-line text-lime-400"></i>
              6. Refund Methods
            </h2>
            <p className="leading-relaxed mb-4">
              Approved refunds are processed as follows:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Virtual card transactions:</strong> Credited back to your CardXC payment account balance</li>
              <li><strong>Deposit refunds:</strong> Returned via the original payment method when possible</li>
              <li><strong>Provisional credits:</strong> May be reversed if the dispute is not resolved in your favor</li>
            </ul>
            <p className="leading-relaxed mt-4">
              Refunds typically appear in your account within 5-10 business days of approval.
            </p>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-close-circle-line text-lime-400"></i>
              7. Non-Refundable Transactions
            </h2>
            <p className="leading-relaxed mb-4">
              The following transactions are generally not eligible for refunds:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Transactions you authorized, even if you later changed your mind</li>
              <li>Purchases where the merchant has a clear no-refund policy that was disclosed</li>
              <li>Disputes filed after the 120-day window</li>
              <li>Transactions where you received the goods/services as described</li>
              <li>Currency exchange fees and service charges</li>
              <li>Virtual card creation or maintenance fees</li>
            </ul>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-shield-check-line text-lime-400"></i>
              8. Fraud Protection
            </h2>
            <p className="leading-relaxed mb-4">
              CardXC provides robust fraud protection for our users:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Zero liability for unauthorized transactions reported promptly</li>
              <li>Real-time transaction monitoring and alerts</li>
              <li>Ability to freeze your card instantly from the app</li>
              <li>Spending limits that you control</li>
              <li>Secure card details that can be regenerated if compromised</li>
            </ul>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <i className="ri-customer-service-2-line text-lime-400"></i>
              9. Contact Us
            </h2>
            <p className="leading-relaxed">
              For questions about this Refund & Dispute Policy or to file a dispute, please contact us:
            </p>
            <ul className="mt-4 space-y-2 ml-4">
              <li><strong>Email:</strong> <a href={`mailto:${DISPUTES_EMAIL}`} className="text-lime-400 hover:underline">{DISPUTES_EMAIL}</a></li>
              <li><strong>Support:</strong> <a href={`mailto:${SUPPORT_EMAIL}`} className="text-lime-400 hover:underline">{SUPPORT_EMAIL}</a></li>
              <li><strong>In-App:</strong> Use the dispute feature in your transaction history</li>
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
            to="/aml-policy"
            className="text-lime-400 hover:text-lime-200 transition-colors flex items-center gap-2"
          >
            <i className="ri-scales-3-line"></i>
            AML Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
