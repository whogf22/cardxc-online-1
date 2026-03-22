import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import HowItWorksSection from '../home/components/HowItWorksSection';
import Footer from '../home/components/Footer';
import ContactModal from '../home/components/ContactModal';
import { useState } from 'react';

export default function HowItWorksPage() {
  const navigate = useNavigate();
  const [isContactOpen, setIsContactOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'How It Works | CardXC';
  }, []);

  return (
    <div className="min-h-screen bg-[#030303] w-full min-w-0 overflow-x-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#030303]/80 backdrop-blur-xl border-b border-white/[0.06] safe-top">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 w-full">
          <div className="flex items-center justify-between h-16">
            <button onClick={() => navigate('/')} className="flex items-center gap-3 group">
              <div className="w-9 h-9 bg-lime-500 rounded-lg flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-shadow">
                <i className="ri-wallet-3-line text-lg text-black font-bold"></i>
              </div>
              <span className="text-lg font-bold text-white tracking-tight">CardXC</span>
            </button>

            <div className="hidden md:flex items-center gap-8">
              <button onClick={() => navigate('/giftcards')} className="text-[13px] text-neutral-400 hover:text-lime-400 transition-colors">Gift Cards</button>
              <a href="/#features" className="text-[13px] text-neutral-400 hover:text-lime-400 transition-colors">Features</a>
              <Link to="/how-it-works" className="text-[13px] text-lime-400 font-medium">How It Works</Link>
              <a href="/#values" className="text-[13px] text-neutral-400 hover:text-lime-400 transition-colors">About</a>
              <button onClick={() => setIsContactOpen(true)} className="text-[13px] text-neutral-400 hover:text-lime-400 transition-colors">Contact</button>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <button onClick={() => navigate('/signin')} className="px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white transition-colors">Sign In</button>
              <button onClick={() => navigate('/signup')} className="px-5 py-2 text-sm font-semibold text-black bg-lime-500 rounded-lg hover:bg-lime-400 transition-all shadow-glow-sm hover:shadow-glow">Get Started</button>
            </div>

            <Link to="/" className="md:hidden flex items-center gap-2 text-neutral-400 hover:text-lime-400 transition-colors">
              <i className="ri-arrow-left-line"></i>
              <span className="text-sm">Back</span>
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-16 w-full min-w-0">
        <HowItWorksSection />
      </main>

      <Footer onOpenContact={() => setIsContactOpen(true)} />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </div>
  );
}
