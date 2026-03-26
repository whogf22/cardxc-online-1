const features = [
  {
    icon: 'ri-flashlight-fill',
    title: 'Instant Digital Delivery',
    description: 'Send gift cards instantly via email or SMS. No waiting, no shipping delays.',
    glow: '#0066FF',
  },
  {
    icon: 'ri-palette-fill',
    title: 'Custom Card Designer',
    description: 'Design unique cards with our built-in editor. Add personal messages and photos.',
    glow: '#FFD700',
  },
  {
    icon: 'ri-shield-keyhole-fill',
    title: 'Secure Encrypted Codes',
    description: 'Every card code is encrypted with 256-bit SSL. Bank-grade security for every transaction.',
    glow: '#00CC88',
  },
  {
    icon: 'ri-global-fill',
    title: 'Multi-Currency Support',
    description: 'Buy and send cards in 50+ currencies. Automatic conversion at real-time rates.',
    glow: '#9966FF',
  },
  {
    icon: 'ri-qr-code-fill',
    title: 'QR Code Redemption',
    description: 'Scan and redeem instantly. Every card comes with a unique QR code for fast checkout.',
    glow: '#FF6633',
  },
  {
    icon: 'ri-line-chart-fill',
    title: 'Real-Time Balance Tracking',
    description: 'Track every card balance in real-time. Get notifications on usage and remaining value.',
    glow: '#0066FF',
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="relative py-20 sm:py-28 overflow-hidden" style={{ background: '#0A0A0F' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#0066FF]/20 to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#0066FF]/20 bg-[#0066FF]/5 mb-6">
            <span className="text-xs font-semibold text-[#0066FF] uppercase tracking-wider">Features</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Everything You Need
          </h2>
          <p className="text-neutral-400 max-w-xl mx-auto text-base sm:text-lg">
            A complete gift card platform with premium features built for the modern world.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, i) => (
            <div
              key={i}
              className="group relative rounded-2xl p-6 sm:p-7 transition-all duration-500 hover:-translate-y-2 cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.02)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.border = `1px solid ${feature.glow}40`;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 20px 60px ${feature.glow}15, 0 0 40px ${feature.glow}08`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.border = '1px solid rgba(255,255,255,0.06)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-110"
                style={{
                  background: `${feature.glow}15`,
                  border: `1px solid ${feature.glow}25`,
                }}
              >
                <i className={`${feature.icon} text-2xl`} style={{ color: feature.glow }} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {feature.title}
              </h3>
              <p className="text-neutral-400 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
