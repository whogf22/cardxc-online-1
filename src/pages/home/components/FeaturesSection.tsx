import { useNavigate } from "react-router-dom";
import { AnimateOnScroll } from "../../../components/AnimateOnScroll";

const features = [
  {
    icon: "ri-send-plane-2-fill",
    title: "Money Transfer",
    description: "Send money internationally with competitive exchange rates",
    details:
      "Transfer money to friends and family. Enjoy competitive exchange rates, low fees, and fast delivery. Track your transfers in real-time and get notifications when money is received.",
    gradient: "from-lime-500 to-emerald-500",
    bgTint: "bg-lime-500/[0.08]",
    borderTint: "border-lime-500/20",
    path: "/features/instant-transfers",
  highlight: false,
  },
  {
    icon: "ri-bank-card-fill",
    title: "Virtual Cards",
    description: "Create unlimited virtual cards for secure online shopping",
    details:
      "Generate instant virtual cards for any online purchase. Set spending limits, freeze cards anytime, and enjoy complete control. Perfect for subscriptions, one-time purchases, and secure transactions.",
    gradient: "from-cyan-500 to-blue-500",
    bgTint: "bg-cyan-500/[0.08]",
    borderTint: "border-cyan-500/20",
    path: "/features/universal-wallet",
  highlight: false,
  },
  {
    icon: "ri-gift-fill",
    title: "Gift Cards",
    description: "Buy and send gift cards from popular brands",
    details:
      "Choose from popular brands including Amazon, Netflix, Spotify, and more. Send gift cards instantly. Perfect for birthdays, holidays, or any special occasion.",
    gradient: "from-amber-500 to-orange-500",
    bgTint: "bg-amber-500/[0.08]",
    borderTint: "border-amber-500/20",
    path: "/giftcards",
    highlight: true,
  },
  {
    icon: "ri-wallet-3-fill",
    highlight: false,
    title: "Multi-Currency",
    description:
      "Hold and manage money in multiple currencies with no hidden fees",
    details:
      "Keep multiple currencies in one wallet. Convert between currencies at real-time rates. No monthly fees, no minimum balance. Ideal for freelancers and global businesses.",
    gradient: "from-violet-500 to-purple-500",
    bgTint: "bg-violet-500/[0.08]",
    borderTint: "border-violet-500/20",
    path: "/features/universal-wallet",
  },
  {
    icon: "ri-shield-check-fill",
    title: "Bank Security",
    description: "256-bit encryption, 2FA, and 24/7 fraud monitoring",
    details:
      "Your money is protected by bank-level security. 256-bit SSL encryption, two-factor authentication, biometric login, and 24/7 fraud monitoring. Your funds are always safe with us.",
    gradient: "from-emerald-500 to-teal-500",
    bgTint: "bg-emerald-500/[0.08]",
    borderTint: "border-emerald-500/20",
    path: "/features/elite-security",
  highlight: false,
  },
  {
    icon: "ri-customer-service-2-fill",
    title: "24/7 Support",
    description: "Get help anytime with our dedicated customer support team",
    details:
      "Our support team is available around the clock. Get help via live chat or email. We are here to help you with any questions or issues.",
    gradient: "from-rose-500 to-pink-500",
    bgTint: "bg-rose-500/[0.08]",
    borderTint: "border-rose-500/20",
    path: "/support",
    highlight: false,
  },
];

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
              One platform for transfers, gift cards, virtual cards, and more. Hover for details.
            </p>
          </div>
        </AnimateOnScroll>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {features.map((feature, index) => (
            <AnimateOnScroll key={index} delay={index * 60}>
            <div
              className={`feature-flip-card h-[280px] cursor-pointer select-none ${feature.highlight ? 'feature-highlight' : ''}`}
              onClick={() => navigate(feature.path)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(feature.path)}
              role="button"
              tabIndex={0}
            >
              <div className="feature-flip-inner relative w-full h-full">
                <div className="feature-flip-front absolute inset-0 p-6 bg-[#0d0d0d] rounded-2xl border border-white/[0.06] hover:border-white/[0.1] transition-colors">
                  <div
                    className={`w-12 h-12 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mb-5 shadow-lg`}
                  >
                    <i className={`${feature.icon} text-xl text-white`}></i>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-neutral-400 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                  <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
                    <span className="text-[11px] text-neutral-600 uppercase tracking-wider">
                      Hover for details
                    </span>
                    <i className="ri-arrow-right-line text-lime-400"></i>
                  </div>
                </div>

                <div className={`feature-flip-back absolute inset-0 p-6 bg-[#0d0d0d] rounded-2xl border ${feature.borderTint}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`w-10 h-10 bg-gradient-to-br ${feature.gradient} rounded-lg flex items-center justify-center`}
                    >
                      <i className={`${feature.icon} text-lg text-white`}></i>
                    </div>
                    <h3 className="text-lg font-semibold text-white">
                      {feature.title}
                    </h3>
                  </div>
                  <p className="text-neutral-300 text-sm leading-relaxed mb-4">
                    {feature.details}
                  </p>
                  <div className="absolute bottom-6 left-6 right-6">
                    <div className="flex items-center justify-center gap-2 py-2.5 bg-lime-500/[0.08] rounded-lg text-lime-400 text-sm font-medium border border-lime-500/20 hover:bg-lime-500/[0.12] transition-colors">
                      <span>Learn More</span>
                      <i className="ri-arrow-right-line"></i>
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
        .feature-flip-card {
          perspective: 1000px;
        }

        .feature-flip-inner {
          transform-style: preserve-3d;
          transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .feature-flip-card:hover .feature-flip-inner {
          transform: rotateY(180deg);
        }

        .feature-flip-front,
        .feature-flip-back {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }

        .feature-flip-back {
          transform: rotateY(180deg);
        }

        .feature-highlight .feature-flip-front {
          border-color: rgba(251, 191, 36, 0.25);
          box-shadow: 0 0 24px rgba(251, 191, 36, 0.08);
        }

        .feature-highlight {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
}
