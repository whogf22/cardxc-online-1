import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import HeroSection from './components/HeroSection';
import FeaturesSection from './components/FeaturesSection';
import TestimonialsSection from './components/TestimonialsSection';
import TrustSection from './components/TrustSection';
import StatsSection from './components/StatsSection';
import AboutSection from './components/AboutSection';
import CustomerServiceSection from './components/CustomerServiceSection';
import ValuesSection from './components/ValuesSection';
import HowItWorksSection from './components/HowItWorksSection';
import AppExperienceSection from './components/AppExperienceSection';
import SupportSection from './components/SupportSection';
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
    <div className="min-h-screen bg-dark-bg" key="home-v150">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-bg/95 backdrop-blur-xl border-b border-dark-border safe-area-inset-top">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="flex items-center justify-between h-20 sm:h-24">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-3 sm:gap-4 group touch-target-lg"
              aria-label="CardXC Home"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-cream-300 to-cream-500 rounded-xl flex items-center justify-center shadow-glow-sm group-hover:shadow-glow group-hover:scale-105 transition-all duration-300">
                <i className="ri-wallet-3-line text-xl sm:text-2xl text-dark-bg"></i>
              </div>
              <span className="text-xl sm:text-2xl font-bold text-white">
                CardXC
              </span>
            </button>

            <div className="hidden lg:flex items-center gap-2">
              {[
                { label: 'Features', href: '#features' },
                { label: 'About', href: '#about' }
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="nav-link-neon px-5 py-3 text-base font-medium text-neutral-400 hover:text-white hover:bg-dark-hover rounded-xl transition-all duration-300 touch-target"
                >
                  {item.label}
                </a>
              ))}
            </div>

            <div className="hidden lg:flex items-center gap-4">
              <button
                onClick={() => navigate('/signin')}
                className="px-6 py-3 text-base font-semibold text-neutral-300 hover:text-white hover:bg-dark-hover rounded-xl transition-all duration-300 touch-target"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="px-8 py-4 text-base font-semibold text-dark-bg bg-gradient-to-r from-cream-300 to-cream-400 rounded-xl shadow-glow-sm hover:shadow-glow hover:scale-105 active:scale-100 transition-all duration-300 touch-target-lg"
              >
                Get Started
              </button>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden w-12 h-12 flex items-center justify-center rounded-xl bg-dark-elevated hover:bg-dark-hover active:bg-dark-border transition-colors touch-target"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              <i className={`text-2xl text-neutral-300 transition-transform duration-300 ${mobileMenuOpen ? 'ri-close-line rotate-90' : 'ri-menu-line'}`}></i>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-dark-border bg-dark-card shadow-dark-elevated safe-area-inset-bottom">
            <div className="px-6 py-6 space-y-2">
              {[
                { label: 'Features', href: '#features', icon: 'star-line' },
                { label: 'About', href: '#about', icon: 'information-line' }
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="nav-link-mobile-glow flex items-center gap-4 px-5 py-4 text-base font-semibold text-neutral-300 hover:text-white hover:bg-dark-hover rounded-xl transition-all duration-300 touch-target-lg"
                >
                  <i className={`ri-${item.icon} text-xl text-cream-300`}></i>
                  {item.label}
                </a>
              ))}
              
              <div className="pt-4 space-y-3 border-t border-dark-border">
                <button
                  onClick={() => {
                    navigate('/signin');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 text-base font-semibold text-neutral-300 bg-dark-elevated hover:bg-dark-hover rounded-xl transition-all duration-300 touch-target-lg"
                >
                  <i className="ri-login-box-line text-xl"></i>
                  Sign In
                </button>
                <button
                  onClick={() => {
                    navigate('/signup');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-3 px-6 py-5 text-base font-semibold text-dark-bg bg-gradient-to-r from-cream-300 to-cream-400 rounded-xl shadow-glow-sm hover:shadow-glow hover:scale-[1.02] active:scale-100 transition-all duration-300 touch-target-lg"
                >
                  <i className="ri-user-add-line text-xl"></i>
                  Get Started Free
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {sessionExpired && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-6">
          <div className="w-full sm:max-w-md dark-card rounded-t-3xl sm:rounded-3xl overflow-hidden animate-slide-up">
            <div className="bg-dark-elevated px-6 sm:px-8 py-6 sm:py-8 border-b border-dark-border">
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-2xl bg-cream-300/10">
                  <i className="ri-time-line text-2xl sm:text-3xl text-cream-300"></i>
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white">Session Expired</h3>
                  <p className="text-sm sm:text-base text-neutral-400 mt-1">Please sign in again to continue</p>
                </div>
              </div>
            </div>

            <div className="px-6 sm:px-8 py-6 sm:py-8 space-y-6">
              <p className="text-base sm:text-lg text-neutral-400 leading-relaxed">
                Your session has expired for security reasons. Please sign in again to access your account.
              </p>

              <button
                onClick={handleSignInAgain}
                className="btn-primary w-full group"
              >
                <span className="flex items-center justify-center gap-3">
                  <i className="ri-login-box-line text-xl"></i>
                  Sign In Again
                  <i className="ri-arrow-right-line text-xl group-hover:translate-x-1 transition-transform"></i>
                </span>
              </button>
            </div>

            <div className="h-safe-area-inset-bottom sm:hidden"></div>
          </div>
        </div>
      )}

      <main className="pt-20">
        <HeroSection />
        <FeaturesSection />
        <StatsSection />
        <AboutSection />
        <ValuesSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <TrustSection />
        <SupportSection />
        <AppExperienceSection />
        <CustomerServiceSection />
      </main>

      <Footer />
      
      <ContactModal 
        isOpen={isContactOpen} 
        onClose={() => setIsContactOpen(false)} 
      />
    </div>
  );
}
