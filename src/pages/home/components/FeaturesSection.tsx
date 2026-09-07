import { useNavigate } from 'react-router-dom';
import { AnimateOnScroll } from '../../../components/AnimateOnScroll';

type FeatureStatus = 'Core platform' | 'Provider-gated' | 'Public support';

const features: Array<{
  icon: string;
  title: string;
  description: string;
  details: string;
  gradient: string;
  bgTint: string;
  borderTint: string;
  path: string;
  highlight: boolean;
  status: FeatureStatus;
}> = [
  {
    icon: 'ri-send-plane-2-fill',
    title: 'Money Movement',
    description: 'Track supported transfers and wallet movements with clear transaction history',
    details:
      'CardXC includes wallet and transfer workflows with transaction tracking and notifications. Availability, settlement speed, supported destinations, and fees depend on the payment rail, account eligibility, and provider configuration.',
    gradient: 'from-lime-500 to-emerald-500',
    bgTint: 'bg-lime-500/[0.08]',
    borderTint: 'border-lime-500/20',
    path: '/features/instant-transfers',
    highlight: false,
    status: 'Core platform',
  },
  {
    icon: 'ri-bank-card-fill',
    title: 'Virtual Cards',
    description: 'Create and manage virtual-card experiences when eligible and provider-enabled',
    details:
      'The platform contains virtual-card issuance and management workflows such as spending controls and freeze/unfreeze actions. Production availability is conditional on provider configuration, approval, geography, and user eligibility.',
    gradient: 'from-cyan-500 to-blue-500',
    bgTint: 'bg-cyan-500/[0.08]',
    borderTint: 'border-cyan-500/20',
    path: '/features/universal-wallet',
    highlight: false,
    status: 'Provider-gated',
  },
  {
    icon: 'ri-gift-fill',
    title: 'Gift Cards',
    description: 'Browse gift-card experiences backed by provider-integrated catalog workflows',
    details:
      'CardXC includes gift-card catalog, pricing, purchase-request, and fulfillment foundations. Actual brands, denominations, rates, and fulfillment availability depend on provider configuration and approval.',
    gradient: 'from-amber-500 to-orange-500',
    bgTint: 'bg-amber-500/[0.08]',
    borderTint: 'border-amber-500/20',
    path: '/giftcards',
    highlight: true,
    status: 'Provider-gated',
  },
  {
    icon: 'ri-wallet-3-fill',
    title: 'Multi-Currency',
    description: 'Manage supported wallet balances in a single account experience',
    details:
      'The current platform code supports USD, EUR, GBP, NGN, and BDT wallet balances. Exchange and settlement behavior can depend on environment and provider availability; displayed rates and fees should be reviewed before a transaction is confirmed.',
    gradient: 'from-violet-500 to-purple-500',
    bgTint: 'bg-violet-500/[0.08]',
    borderTint: 'border-violet-500/20',
    path: '/features/universal-wallet',
    highlight: false,
    status: 'Core platform',
  },
  {
    icon: 'ri-shield-check-fill',
    title: 'Security Controls',
    description: '2FA, rate limiting, webhook verification, fraud checks, and monitoring foundations',
    details:
      'CardXC uses layered application-security controls including authentication protections, rate limiting, verified provider webhooks, fraud-oriented checks, and production error monitoring. These controls reduce risk but do not make any online service risk-free.',
    gradient: 'from-emerald-500 to-teal-500',
    bgTint: 'bg-emerald-500/[0.08]',
    borderTint: 'border-emerald-500/20',
    path: '/features/elite-security',
    highlight: false,
    status: 'Core platform',
  },
  {
    icon: 'ri-customer-service-2-fill',
    title: 'Customer Support',
    description: 'Public support channels are available without requiring an account login',
    details:
      'Contact information is publicly available by email, phone, and WhatsApp. Response times can vary. CardXC does not claim a guaranteed 24/7 response SLA unless a formal support commitment is published.',
    gradient: 'from-rose-500 to-pink-500',
    bgTint: 'bg-rose-500/[0.08]',
    borderTint: 'border-rose-500/20',
    path: '/support',
    highlight: false,
    status: 'Public support',
  },
];

