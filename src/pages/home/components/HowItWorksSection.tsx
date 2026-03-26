const steps = [
  {
    number: '01',
    icon: 'ri-layout-grid-fill',
    title: 'Choose a Card Design',
    description: 'Browse our premium collection of gift cards. Pick from Birthday, Shopping, Gaming, Travel, and more.',
    color: '#0066FF',
  },
  {
    number: '02',
    icon: 'ri-edit-2-fill',
    title: 'Personalize & Set Value',
    description: 'Add a personal message, choose the amount, and customize the card design to make it truly special.',
    color: '#FFD700',
  },
  {
    number: '03',
    icon: 'ri-send-plane-fill',
    title: 'Send Instantly',
    description: 'Deliver via email or SMS in seconds. The recipient gets a beautiful card with a secure redemption code.',
    color: '#00CC88',
  },
];

export default function HowItWorksSection() {
  return (
    <section className="relative py-20 sm:py-28 overflow-hidden" style={{ background: '#0A0A0F' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#00CC88]/20 bg-[#00CC88]/5 mb-6">
            <span className="text-xs font-semibold text-[#00CC88] uppercase tracking-wider">How It Works</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Three Simple Steps
          </h2>
          <p className="text-neutral-400 max-w-xl mx-auto">
            Sending the perfect gift has never been easier. Get started in under a minute.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connecting line (desktop only) */}
          <div className="hidden md:block absolute top-[60px] left-[16%] right-[16%] h-[2px]" style={{ background: 'linear-gradient(90deg, #0066FF, #FFD700, #00CC88)' }}>
            <div className="absolute inset-0 animate-pulse opacity-50" style={{ background: 'linear-gradient(90deg, #0066FF, #FFD700, #00CC88)', filter: 'blur(4px)' }} />
          </div>

          {steps.map((step, i) => (
            <div key={i} className="relative text-center group">
              {/* Number badge */}
              <div className="relative inline-flex items-center justify-center mb-6">
                <div
                  className="w-[120px] h-[120px] rounded-full flex items-center justify-center transition-all duration-500 group-hover:scale-110"
                  style={{
                    background: `${step.color}10`,
                    border: `2px solid ${step.color}30`,
                    boxShadow: `0 0 40px ${step.color}10`,
                  }}
                >
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{
                      background: `${step.color}20`,
                      border: `1px solid ${step.color}40`,
                    }}
                  >
                    <i className={`${step.icon} text-3xl`} style={{ color: step.color }} />
                  </div>
                </div>
                {/* Step number */}
                <div
                  className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: step.color,
                    color: '#0A0A0F',
                    boxShadow: `0 0 20px ${step.color}40`,
                  }}
                >
                  {step.number}
                </div>
              </div>

              <h3 className="text-xl font-bold text-white mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {step.title}
              </h3>
              <p className="text-neutral-400 text-sm leading-relaxed max-w-xs mx-auto">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
