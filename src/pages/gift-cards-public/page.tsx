import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Footer from '../home/components/Footer';
import ContactModal from '../home/components/ContactModal';

const brands = [
  { name: 'Amazon', icon: 'ri-amazon-fill' },
  { name: 'Netflix', icon: 'ri-netflix-fill' },
  { name: 'Spotify', icon: 'ri-spotify-fill' },
  { name: 'Apple', icon: 'ri-apple-fill' },
  { name: 'Google Play', icon: 'ri-google-play-fill' },
  { name: 'Steam', icon: 'ri-steam-fill' },
  { name: 'Starbucks', icon: 'ri-cup-line' },
  { name: 'Xbox', icon: 'ri-gamepad-line' },
  { name: 'Uber', icon: 'ri-taxi-line' },
  { name: 'DoorDash', icon: 'ri-e-bike-2-line' },
  { name: 'Airbnb', icon: 'ri-home-smile-line' },
  { name: 'Nike', icon: 'ri-footprint-line' },
];

export default function GiftCardsPublicPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Gift Cards | CardXC \u2014 Buy Gift Cards from 700+ Brands';
  }, []);

  return (
    <div className="min-h-screen bg-[#030303] w-full min-w-0 overflow-x-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#030303]/90 backdrop-blur-xl border-b border-white/[0.06] safe-top transition-all duration-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 w-full">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <button onClick={() => navigate('/')} className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 bg-lime-500 rounded-lg flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-all duration-200">
                <i className="ri-wallet-3-line text-lg text-black font-bold"></i>
              </div>
              <span className="text-lg font-bold text-white tracking-tight">CardXC</span>
            </button>

            <div className="hidden md:flex items-center gap-0.5">
              <button onClick={() => navigate('/gift-cards')} className="px-4 py-2 text-[13px] font-medium text-lime-400 rounded-lg transition-colors">
                Gift Cards
              </button>
              <a href="/#features" className="px-4 py-2 text-[13px] font-medium text-neutral-400 hover:text-lime-400 rounded-lg transition-colors">
                Features
              </a>
              <Link to="/how-it-works" className="px-4 py-2 text-[13px] font-medium text-neutral-400 hover:text-lime-400 rounded-lg transition-colors">
                How It Works
              </Link>
              <button onClick={() => setIsContactOpen(true)} className="px-4 py-2 text-[13px] font-medium text-neutral-400 hover:text-lime-400 rounded-lg transition-colors">
                Contact
              </button>
            </div>

            <div className="hidden md:flex items-center gap-2 ml-2">
              <button onClick={() => navigate('/signin')} className="px-4 py-2.5 text-sm font-medium text-neutral-300 hover:text-white rounded-lg hover:bg-white/[0.04] transition-colors">
                Sign In
              </button>
              <button onClick={() => navigate('/signup')} className="px-5 py-2.5 text-sm font-semibold text-black bg-lime-500 rounded-lg hover:bg-lime-400 transition-all duration-200 shadow-glow-sm hover:shadow-glow hover:scale-[1.02] active:scale-[0.98]">
                Get Started
              </button>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              <i className={`text-xl text-white ${mobileMenuOpen ? 'ri-close-line' : 'ri-menu-line'}`}></i>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/[0.06] bg-[#0d0d0d]/98 backdrop-blur-xl">
            <div className="px-4 py-4 space-y-0.5">
              <button onClick={() => { navigate('/gift-cards'); setMobileMenuOpen(false); }} className="flex items-center gap-3 w-full text-left py-3.5 px-4 rounded-lg text-lime-400 hover:bg-white/[0.04] transition-colors">
                <i className="ri-gift-2-line text-lg"></i>
                <span className="font-medium">Gift Cards</span>
              </button>
              <a href="/#features" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 w-full py-3.5 px-4 rounded-lg text-neutral-300 hover:text-lime-400 hover:bg-white/[0.04] transition-colors">
                <i className="ri-apps-line text-lg text-neutral-500"></i>
                <span className="font-medium">Features</span>
              </a>
              <Link to="/how-it-works" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 w-full py-3.5 px-4 rounded-lg text-neutral-300 hover:text-lime-400 hover:bg-white/[0.04] transition-colors">
                <i className="ri-question-line text-lg text-neutral-500"></i>
                <span className="font-medium">How It Works</span>
              </Link>
              <div className="pt-4 mt-2 border-t border-white/[0.06] flex gap-3">
                <button onClick={() => { navigate('/signin'); setMobileMenuOpen(false); }} className="flex-1 py-3 text-center text-sm font-medium text-neutral-300 bg-white/[0.04] rounded-lg border border-white/[0.08] hover:bg-white/[0.06] transition-colors">
                  Sign In
                </button>
                <button onClick={() => { navigate('/signup'); setMobileMenuOpen(false); }} className="flex-1 py-3 text-center text-sm font-semibold text-black bg-lime-500 rounded-lg hover:bg-lime-400 transition-colors">
                  Get Started
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="pt-14 sm:pt-16 w-full min-w-0">
        <section className="relative py-16 sm:py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#030303] via-[#051505] to-[#030303]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_40%,rgba(34,197,94,0.06),transparent)]" />
          <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 text-center">
            <div className="inline-flex items-center gap-2 bg-lime-500/[0.1] px-4 py-2 rounded-full border border-lime-500/25 mb-6">
              <i className="ri-gift-2-line text-lime-400"></i>
              <span className="text-xs font-semibold text-lime-400 uppercase tracking-wider">700+ Brands</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight tracking-tight mb-4">
              Gift Cards
            </h1>
            <p className="text-lg sm:text-xl text-neutral-400 max-w-lg mx-auto">
              Browse 700+ brands. Buy instantly.
            </p>
          </div>
        </section>

        <section className="py-12 sm:py-16 bg-[#030303]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {brands.map((brand) => (
                <div
                  key={brand.name}
                  className="group bg-[#0d0d0d] border border-white/[0.06] rounded-2xl p-6 flex flex-col items-center gap-4 hover:border-lime-500/20 hover:bg-white/[0.02] transition-all"
                >
                  <div className="w-14 h-14 flex items-center justify-center rounded-xl bg-lime-500/[0.08] border border-lime-500/10">
                    <i className={`${brand.icon} text-2xl text-lime-400`}></i>
                  </div>
                  <span className="text-sm font-semibold text-white">{brand.name}</span>
                  <button
                    onClick={() => navigate('/signup')}
                    className="text-xs font-semibold text-lime-400 hover:text-lime-300 transition-colors"
                  >
                    Buy Now <span aria-hidden="true">&rarr;</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-24 bg-gradient-to-b from-[#030303] to-[#051505] border-t border-white/[0.04] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_100%,rgba(132,204,22,0.04),transparent)] pointer-events-none" />
          <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center relative">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3">
              Create an account to start buying gift cards
            </h2>
            <p className="text-neutral-400 mb-8 max-w-lg mx-auto">
              Join CardXC for instant gift card purchases from 700+ brands worldwide.
            </p>
            <button
              onClick={() => navigate('/signup')}
              className="group px-8 py-4 bg-lime-500 text-black font-bold rounded-xl hover:bg-lime-400 transition-all shadow-glow-sm hover:shadow-glow hover:scale-[1.02] active:scale-[0.98] text-[15px]"
            >
              Create Free Account
              <i className="ri-arrow-right-line ml-2 group-hover:translate-x-1 transition-transform inline-block"></i>
            </button>
          </div>
        </section>
      </main>

      <Footer onOpenContact={() => setIsContactOpen(true)} />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </div>
  );
}
