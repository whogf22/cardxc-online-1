import { useNavigate } from 'react-router-dom';

const floatingIcons = [
  { icon: 'ri-gift-2-line', top: '18%', left: '10%', delay: '0s', size: 'w-11 h-11' },
  { icon: 'ri-bank-card-line', top: '55%', left: '6%', delay: '1.2s', size: 'w-9 h-9' },
  { icon: 'ri-gift-line', top: '78%', right: '12%', left: 'auto', delay: '0.6s', size: 'w-8 h-8' },
  { icon: 'ri-wallet-3-line', top: '22%', right: '8%', left: 'auto', delay: '1.8s', size: 'w-10 h-10' },
  { icon: 'ri-send-plane-line', top: '70%', left: '15%', delay: '0.3s', size: 'w-7 h-7' },
  { icon: 'ri-global-line', top: '35%', right: '18%', left: 'auto', delay: '1s', size: 'w-8 h-8' },
];

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[85vh] sm:min-h-[90vh] lg:min-h-[92vh] flex items-center justify-center overflow-hidden w-full">
      <div className="absolute inset-0 bg-gradient-to-b from-[#030303] via-[#051505] to-[#030303]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_40%,rgba(34,197,94,0.06),transparent)]" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-lime-500/[0.08] rounded-full blur-[120px] animate-float"></div>
        <div className="absolute bottom-1/4 -right-32 w-[400px] h-[400px] bg-emerald-500/[0.05] rounded-full blur-[100px] animate-float" style={{ animationDelay: '1.5s' }}></div>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-lime-500/25 to-transparent"></div>
        {floatingIcons.map((item, i) => (
          <div
            key={i}
            className={`hidden sm:flex absolute ${item.size} items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.1] animate-float`}
            style={{ top: item.top, left: item.left, right: item.right, animationDelay: item.delay }}
          >
            <i className={`${item.icon} text-lime-400/80 text-lg`}></i>
          </div>
        ))}
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="flex items-center justify-center">
          <div className="space-y-8 max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 bg-lime-500/[0.1] px-4 py-2 rounded-full border border-lime-500/25 animate-fade-in-up">
              <div className="w-2 h-2 bg-lime-400 rounded-full animate-pulse"></div>
              <span className="text-xs font-semibold text-lime-400 uppercase tracking-wider">Send & Earn</span>
            </div>

            <div className="space-y-5 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.08] tracking-tight">
                Your Money.
                <br />
                <span className="bg-gradient-to-r from-lime-400 via-lime-300 to-emerald-400 bg-clip-text text-transparent">Worldwide.</span>
              </h1>
              <p className="text-base sm:text-lg text-neutral-400 max-w-md mx-auto leading-relaxed">
                Send money globally, buy gift cards from top brands, and manage it all in one place. Fast, secure, and built for you.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
              <button
                onClick={() => navigate('/signup')}
                className="group px-6 sm:px-8 py-3.5 sm:py-4 bg-white text-black font-bold rounded-xl hover:bg-neutral-100 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] text-[14px] sm:text-[15px]"
              >
                Sign up for CardXC
                <i className="ri-arrow-right-line ml-2 group-hover:translate-x-1 transition-transform inline-block"></i>
              </button>
              <button
                onClick={() => navigate('/giftcards')}
                className="px-6 sm:px-8 py-3.5 sm:py-4 bg-white/[0.04] text-white font-semibold rounded-xl border border-white/[0.12] hover:bg-white/[0.08] hover:border-lime-500/30 transition-all text-[14px] sm:text-[15px]"
              >
                Browse Gift Cards
              </button>
            </div>

            <div className="flex items-center justify-center gap-8 pt-2 animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
              {[
                { value: '100%', label: 'Secure' },
                { value: '24/7', label: 'Support' },
                { value: 'Instant', label: 'Transfers' }
              ].map((stat, i) => (
                <div key={i} className="flex items-center gap-8">
                  {i > 0 && <div className="w-px h-8 bg-white/[0.08] -ml-8"></div>}
                  <div>
                    <div className="text-xl font-bold text-white">{stat.value}</div>
                    <div className="text-xs text-neutral-500 uppercase tracking-wider">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>

            <a
              href="#features"
              className="inline-flex flex-col items-center gap-2 mt-12 text-neutral-500 hover:text-lime-400 transition-colors group/scroll animate-fade-in-up"
              style={{ animationDelay: '0.45s' }}
              aria-label="Scroll to features"
            >
              <span className="text-[11px] uppercase tracking-widest">Explore</span>
              <i className="ri-arrow-down-s-line text-2xl animate-bounce group-hover/scroll:animate-none"></i>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
