const countries = [
  { name: 'US', flag: '🇺🇸' },
  { name: 'UK', flag: '🇬🇧' },
  { name: 'CA', flag: '🇨🇦' },
  { name: 'AU', flag: '🇦🇺' },
  { name: 'DE', flag: '🇩🇪' },
  { name: 'FR', flag: '🇫🇷' },
  { name: 'JP', flag: '🇯🇵' },
  { name: 'SG', flag: '🇸🇬' },
  { name: 'AE', flag: '🇦🇪' },
  { name: 'BR', flag: '🇧🇷' },
];

const cityDots = [
  { top: '28%', left: '22%' },  // New York
  { top: '32%', left: '18%' },  // LA
  { top: '35%', left: '46%' },  // London
  { top: '38%', left: '48%' },  // Paris
  { top: '40%', left: '52%' },  // Berlin
  { top: '30%', left: '72%' },  // Tokyo
  { top: '55%', left: '80%' },  // Sydney
  { top: '42%', left: '60%' },  // Dubai
  { top: '35%', left: '75%' },  // Singapore
  { top: '60%', left: '30%' },  // Sao Paulo
  { top: '25%', left: '20%' },  // Toronto
  { top: '50%', left: '50%' },  // Nairobi
];

export default function GlobalReach() {
  return (
    <section className="relative py-20 sm:py-28 overflow-hidden" style={{ background: '#0A0A0F' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#9966FF]/15 to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#9966FF]/20 bg-[#9966FF]/5 mb-6">
            <i className="ri-global-fill text-[#9966FF] text-sm" />
            <span className="text-xs font-semibold text-[#9966FF] uppercase tracking-wider">Global</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Send Cards Anywhere in the World
          </h2>
          <p className="text-neutral-400 max-w-xl mx-auto">
            Available in 50+ countries with support for multiple currencies and instant delivery.
          </p>
        </div>

        {/* World map with dots */}
        <div className="relative max-w-4xl mx-auto h-[300px] sm:h-[400px] mb-12 rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)' }}>
          {/* Simple world map outline using CSS */}
          <div className="absolute inset-0 opacity-10" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(153,102,255,0.2), transparent)' }} />

          {/* Animated city dots */}
          {cityDots.map((dot, i) => (
            <div
              key={i}
              className="absolute"
              style={{ top: dot.top, left: dot.left }}
            >
              <div
                className="w-3 h-3 rounded-full relative"
                style={{ background: '#0066FF', boxShadow: '0 0 10px rgba(0,102,255,0.5)' }}
              >
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: '#0066FF',
                    animation: `cityPulse ${2 + i * 0.3}s ease-in-out infinite`,
                  }}
                />
              </div>
            </div>
          ))}

          {/* Connection lines */}
          <svg className="absolute inset-0 w-full h-full opacity-10">
            <line x1="22%" y1="28%" x2="46%" y2="35%" stroke="#0066FF" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="46%" y1="35%" x2="72%" y2="30%" stroke="#0066FF" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="22%" y1="28%" x2="30%" y2="60%" stroke="#0066FF" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="48%" y1="38%" x2="60%" y2="42%" stroke="#0066FF" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="72%" y1="30%" x2="80%" y2="55%" stroke="#0066FF" strokeWidth="1" strokeDasharray="4 4" />
          </svg>
        </div>

        {/* Country flags */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          {countries.map((country, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 hover:scale-105"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span className="text-xl">{country.flag}</span>
              <span className="text-neutral-300 text-sm font-medium">{country.name}</span>
            </div>
          ))}
          <div className="px-4 py-2.5 rounded-xl" style={{ background: 'rgba(0,102,255,0.1)', border: '1px solid rgba(0,102,255,0.2)' }}>
            <span className="text-[#0066FF] text-sm font-semibold">+40 more</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes cityPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </section>
  );
}
