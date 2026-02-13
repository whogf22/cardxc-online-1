import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import HeroSection from './components/HeroSection';
import FeaturesSection from './components/FeaturesSection';
import TrustSection from './components/TrustSection';
import StatsSection from './components/StatsSection';
import HowItWorksSection from './components/HowItWorksSection';
import ValuesSection from './components/ValuesSection';
import RatesSection from './components/RatesSection';
import CalculatorSection from './components/CalculatorSection';
import AppExperienceSection from './components/AppExperienceSection';
import SupportSection from './components/SupportSection';
import FAQSection from './components/FAQSection';
import Footer from './components/Footer';
import ContactModal from './components/ContactModal';

export default function HomePage() {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const sessionExpired = searchParams.get('session') === 'expired';

  const handleSignInAgain = () => {
    searchParams.delete('session');
    setSearchParams(searchParams);
    navigate('/signin');
  };

  return (
    <div className="min-h-screen bg-[#030303]">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#030303]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-3 group"
            >
              <div className="w-9 h-9 bg-lime-500 rounded-lg flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-shadow">
                <i className="ri-wallet-3-line text-lg text-black font-bold"></i>
              </div>
              <span className="text-lg font-bold text-white tracking-tight">CardXC</span>
            </button>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-[13px] text-neutral-400 hover:text-lime-400 transition-colors">Features</a>
              <a href="#how-it-works" className="text-[13px] text-neutral-400 hover:text-lime-400 transition-colors">How It Works</a>
              <a href="#rates" className="text-[13px] text-neutral-400 hover:text-lime-400 transition-colors">Rates</a>
              <a href="#values" className="text-[13px] text-neutral-400 hover:text-lime-400 transition-colors">About</a>
              <button onClick={() => setIsContactOpen(true)} className="text-[13px] text-neutral-400 hover:text-lime-400 transition-colors">Contact</button>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={() => navigate('/signin')}
                className="px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="px-5 py-2 text-sm font-semibold text-black bg-lime-500 rounded-lg hover:bg-lime-400 transition-all shadow-glow-sm hover:shadow-glow"
              >
                Get Started
              </button>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.08]"
            >
              <i className={`text-xl text-white ${mobileMenuOpen ? 'ri-close-line' : 'ri-menu-line'}`}></i>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/[0.06] bg-[#0d0d0d]/95 backdrop-blur-xl">
            <div className="px-6 py-4 space-y-1">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-neutral-300 hover:text-lime-400 transition-colors">Features</a>
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-neutral-300 hover:text-lime-400 transition-colors">How It Works</a>
              <a href="#rates" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-neutral-300 hover:text-lime-400 transition-colors">Rates</a>
              <a href="#values" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-neutral-300 hover:text-lime-400 transition-colors">About</a>
              <button onClick={() => { setIsContactOpen(true); setMobileMenuOpen(false); }} className="block w-full text-left py-3 text-neutral-300 hover:text-lime-400 transition-colors">Contact</button>
              <div className="pt-4 space-y-2 border-t border-white/[0.06]">
                <button onClick={() => { navigate('/signin'); setMobileMenuOpen(false); }} className="w-full py-3 text-center text-neutral-300 bg-white/[0.04] rounded-lg border border-white/[0.08]">Sign In</button>
                <button onClick={() => { navigate('/signup'); setMobileMenuOpen(false); }} className="w-full py-3 text-center font-semibold text-black bg-lime-500 rounded-lg">Get Started</button>
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

      <main className="pt-16">
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <ValuesSection />
        <HowItWorksSection />
        <RatesSection />
        <CalculatorSection />
        <TrustSection />
        <AppExperienceSection />
        <SupportSection />
        <FAQSection />
      </main>

      <Footer onOpenContact={() => setIsContactOpen(true)} />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </div>
  );
}
