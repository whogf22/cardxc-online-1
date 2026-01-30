import { Router, Request, Response } from 'express';

const router = Router();

const COMPANY_NAME = 'CardXC Inc.';
const COMPANY_EMAIL = 'legal@cardxc.com';
const SUPPORT_EMAIL = 'support@cardxc.com';
const EFFECTIVE_DATE = '2026-01-01';

router.get('/terms', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      title: 'Terms of Service',
      effectiveDate: EFFECTIVE_DATE,
      content: {
        sections: [
          {
            title: '1. Acceptance of Terms',
            content: `By accessing or using CardXC services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.`
          },
          {
            title: '2. Description of Services',
            content: `CardXC provides digital wallet, virtual card, and payment services. Our services include: virtual card issuance, P2P transfers, payment links, QR payments, and related financial services.`
          },
          {
            title: '3. Account Registration',
            content: `You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials. You must be at least 18 years old to use our services.`
          },
          {
            title: '4. Identity Verification (KYC)',
            content: `We may require identity verification to comply with financial regulations. You agree to provide truthful documentation when requested. Accounts may be limited or suspended pending verification.`
          },
          {
            title: '5. Fees and Charges',
            content: `Fees may apply for certain transactions. All applicable fees will be disclosed before you confirm a transaction. We reserve the right to modify our fee structure with 30 days notice.`
          },
          {
            title: '6. Prohibited Activities',
            content: `You may not use CardXC for: illegal activities, money laundering, fraud, terrorist financing, or any activity that violates applicable laws. We reserve the right to suspend accounts engaged in prohibited activities.`
          },
          {
            title: '7. Transaction Limits',
            content: `We impose daily, weekly, and monthly transaction limits for security purposes. Limits may vary based on account verification status. Contact support to request limit increases.`
          },
          {
            title: '8. Disputes and Chargebacks',
            content: `Report unauthorized transactions within 60 days. We will investigate and provide resolution within 10 business days. Fraudulent dispute claims may result in account termination.`
          },
          {
            title: '9. Account Termination',
            content: `We may suspend or terminate accounts that violate these terms. You may close your account at any time by contacting support. Outstanding balances must be withdrawn before account closure.`
          },
          {
            title: '10. Limitation of Liability',
            content: `CardXC is not liable for indirect, incidental, or consequential damages. Our total liability is limited to the amount in your account at the time of the incident.`
          },
          {
            title: '11. Changes to Terms',
            content: `We may update these terms with 30 days notice. Continued use after changes constitutes acceptance. Material changes will be communicated via email.`
          },
          {
            title: '12. Contact Information',
            content: `For questions about these terms, contact us at ${COMPANY_EMAIL}. For support, email ${SUPPORT_EMAIL}.`
          }
        ],
        company: COMPANY_NAME,
        lastUpdated: EFFECTIVE_DATE
      }
    }
  });
});

router.get('/privacy', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      title: 'Privacy Policy',
      effectiveDate: EFFECTIVE_DATE,
      content: {
        sections: [
          {
            title: '1. Information We Collect',
            content: `We collect: Personal information (name, email, phone), Identity documents for KYC, Transaction history, Device information and IP addresses, Usage data and analytics.`
          },
          {
            title: '2. How We Use Your Information',
            content: `We use your data to: Provide financial services, Verify identity and prevent fraud, Comply with legal requirements, Improve our services, Send important account updates.`
          },
          {
            title: '3. Information Sharing',
            content: `We may share data with: Payment processors for transactions, Identity verification services, Law enforcement when legally required, Service providers who assist our operations. We never sell your personal data.`
          },
          {
            title: '4. Data Security',
            content: `We implement: Bank-level encryption (AES-256), Secure servers with regular audits, Two-factor authentication, Regular security assessments.`
          },
          {
            title: '5. Data Retention',
            content: `Transaction records are kept for 7 years per financial regulations. Account data is retained while your account is active. You may request deletion after account closure.`
          },
          {
            title: '6. Your Rights',
            content: `You have the right to: Access your personal data, Correct inaccurate information, Request data deletion (subject to legal requirements), Export your data, Opt-out of marketing communications.`
          },
          {
            title: '7. Cookies and Tracking',
            content: `We use essential cookies for: Session management, Security, Fraud prevention. Analytics cookies help us improve services. You can manage cookie preferences in your browser.`
          },
          {
            title: '8. Third-Party Services',
            content: `We integrate with: Stripe for payments, Google for authentication (optional), Email service providers. Each has their own privacy policy.`
          },
          {
            title: '9. International Transfers',
            content: `Your data may be processed in countries outside your residence. We ensure adequate protection through standard contractual clauses.`
          },
          {
            title: '10. Children\'s Privacy',
            content: `Our services are not intended for users under 18. We do not knowingly collect data from minors.`
          },
          {
            title: '11. Changes to Privacy Policy',
            content: `We may update this policy with notice. Material changes will be communicated via email. Your continued use constitutes acceptance.`
          },
          {
            title: '12. Contact Us',
            content: `For privacy inquiries: ${COMPANY_EMAIL}. For data requests: privacy@cardxc.com. Response within 30 days.`
          }
        ],
        company: COMPANY_NAME,
        lastUpdated: EFFECTIVE_DATE
      }
    }
  });
});

router.get('/refund', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      title: 'Refund Policy',
      effectiveDate: EFFECTIVE_DATE,
      content: {
        sections: [
          {
            title: 'Card Purchase Fees',
            content: 'Virtual card creation fees are non-refundable once the card is issued and activated.'
          },
          {
            title: 'Transaction Fees',
            content: 'Transaction fees are non-refundable. Processing fees are incurred at the time of transaction.'
          },
          {
            title: 'Unauthorized Transactions',
            content: 'Report unauthorized transactions within 60 days for full investigation. Verified unauthorized transactions will be refunded within 10 business days.'
          },
          {
            title: 'Account Balance',
            content: 'Account balance can be withdrawn at any time to your linked bank account. Standard withdrawal processing time is 1-3 business days.'
          },
          {
            title: 'Contact Support',
            content: `For refund requests, contact ${SUPPORT_EMAIL} with transaction details.`
          }
        ],
        company: COMPANY_NAME,
        lastUpdated: EFFECTIVE_DATE
      }
    }
  });
});

export { router as legalRouter };
