import { useNavigate } from 'react-router-dom';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/forever',
    description: 'Perfect for getting started',
    features: ['5 Gift Cards/month', 'Basic Card Designs', 'Email Delivery', 'Standard Support', 'Balance Tracking'],
    cta: 'Get Started Free',
    popular: false,
    color: '#666',
    bg: 'rgba(255,255,255,0.02)',
  },
  {
    name: 'Pro',
    price: '$9.99',
    period: '/month',
    description: 'For power gifters',
    features: ['Unlimited Gift Cards', 'Premium Card Designs', 'Email & SMS Delivery', 'Priority Support', 'Custom Card Designer', 'Multi-Currency', 'QR Code Redemption'],
    cta: 'Start Pro Trial',
    popular: true,
    color: '#FFD700',
    bg: 'rgba(255,215,0,0.03)',
  },
  {
    name: 'Business',
    price: '$29.99',
    period: '/month',
    description: 'For teams and companies',
    features: ['Everything in Pro', 'Bulk Card Sending', 'Brand Customization', 'API Access', 'Dedicated Account Manager', 'Analytics Dashboard', 'White-Label Options'],
    cta: 'Contact Sales',
    popular: false,
    color: '#0066FF',
    bg: 'rgba(0,102,255,0.03)',
  },
];

export default function PricingSection() {
  const navigate = useNavigate();

  return (
    <section id="pricing" className="relative py-20 sm:py-28 overflow-hidden" style={{ background: '#0A0A0F' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#FFD700]/15 to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#FFD700]/20 bg-[#FFD700]/5 mb-6">
            <span className="text-xs font-semibold text-[#FFD700] uppercase tracking-wider">Pricing</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Simple, Transparent Pricing
          </h2>
          <p className="text-neutral-400 max-w-xl mx-auto">
            Start free. Upgrade when you need more. No hidden fees, ever.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`relative rounded-2xl p-7 transition-all duration-500 hover:-translate-y-2 group ${plan.popular ? 'md:-translate-y-4 md:hover:-translate-y-6' : ''}`}
              style={{
                background: plan.bg,
                backdropFilter: 'blur(20px)',
                border: plan.popular ? `1px solid ${plan.color}40` : '1px solid rgba(255,255,255,0.06)',
                boxShadow: plan.popular ? `0 20px 60px ${plan.color}15` : 'none',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = `0 25px 60px ${plan.color}20, 0 0 40px ${plan.color}08`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = plan.popular ? `0 20px 60px ${plan.color}15` : 'none';
              }}
            >
              {plan.popular && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold"
                  style={{ background: '#FFD700', color: '#0A0A0F' }}
                >
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{plan.name}</h3>
                <p className="text-neutral-500 text-sm">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{plan.price}</span>
                <span className="text-neutral-500 text-sm">{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-center gap-2.5">
                    <i className="ri-check-line text-sm" style={{ color: plan.color === '#666' ? '#00CC88' : plan.color }} />
                    <span className="text-neutral-300 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => navigate('/signup')}
                className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                style={
                  plan.popular
                    ? { background: `linear-gradient(135deg, ${plan.color}, #FFA500)`, color: '#0A0A0F', boxShadow: `0 0 20px ${plan.color}30` }
                    : { background: 'rgba(255,255,255,0.04)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }
                }
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
