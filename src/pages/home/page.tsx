import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import HeroSection from './components/HeroSection';
import BrandsStrip from './components/BrandsStrip';
import StatsSection from './components/StatsSection';
import FeaturesSection from './components/FeaturesSection';
import CardShowcase from './components/CardShowcase';
import HowItWorksSection from './components/HowItWorksSection';
import DashboardPreview from './components/DashboardPreview';
import PricingSection from './components/PricingSection';
import SecuritySection from './components/SecuritySection';
import GlobalReach from './components/GlobalReach';
import Footer from './components/Footer';
import ContactModal from './components/ContactModal';

export default function HomePage() {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const sessionExpired = searchParams.get('session') === 'expired';

  useEffect(() => {
    document.title = 'CardXC | Premium Digital Gift Cards — Send in Seconds';
  }, []);

  const handleSignInAgain = () => {
    searchParams.delete('session');
    setSearchParams(searchParams);
    navigate('/signin');
  };

  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-hidden" style={{ background: '#0A0A0F' }}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[#0066FF] focus:text-white focus:rounded-lg focus:font-semibold"
      >
        Skip to main content
      </a>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 safe-top transition-all duration-300" style={{ background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <button onClick={() => navigate('/')} className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200" style={{ background: 'linear-gradient(135deg, #0066FF, #0044CC)' }}>
                <i className="ri-wallet-3-line text-lg text-white font-bold" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>CardXC</span>
            </button>

            <div className="hidden md:flex items-center gap-0.5">
              <button onClick={() => navigate('/giftcards')} className="px-4 py-2 text-[13px] font-medium text-neutral-400 hover:text-[#0066FF] rounded-lg transition-colors">
                Gift Cards
              </button>
              <a href="#features" className="px-4 py-2 text-[13px] font-medium text-neutral-400 hover:text-[#0066FF] rounded-lg transition-colors">
                Features
              </a>
              <Link to="/how-it-works" className="px-4 py-2 text-[13px] font-medium text-neutral-400 hover:text-[#0066FF] rounded-lg transition-colors">
                How It Works
              </Link>
              <a href="#pricing" className="px-4 py-2 text-[13px] font-medium text-neutral-400 hover:text-[#0066FF] rounded-lg transition-colors">
                Pricing
              </a>
              <button onClick={() => setIsContactOpen(true)} className="px-4 py-2 text-[13px] font-medium text-neutral-400 hover:text-[#0066FF] rounded-lg transition-colors">
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
                className="px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#0A0A0F', boxShadow: '0 0 20px rgba(255,215,0,0.2)' }}
              >
                Get Started
              </button>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              <i className={`text-xl text-white ${mobileMenuOpen ? 'ri-close-line' : 'ri-menu-line'}`} />
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden" style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(10,10,15,0.98)', backdropFilter: 'blur(20px)' }}>
            <div className="px-4 py-4 space-y-0.5">
              <button onClick={() => { navigate('/giftcards'); setMobileMenuOpen(false); }} className="flex items-center gap-3 w-full text-left py-3.5 px-4 rounded-lg text-neutral-300 hover:text-[#0066FF] hover:bg-white/[0.04] transition-colors">
                <i className="ri-gift-2-line text-lg text-neutral-500" />
                <span className="font-medium">Gift Cards</span>
              </button>
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 w-full py-3.5 px-4 rounded-lg text-neutral-300 hover:text-[#0066FF] hover:bg-white/[0.04] transition-colors">
                <i className="ri-apps-line text-lg text-neutral-500" />
                <span className="font-medium">Features</span>
              </a>
              <Link to="/how-it-works" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 w-full py-3.5 px-4 rounded-lg text-neutral-300 hover:text-[#0066FF] hover:bg-white/[0.04] transition-colors">
                <i className="ri-question-line text-lg text-neutral-500" />
                <span className="font-medium">How It Works</span>
              </Link>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 w-full py-3.5 px-4 rounded-lg text-neutral-300 hover:text-[#0066FF] hover:bg-white/[0.04] transition-colors">
                <i className="ri-price-tag-3-line text-lg text-neutral-500" />
                <span className="font-medium">Pricing</span>
              </a>
              <button onClick={() => { setIsContactOpen(true); setMobileMenuOpen(false); }} className="flex items-center gap-3 w-full text-left py-3.5 px-4 rounded-lg text-neutral-300 hover:text-[#0066FF] hover:bg-white/[0.04] transition-colors">
                <i className="ri-customer-service-2-line text-lg text-neutral-500" />
                <span className="font-medium">Contact</span>
              </button>
              <div className="pt-4 mt-2 flex gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button onClick={() => { navigate('/signin'); setMobileMenuOpen(false); }} className="flex-1 py-3 text-center text-sm font-medium text-neutral-300 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  Sign In
                </button>
                <button onClick={() => { navigate('/signup'); setMobileMenuOpen(false); }} className="flex-1 py-3 text-center text-sm font-semibold rounded-lg" style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#0A0A0F' }}>
                  Get Started
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {sessionExpired && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="w-full max-w-md rounded-2xl p-8" style={{ background: '#0d0d15', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 flex items-center justify-center rounded-xl" style={{ background: 'rgba(255,165,0,0.1)' }}>
                <i className="ri-time-line text-2xl text-amber-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Session Expired</h3>
                <p className="text-sm text-neutral-400">Please sign in again</p>
              </div>
            </div>
            <button onClick={handleSignInAgain} className="w-full py-3 font-semibold rounded-xl transition-colors" style={{ background: 'linear-gradient(135deg, #0066FF, #0044CC)', color: 'white' }}>
              Sign In Again
            </button>
          </div>
        </div>
      )}

      <main className="pt-14 sm:pt-16 w-full min-w-0" id="main-content">
        <HeroSection />
        <BrandsStrip />
        <StatsSection />
        <FeaturesSection />
        <CardShowcase />
        <HowItWorksSection />
        <DashboardPreview />
        <PricingSection />
        <SecuritySection />
        <GlobalReach />

        {/* CTA Section */}
        <section className="py-16 sm:py-24 relative overflow-hidden" style={{ background: '#0A0A0F', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_100%,rgba(0,102,255,0.06),transparent)] pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center relative">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Ready to get started?</h2>
            <p className="text-neutral-400 mb-8 max-w-lg mx-auto">Join CardXC and start sending premium digital gift cards today. Fast, secure, and beautifully designed.</p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <button
                onClick={() => navigate('/signup')}
                className="group px-8 py-4 font-bold rounded-xl text-[15px] transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#0A0A0F', boxShadow: '0 0 30px rgba(255,215,0,0.2)' }}
              >
                Create Free Account
                <i className="ri-arrow-right-line ml-2 group-hover:translate-x-1 transition-transform inline-block" />
              </button>
              <Link
                to="/how-it-works"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 font-semibold rounded-xl text-[15px] text-white transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                See How It Works
                <i className="ri-arrow-right-line text-lg" />
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
