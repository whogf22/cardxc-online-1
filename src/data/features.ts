export interface FeatureItem {
  slug: string;
  icon: string;
  title: string;
  description: string;
  gradient: string;
  fullTitle?: string;
  fullDescription: string;
  points?: string[];
}

export const featuresList: FeatureItem[] = [
  {
    slug: 'instant-transfers',
    icon: 'ri-send-plane-2-fill',
    title: 'Instant Transfers',
    description: 'Send money globally in seconds',
    gradient: 'from-emerald-400 to-emerald-600',
    fullDescription: 'Send money to anyone, anywhere, in seconds. CardXC uses real-time rails so your recipient gets funds the same day. No waiting days for bank transfers—just enter the amount, choose the recipient, and send. Supports multiple currencies and transparent fees so you always know what you pay.',
    points: [
      'Same-day delivery to 180+ countries',
      'Multiple currencies with live rates',
      'Transparent fees before you confirm',
      'Recurring and one-time transfers'
    ]
  },
  {
    slug: 'elite-security',
    icon: 'ri-shield-flash-fill',
    title: 'Elite Security',
    description: 'Bank-grade encryption & 2FA protection',
    gradient: 'from-success-400 to-success-500',
    fullDescription: 'Your money and data are protected with bank-level security. We use 256-bit SSL encryption, two-factor authentication, and 24/7 fraud monitoring. Every transaction is verified and every session is secure so you can send and manage money with confidence.',
    points: [
      '256-bit SSL encryption',
      'Two-factor authentication (2FA)',
      '24/7 fraud monitoring',
      'PCI DSS compliant'
    ]
  },
  {
    slug: 'universal-wallet',
    icon: 'ri-wallet-3-fill',
    title: 'Universal Wallet',
    description: 'USD, USDT & 150+ international assets',
    gradient: 'from-primary-400 to-primary-500',
    fullDescription: 'One wallet for multiple currencies and assets. Hold USD, USDT, and 150+ international options. Top up with card or bank transfer, switch between currencies at live rates, and manage everything from a single dashboard.',
    points: [
      'USD, USDT and 150+ assets',
      'Live exchange rates',
      'Top up by card or bank',
      'Single dashboard for all balances'
    ]
  },
  {
    slug: 'fee-calculator',
    icon: 'ri-calculator-fill',
    title: 'Fee Calculator',
    description: "See how much you'll save with CardXC before you send",
    gradient: 'from-lime-500 to-lime-700',
    fullDescription: 'See exactly what you pay and what your recipient gets before you send. Compare CardXC fees with traditional banks and get a clear breakdown of exchange rate, fee, and amount received. No surprises—just transparent numbers.',
    points: [
      'Real-time rate and fee breakdown',
      'Compare with traditional bank fees',
      'See recipient amount before sending',
      'No hidden charges'
    ]
  },
  {
    slug: 'advanced-intel',
    icon: 'ri-pie-chart-2-fill',
    title: 'Advanced Intel',
    description: 'Deep spending insights & real-time logs',
    gradient: 'from-warning-400 to-warning-500',
    fullDescription: 'Understand your money at a glance. Get spending insights, category breakdowns, and real-time transaction logs. Export statements, set alerts, and track every transfer and gift card in one place.',
    points: [
      'Spending by category and time',
      'Real-time transaction history',
      'Export statements',
      'Custom alerts for large or recurring payments'
    ]
  },
  {
    slug: 'vault-systems',
    icon: 'ri-safe-fill',
    title: 'Vault Systems',
    description: 'Institutional-grade asset protection',
    gradient: 'from-lime-500 to-lime-600',
    fullDescription: 'Your funds are held with institutional-grade safeguards. We use segregated accounts, cold storage where applicable, and strict internal controls so your money is protected at every step.',
    points: [
      'Segregated client funds',
      'Strict internal controls',
      'Regulatory compliance',
      'Audit trails for all movements'
    ]
  },
  {
    slug: 'vip-support',
    icon: 'ri-customer-service-2-fill',
    title: 'VIP Support',
    description: 'Dedicated 24/7 financial assistance',
    gradient: 'from-primary-300 to-primary-400',
    fullDescription: 'Get help when you need it. Our support team is available 24/7 to answer questions about transfers, gift cards, security, and your account. Reach us by chat, email, or in-app—we respond quickly and clearly.',
    points: [
      '24/7 availability',
      'Chat, email, and in-app support',
      'Dedicated to account and payments',
      'Fast, clear responses'
    ]
  }
];

export function getFeatureBySlug(slug: string): FeatureItem | undefined {
  return featuresList.find((f) => f.slug === slug);
}