const statusClass: Record<FeatureStatus, string> = {
  'Core platform': 'border-lime-500/20 bg-lime-500/[0.08] text-lime-400',
  'Provider-gated': 'border-amber-500/20 bg-amber-500/[0.08] text-amber-300',
  'Public support': 'border-cyan-500/20 bg-cyan-500/[0.08] text-cyan-300',
};

export default function FeaturesSection() {
  const navigate = useNavigate();

  return (
    <section id="features" className="py-16 sm:py-20 lg:py-24 bg-[#030303] w-full overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 w-full">
        <AnimateOnScroll>
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-lime-500/[0.08] rounded-full border border-lime-500/20 mb-6">
              <span className="text-lime-400 text-xs font-semibold uppercase tracking-wider">Explore</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
              Everything You Need
            </h2>
            <p className="text-base sm:text-lg text-neutral-400 max-w-2xl mx-auto px-2 sm:px-0">
              One platform for wallet tools, transfers, gift cards, virtual-card experiences, and support. Availability labels distinguish core platform features from provider-gated functionality.
            </p>
          </div>
        </AnimateOnScroll>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {features.map((feature, index) => (
            <AnimateOnScroll key={feature.title} delay={index * 60}>
              <div
                className={`feature-flip-card h-[300px] cursor-pointer select-none ${feature.highlight ? 'feature-highlight' : ''}`}
                onClick={() => navigate(feature.path)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(feature.path);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`${feature.title}. ${feature.status}. Open details.`}
              >
                <div className="feature-flip-inner relative w-full h-full">
                  <div className="feature-flip-front absolute inset-0 p-6 bg-[#0d0d0d] rounded-2xl border border-white/[0.06] hover:border-white/[0.1] transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-5">
                      <div className={`w-12 h-12 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center shadow-lg`}>
                        <i className={`${feature.icon} text-xl text-white`} aria-hidden />
                      </div>
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusClass[feature.status]}`}>
                        {feature.status}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                    <p className="text-neutral-400 text-sm leading-relaxed">{feature.description}</p>
                    <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
                      <span className="text-[11px] text-neutral-600 uppercase tracking-wider">Hover for details</span>
                      <i className="ri-arrow-right-line text-lime-400" aria-hidden />
                    </div>
                  </div>

                  <div className={`feature-flip-back absolute inset-0 p-6 bg-[#0d0d0d] rounded-2xl border ${feature.borderTint}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 bg-gradient-to-br ${feature.gradient} rounded-lg flex items-center justify-center`}>
                        <i className={`${feature.icon} text-lg text-white`} aria-hidden />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                        <span className="text-[10px] uppercase tracking-wider text-neutral-500">{feature.status}</span>
                      </div>
                    </div>
                    <p className="text-neutral-300 text-sm leading-relaxed mb-4">{feature.details}</p>
                    <div className="absolute bottom-6 left-6 right-6">
                      <div className="flex items-center justify-center gap-2 py-2.5 bg-lime-500/[0.08] rounded-lg text-lime-400 text-sm font-medium border border-lime-500/20 hover:bg-lime-500/[0.12] transition-colors">
                        <span>Learn More</span>
                        <i className="ri-arrow-right-line" aria-hidden />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>

      <style>{`
        .feature-flip-card { perspective: 1000px; }
        .feature-flip-inner {
          transform-style: preserve-3d;
          transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .feature-flip-card:hover .feature-flip-inner,
        .feature-flip-card:focus-visible .feature-flip-inner { transform: rotateY(180deg); }
        .feature-flip-card:focus-visible { outline: 2px solid rgb(163 230 53); outline-offset: 4px; border-radius: 1rem; }
        .feature-flip-front,
        .feature-flip-back {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .feature-flip-back { transform: rotateY(180deg); }
        .feature-highlight .feature-flip-front {
          border-color: rgba(251, 191, 36, 0.25);
          box-shadow: 0 0 24px rgba(251, 191, 36, 0.08);
        }
        .feature-highlight { animation: float 4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .feature-flip-inner { transition: none; }
          .feature-highlight { animation: none; }
        }
      `}</style>
    </section>
  );
}
