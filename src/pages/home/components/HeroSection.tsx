import { useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';

export default function HeroSection() {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    let animFrame: number;
    let angle = 0;
    const animate = () => {
      angle += 0.3;
      const rotY = Math.sin(angle * Math.PI / 180) * 15;
      const rotX = Math.cos(angle * Math.PI / 180) * 5;
      card.style.transform = `perspective(1000px) rotateY(${rotY}deg) rotateX(${rotX}deg)`;
      animFrame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animFrame);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden w-full" style={{ background: '#0A0A0F' }}>
      {/* Ambient glow orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full blur-[150px] opacity-30" style={{ background: 'radial-gradient(circle, #0066FF, transparent)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full blur-[130px] opacity-20" style={{ background: 'radial-gradient(circle, #FFD700, transparent)' }} />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#0066FF]/30 to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Left: Text Content */}
          <div className="flex-1 space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#0066FF]/30 bg-[#0066FF]/10">
              <div className="w-2 h-2 bg-[#0066FF] rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-[#0066FF] uppercase tracking-wider">Next-Gen Gift Cards</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.08] tracking-tight" style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
              Give More
              <br />
              Than a{' '}
              <span className="bg-gradient-to-r from-[#FFD700] via-[#FFA500] to-[#FFD700] bg-clip-text text-transparent">Gift.</span>
            </h1>

            <p className="text-base sm:text-lg text-neutral-400 max-w-lg leading-relaxed">
              Instant digital cards. Premium design. Send in seconds. The future of gifting starts here.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
              <button
                onClick={() => navigate('/signup')}
                className="group px-8 py-4 font-bold rounded-xl text-[15px] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                  color: '#0A0A0F',
                  boxShadow: '0 0 30px rgba(255,215,0,0.3)',
                }}
              >
                Get Started Free
                <i className="ri-arrow-right-line ml-2 group-hover:translate-x-1 transition-transform inline-block" />
              </button>
              <button
                onClick={() => {
                  document.getElementById('card-showcase')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-8 py-4 font-semibold rounded-xl text-[15px] text-white border transition-all duration-300 hover:bg-white/[0.05]"
                style={{
                  borderColor: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(20px)',
                  background: 'rgba(255,255,255,0.03)',
                }}
              >
                Explore Cards
              </button>
            </div>
          </div>

          {/* Right: 3D Rotating Gift Card */}
          <div className="flex-1 flex items-center justify-center">
            <div className="relative" style={{ perspective: '1200px' }}>
              {/* Glow behind card */}
              <div className="absolute inset-0 blur-[60px] opacity-40" style={{ background: 'radial-gradient(circle, #0066FF, transparent)' }} />

              <div
                ref={cardRef}
                className="relative w-[320px] h-[200px] sm:w-[400px] sm:h-[250px] rounded-2xl overflow-hidden cursor-pointer"
                style={{
                  transformStyle: 'preserve-3d',
                  boxShadow: '0 25px 60px rgba(0,102,255,0.3), 0 0 100px rgba(255,215,0,0.1)',
                }}
              >
                {/* Card face */}
                <div
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    background: 'linear-gradient(135deg, #0A0A2E 0%, #1a1a4e 30%, #0066FF 70%, #003399 100%)',
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}
                />

                {/* Holographic shimmer overlay */}
                <div
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    background: 'linear-gradient(105deg, transparent 20%, rgba(255,215,0,0.15) 35%, rgba(0,102,255,0.2) 50%, rgba(255,215,0,0.1) 65%, transparent 80%)',
                    animation: 'heroShimmer 3s ease-in-out infinite',
                  }}
                />

                {/* Card content */}
                <div className="relative z-10 p-6 sm:p-8 h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,215,0,0.2)', border: '1px solid rgba(255,215,0,0.3)' }}>
                        <i className="ri-wallet-3-fill text-[#FFD700] text-sm" />
                      </div>
                      <span className="text-white font-bold text-lg tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>CardXC</span>
                    </div>
                    <i className="ri-visa-fill text-white/40 text-3xl" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-10 h-7 rounded" style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }} />
                      <div className="w-6 h-6 rounded-full border-2 border-white/20" />
                    </div>
                    <div className="text-white/60 text-xs tracking-[0.3em] font-mono">•••• •••• •••• 4829</div>
                  </div>
                </div>

                {/* Gloss effect */}
                <div
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 50%)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes heroShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </section>
  );
}
