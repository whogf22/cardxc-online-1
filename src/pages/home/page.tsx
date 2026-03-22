import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import HeroSection from './components/HeroSection';
import BrandsStrip from './components/BrandsStrip';
import FeaturesSection from './components/FeaturesSection';
import StatsSection from './components/StatsSection';
import Footer from './components/Footer';
import ContactModal from './components/ContactModal';

export default function HomePage() {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const sessionExpired = searchParams.get('session') === 'expired';

  useEffect(() => {
    document.title = 'CardXC | Send Money Worldwide & Buy Gift Cards';
  }, []);

  const handleSignInAgain = () => {
    searchParams.delete('session');
    setSearchParams(searchParams);
    navigate('/signin');
  };

  return (
    <div className="min-h-screen bg-[#030303] w-full min-w-0 overflow-x-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-lime-500 focus:text-black focus:rounded-lg focus:font-semibold"
      >
        Skip to main content
      </a>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#030303]/90 backdrop-blur-xl border-b border-white/[0.06] safe-top transition-all duration-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 w-full">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2.5 group"
            >
              <div className="w-9 h-9 bg-lime-500 rounded-lg flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-all duration-200">
                <i className="ri-wallet-3-line text-lg text-black font-bold"></i>
              </div>
              <span className="text-lg font-bold text-white tracking-tight">CardXC</span>
            </button>

            <div className="hidden md:flex items-center gap-0.5">
              <button
                onClick={() => navigate('/giftcards')}
                className="px-4 py-2 text-[13px] font-medium text-neutral-400 hover:text-lime-400 rounded-lg transition-colors"
              >
                Gift Cards
              </button>
              <a href="#features" className="px-4 py-2 text-[13px] font-medium text-neutral-400 hover:text-lime-400 rounded-lg transition-colors">
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
              <button
                onClick={() => navigate('/signin')}
                className="px-4 py-2.5 text-sm font-medium text-neutral-300 hover:text-white rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="px-5 py-2.5 text-sm font-semibold text-black bg-lime-500 rounded-lg hover:bg-lime-400 transition-all duration-200 shadow-glow-sm hover:shadow-glow hover:scale-[1.02] active:scale-[0.98]"
              >
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
              <button onClick={() => { navigate('/giftcards'); setMobileMenuOpen(false); }} className="flex items-center gap-3 w-full text-left py-3.5 px-4 rounded-lg text-neutral-300 hover:text-lime-400 hover:bg-white/[0.04] transition-colors">
                <i className="ri-gift-2-line text-lg text-neutral-500"></i>
                <span className="font-medium">Gift Cards</span>
              </button>
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 w-full py-3.5 px-4 rounded-lg text-neutral-300 hover:text-lime-400 hover:bg-white/[0.04] transition-colors">
                <i className="ri-apps-line text-lg text-neutral-500"></i>
                <span className="font-medium">Features</span>
              </a>
              <Link to="/how-it-works" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 w-full py-3.5 px-4 rounded-lg text-neutral-300 hover:text-lime-400 hover:bg-white/[0.04] transition-colors">
                <i className="ri-question-line text-lg text-neutral-500"></i>
                <span className="font-medium">How It Works</span>
              </Link>
              <button onClick={() => { setIsContactOpen(true); setMobileMenuOpen(false); }} className="flex items-center gap-3 w-full text-left py-3.5 px-4 rounded-lg text-neutral-300 hover:text-lime-400 hover:bg-white/[0.04] transition-colors">
                <i className="ri-customer-service-2-line text-lg text-neutral-500"></i>
                <span className="font-medium">Contact</span>
              </button>
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

      {sessionExpired && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="w-full max-w-md bg-[#0d0d0d] rounded-2xl p-8 border border-white/[0.08]">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-amber-500/10">
                <i className="ri-time-line text-2xl text-amber-400"></i>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Session Expired</h3>
                <p className="text-sm text-neutral-400">Please sign in again</p>
              </div>
            </div>
            <button onClick={handleSignInAgain} className="w-full py-3 bg-lime-500 text-black font-semibold rounded-xl hover:bg-lime-400 transition-colors">
              Sign In Again
            </button>
          </div>
        </div>
      )}

      <main className="pt-14 sm:pt-16 w-full min-w-0" id="main-content">
        <HeroSection />
        <BrandsStrip />
        <FeaturesSection />
        <StatsSection />
        <section className="py-16 sm:py-24 bg-gradient-to-b from-[#030303] to-[#051505] border-t border-white/[0.04] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_100%,rgba(132,204,22,0.04),transparent)] pointer-events-none" />
          <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center relative">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3">Ready to get started?</h2>
            <p className="text-neutral-400 mb-8 max-w-lg mx-auto">Join thousands who trust CardXC for global payments and gift cards. No hidden fees.</p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <button
                onClick={() => navigate('/signup')}
                className="group px-8 py-4 bg-lime-500 text-black font-bold rounded-xl hover:bg-lime-400 transition-all shadow-glow-sm hover:shadow-glow hover:scale-[1.02] active:scale-[0.98] text-[15px] hover:shadow-lime-glow"
              >
                Create Free Account
                <i className="ri-arrow-right-line ml-2 group-hover:translate-x-1 transition-transform inline-block"></i>
              </button>
              <Link
                to="/how-it-works"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/[0.04] text-white font-semibold rounded-xl border border-white/[0.08] hover:border-lime-500/30 hover:bg-white/[0.06] transition-all text-[15px]"
              >
                See How It Works
                <i className="ri-arrow-right-line text-lg"></i>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer onOpenContact={() => setIsContactOpen(true)} />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </div>
  );
}
