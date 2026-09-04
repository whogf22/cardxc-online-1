import TrustBadge from '../../../components/TrustBadge';

const badges = [
  {
    icon: 'ri-shield-check-fill',
    title: 'TLS 1.3 Encryption',
    description: 'Your data is protected in transit with modern encryption.',
  },
  {
    icon: 'ri-lock-fill',
    title: 'PCI-Compliant Payments',
    description: 'Card payments are handled by PCI DSS certified infrastructure, so your card details stay off our servers.',
  },
  {
    icon: 'ri-fingerprint-fill',
    title: '2FA Protection',
    description: 'Add an extra layer of security to your account with two-factor authentication.',
  },
  {
    icon: 'ri-eye-off-fill',
    title: '24/7 Fraud Monitoring',
    description: 'Automated risk detection and manual review for suspicious activity.',
  },
];

export default function TrustSection() {
  return (
    <section className="py-16 sm:py-24 bg-[#030303] w-full overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 w-full">
        <div className="text-center mb-12 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/[0.08] rounded-full border border-emerald-500/20 mb-6">
            <i className="ri-shield-check-fill text-emerald-400 text-sm"></i>
            <span className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">Security</span>
          </div>
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
            Security You Can Rely On
          </h2>
          <p className="text-base sm:text-lg text-neutral-400 max-w-xl mx-auto">
            Transparent protections for your money and data.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {badges.map((badge, index) => (
            <TrustBadge
              key={index}
              icon={badge.icon}
              title={badge.title}
              description={badge.description}
              variant="emerald"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
