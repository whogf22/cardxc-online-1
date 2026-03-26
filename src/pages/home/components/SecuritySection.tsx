const badges = [
  {
    icon: 'ri-shield-keyhole-fill',
    title: '256-bit SSL Encryption',
    description: 'All data encrypted with military-grade security protocols.',
  },
  {
    icon: 'ri-bank-card-fill',
    title: 'PCI-DSS Compliant',
    description: 'Fully compliant with payment card industry data security standards.',
  },
  {
    icon: 'ri-alarm-warning-fill',
    title: 'Instant Fraud Detection',
    description: 'AI-powered fraud monitoring catches suspicious activity in real-time.',
  },
  {
    icon: 'ri-customer-service-2-fill',
    title: '24/7 Support',
    description: 'Round-the-clock support team ready to help with any security concerns.',
  },
];

export default function SecuritySection() {
  return (
    <section className="relative py-20 sm:py-28 overflow-hidden" style={{ background: '#0A0A0F' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00CC88]/15 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[200px] opacity-8" style={{ background: '#00CC88' }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#00CC88]/20 bg-[#00CC88]/5 mb-6">
            <i className="ri-shield-check-fill text-[#00CC88] text-sm" />
            <span className="text-xs font-semibold text-[#00CC88] uppercase tracking-wider">Security</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Bank-Grade Security
          </h2>
          <p className="text-neutral-400 max-w-xl mx-auto">
            Your cards are protected by the same security standards used by the world's largest banks.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {badges.map((badge, i) => (
            <div
              key={i}
              className="group rounded-2xl p-6 text-center transition-all duration-500 hover:-translate-y-2"
              style={{
                background: 'rgba(255,255,255,0.02)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(0,204,136,0.1)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.border = '1px solid rgba(0,204,136,0.3)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 60px rgba(0,204,136,0.1), 0 0 40px rgba(0,204,136,0.05)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.border = '1px solid rgba(0,204,136,0.1)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              <div className="w-14 h-14 rounded-xl mx-auto mb-4 flex items-center justify-center transition-all duration-300 group-hover:scale-110" style={{ background: 'rgba(0,204,136,0.1)', border: '1px solid rgba(0,204,136,0.2)' }}>
                <i className={`${badge.icon} text-2xl text-[#00CC88]`} />
              </div>
              <h3 className="text-white font-bold text-sm mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{badge.title}</h3>
              <p className="text-neutral-500 text-xs leading-relaxed">{badge.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
