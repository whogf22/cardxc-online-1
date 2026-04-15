import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { COMPLIANCE_EMAIL, SUPPORT_EMAIL } from '../../lib/contactPlaceholders';

export default function AMLPolicyPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'AML Policy | CardXC — Anti-Money Laundering Compliance';
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
              <li><strong>Identity Verification:</strong> Government-issued photo ID (passport, driver's license, or national ID) required for all account holders prior to activation</li>
              <li><strong>Address Verification:</strong> Proof of residence documentation (utility bill, bank statement, or official government correspondence dated within 90 days)</li>
              <li><strong>Standard KYC Threshold:</strong> Full identity and address verification required before processing any cumulative transaction volume exceeding $1,000 within a 30-day period</li>
              <li><strong>Enhanced Due Diligence (EDD) Threshold:</strong> Additional verification — including source-of-funds documentation and senior management approval — required for customers whose cumulative transaction volume exceeds $3,000 within any 30-day period, or who are identified as high-risk based on geography, industry, or behavioral patterns</li>
              <li><strong>Beneficial Ownership:</strong> For business accounts, identification and verification of all beneficial owners holding 25% or greater ownership interest, as required under FinCEN's Customer Due Diligence (CDD) Rule (31 CFR § 1010.230)</li>
              <li><strong>Ongoing Monitoring:</strong> Continuous review of customer activity and risk profiles against established baselines; anomalies trigger re-verification</li>
              <li><strong>Periodic Review:</strong> Customer information reviewed and updated at least annually for standard-risk customers and every six months for high-risk customers or PEPs</li>
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
              <li><strong>Customer Risk Assessment:</strong> Each customer is assigned a risk tier (Low, Medium, High) based on profile, geography, occupation, transaction patterns, and PEP/sanctions status; tier determines the frequency and depth of ongoing monitoring</li>
              <li><strong>Transaction Monitoring:</strong> Automated real-time systems flag transactions for manual review based on rule-based and behavioral analytics models</li>
              <li><strong>Key Monitoring Thresholds:</strong> Transactions of $3,000 or more (individually or through aggregation within a 24-hour window) are automatically flagged for enhanced review; transactions of $10,000 or more trigger mandatory Currency Transaction Report (CTR) evaluation</li>
              <li><strong>Geographic Risk:</strong> Enhanced scrutiny applied to transactions originating from or destined to FATF-identified high-risk jurisdictions, OFAC-sanctioned countries, and jurisdictions with known deficient AML/CTF frameworks</li>
              <li><strong>Product Risk:</strong> Virtual card products used for cross-border or high-frequency transactions receive elevated monitoring relative to standard domestic use cases</li>
              <li><strong>Structuring Detection:</strong> Automated rules identify potential structuring — the deliberate splitting of transactions to fall below reporting thresholds — and escalate such patterns for immediate investigation</li>
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
              <li><strong>High-Value Single Transactions:</strong> Any single transaction exceeding $3,000 that is inconsistent with the customer's established spending profile or stated purpose of account</li>
              <li><strong>Rapid Sequential Purchases:</strong> Multiple transactions executed in quick succession (e.g., three or more transactions within a 60-minute window) that together exceed $3,000, particularly across different merchants or geographies</li>
              <li><strong>Mismatched Billing Information:</strong> Billing address, shipping address, or cardholder name that does not match verified identity documents on file, especially when combined with high-value or cross-border transactions</li>
              <li><strong>Structuring / Threshold Avoidance:</strong> A pattern of transactions just below $3,000 or $10,000 reporting thresholds, suggesting deliberate avoidance of regulatory monitoring</li>
              <li><strong>Velocity Anomalies:</strong> Sudden spike in transaction frequency or volume that deviates materially from the customer's historical baseline without a plausible explanation</li>
              <li><strong>Inconsistent Account Activity:</strong> Transactions that are inconsistent with the customer's stated business purpose, occupation, or income level as collected during onboarding</li>
              <li><strong>Rapid Fund Movement:</strong> Loading funds to a virtual card and immediately spending or transferring the full balance, particularly when this occurs repeatedly</li>
              <li><strong>Multi-Account Layering:</strong> Use of multiple accounts — whether belonging to the same individual or apparently coordinated individuals — to obscure the origin, ownership, or destination of funds</li>
              <li><strong>Unverifiable Identity Indicators:</strong> Customers who are reluctant to provide required KYC documentation, provide inconsistent information, or whose documents cannot be verified through standard procedures</li>
              <li><strong>High-Risk Jurisdiction Exposure:</strong> Transactions originating from, or payable to merchants or counterparties in, jurisdictions identified by FATF, OFAC, or FinCEN as high-risk or subject to enhanced monitoring</li>
              <li><strong>Transactions with No Apparent Economic Purpose:</strong> Payments to entities or individuals where no legitimate business or personal rationale can be identified through account review</li>
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
              <li><strong>Suspicious Activity Reports (SARs):</strong> SARs are filed electronically with the Financial Crimes Enforcement Network (FinCEN) via the BSA E-Filing System within 30 calendar days of detecting a known or suspected suspicious transaction, or within 60 days if the subject of the report is not yet identified. SARs are filed for transactions of $5,000 or more (individually or in aggregate) where money laundering or other financial crime is suspected</li>
              <li><strong>Currency Transaction Reports (CTRs):</strong> CTRs are filed with FinCEN for cash transactions exceeding $10,000 in a single business day, as required under 31 U.S.C. § 5313 and 31 CFR § 1010.311</li>
              <li><strong>Mandatory Reporting Threshold:</strong> Regardless of transaction amount, a SAR is filed whenever there is a reasonable basis to suspect that a transaction involves funds from illegal activity, is designed to evade reporting requirements, lacks a lawful purpose, or involves the use of our services to facilitate criminal activity</li>
              <li><strong>Confidentiality:</strong> In accordance with 31 U.S.C. § 5318(g)(2), CardXC does not notify any person — including the subject of the report — that a SAR has been filed or is under consideration</li>
              <li><strong>Law Enforcement Cooperation:</strong> CardXC cooperates fully with law enforcement agencies and responds promptly to subpoenas, court orders, and National Security Letters in accordance with applicable law</li>
              <li><strong>Regulatory Inquiries:</strong> All inquiries from FinCEN, federal and state regulators, and law enforcement are routed immediately to the Compliance Officer for timely response</li>
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
              <li><strong>OFAC SDN List:</strong> All customers, beneficial owners, and transaction counterparties are screened against the U.S. Office of Foreign Assets Control (OFAC) Specially Designated Nationals and Blocked Persons (SDN) List, as well as OFAC's sectoral and country-based sanctions programs, at onboarding and on a daily refresh basis</li>
              <li><strong>EU Consolidated Sanctions List:</strong> Screening against the European Union's Consolidated List of Persons, Groups, and Entities Subject to EU Financial Sanctions, updated upon each official EU publication</li>
              <li><strong>UN Security Council Sanctions:</strong> Screening against all active United Nations Security Council (UNSC) consolidated sanctions lists, including the Al-Qaida and ISIL (Da'esh) Sanctions List and all subsidiary committee lists</li>
              <li><strong>OFAC Blocked Countries:</strong> Transactions involving comprehensively sanctioned jurisdictions — currently including Cuba, Iran, North Korea, Syria, and the Crimea/Donetsk/Luhansk regions of Ukraine — are automatically blocked regardless of the individual's sanctions status</li>
              <li><strong>Real-Time Transaction Screening:</strong> Every transaction is screened in real time against all applicable sanctions lists before authorization; any potential match results in an automatic hold pending manual review</li>
              <li><strong>False-Positive Review:</strong> Potential sanctions matches undergo a documented review process. Confirmed matches result in immediate account freezing, fund blocking, and mandatory reporting to OFAC within the legally required timeframe</li>
              <li><strong>Database Updates:</strong> Sanctions screening databases are updated no less than daily, with emergency updates applied immediately upon publication of new OFAC, EU, or UN designations</li>
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
              <li><strong>PEP Definition:</strong> A Politically Exposed Person (PEP) is defined as an individual who holds or has held, within the preceding 12 months, a prominent public function — including heads of state or government, senior politicians, senior government or judicial officials, senior executives of state-owned corporations, and senior military officials — as well as their immediate family members and known close associates</li>
              <li><strong>PEP Screening at Onboarding:</strong> All customers are screened against commercial PEP databases at the time of account creation. Matches are reviewed and classified as Domestic PEP, Foreign PEP, or International Organization PEP, each subject to progressively enhanced scrutiny</li>
              <li><strong>Enhanced Due Diligence for PEPs:</strong> PEPs are subject to EDD procedures including verification of source of wealth, source of funds, and the nature and purpose of the intended business relationship</li>
              <li><strong>Senior Management Approval:</strong> Establishing or continuing a business relationship with any identified PEP requires written approval from the Compliance Officer and a designated member of senior management</li>
              <li><strong>Ongoing Monitoring:</strong> PEP accounts are subject to enhanced transaction monitoring and are reviewed on at least a semi-annual basis, or immediately upon any material change in the customer's political status or transaction behavior</li>
              <li><strong>Screening of Immediate Family and Close Associates:</strong> Spouses, domestic partners, children, parents, and siblings of identified PEPs, as well as individuals known to be business associates or close personal contacts, are subject to the same EDD requirements as the PEP themselves</li>
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
              <li><strong>Retention Period:</strong> All AML-related records are retained for a minimum of <strong>five (5) years</strong> from the date of the transaction or the closure of the customer relationship, whichever is later, in compliance with the Bank Secrecy Act (BSA), 31 U.S.C. § 5311 et seq., and implementing regulations at 31 CFR Part 1010</li>
              <li><strong>Customer Identification Records:</strong> Copies of all identity documents, verification outcomes, KYC questionnaires, beneficial ownership certifications, and risk assessments are retained for a minimum of five years following account closure</li>
              <li><strong>Transaction Records:</strong> A complete record of every transaction — including date, amount, currency, originator, beneficiary, and authorization outcome — is retained for at least five years</li>
              <li><strong>SAR and CTR Files:</strong> All filed Suspicious Activity Reports, Currency Transaction Reports, supporting documentation, and internal investigation records are retained for at least five years from the date of filing</li>
              <li><strong>Sanctions Screening Records:</strong> Screening results, match dispositions, and escalation documentation are retained for a minimum of five years</li>
              <li><strong>Training Records:</strong> Employee AML training completion records, training materials, and assessment results are retained for at least five years</li>
              <li><strong>Correspondence:</strong> All written communications with FinCEN, OFAC, federal and state regulators, and law enforcement are retained for at least five years</li>
              <li><strong>Format and Access:</strong> Records are maintained in a secure, auditable electronic format accessible to authorized personnel and retrievable within a reasonable time upon request by regulators or law enforcement</li>
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
