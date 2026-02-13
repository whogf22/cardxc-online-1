import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function StickyCTA() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 px-4 py-3 bg-dark-card/95 backdrop-blur-xl border-t border-dark-border safe-area-inset-bottom lg:hidden">
      <div className="max-w-lg mx-auto flex items-center justify-center gap-4">
        <button
          onClick={() => navigate('/signup')}
          className="flex-1 py-3.5 px-6 font-semibold rounded-xl bg-lime-500 text-black shadow-glow-sm hover:shadow-glow active:scale-[0.98] transition-all"
        >
          Get Started
        </button>
        <button
          onClick={() => navigate('/signin')}
          className="py-3.5 px-6 font-semibold rounded-xl border border-dark-border text-white hover:bg-dark-elevated transition-colors"
        >
          Sign In
        </button>
      </div>
    </div>
  );
}
