import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const cards = [
  { name: 'Birthday', gradient: 'linear-gradient(135deg, #FF6B6B, #FF8E53)', icon: 'ri-cake-2-fill', amount: '$25 - $500' },
  { name: 'Shopping', gradient: 'linear-gradient(135deg, #0066FF, #00AAFF)', icon: 'ri-shopping-bag-3-fill', amount: '$10 - $1000' },
  { name: 'Crypto', gradient: 'linear-gradient(135deg, #FFD700, #FF8C00)', icon: 'ri-bitcoin-fill', amount: '$50 - $5000' },
  { name: 'Gaming', gradient: 'linear-gradient(135deg, #9966FF, #CC33FF)', icon: 'ri-gamepad-fill', amount: '$10 - $200' },
  { name: 'Travel', gradient: 'linear-gradient(135deg, #00CC88, #00FFAA)', icon: 'ri-plane-fill', amount: '$100 - $2000' },
  { name: 'Business', gradient: 'linear-gradient(135deg, #333366, #667799)', icon: 'ri-briefcase-4-fill', amount: '$50 - $10000' },
];

function Card3D({ card }: { card: typeof cards[0] }) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -10;
    const rotateY = ((x - centerX) / centerX) * 10;
    el.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
  };

  const handleMouseLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale(1)';
  };

  return (
    <div
      ref={cardRef}
      className="flex-shrink-0 w-[260px] sm:w-[280px] h-[170px] sm:h-[180px] rounded-2xl overflow-hidden cursor-pointer relative"
      style={{
        background: card.gradient,
        transition: 'transform 0.15s ease-out',
        boxShadow: '0 15px 40px rgba(0,0,0,0.4)',
        transformStyle: 'preserve-3d',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Holographic shine */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)',
          animation: 'cardShine 4s ease-in-out infinite',
        }}
      />

      {/* Card content */}
      <div className="relative z-10 p-5 h-full flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <i className="ri-wallet-3-fill text-white text-sm" />
            </div>
            <span className="text-white/80 text-xs font-bold tracking-wider">CardXC</span>
          </div>
          <i className={`${card.icon} text-white/60 text-2xl`} />
        </div>
        <div>
          <div className="text-white font-bold text-lg mb-0.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{card.name}</div>
          <div className="text-white/60 text-xs">{card.amount}</div>
        </div>
      </div>

      {/* Denomination badge */}
      <div className="absolute top-4 right-4 px-2 py-1 rounded-md bg-black/30 backdrop-blur-sm">
        <span className="text-white text-[10px] font-bold">GIFT CARD</span>
      </div>

      {/* Embossed logo area */}
      <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
        <i className={`${card.icon} text-white/40 text-sm`} />
      </div>
    </div>
  );
}

export default function CardShowcase() {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <section id="card-showcase" className="relative py-20 sm:py-28 overflow-hidden" style={{ background: '#0A0A0F' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full blur-[200px] opacity-10" style={{ background: '#0066FF' }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#FFD700]/20 bg-[#FFD700]/5 mb-6">
            <span className="text-xs font-semibold text-[#FFD700] uppercase tracking-wider">Card Store</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Premium Card Collection
          </h2>
          <p className="text-neutral-400 max-w-xl mx-auto">
            Choose from beautifully designed gift cards for every occasion. Hover to interact.
          </p>
        </div>

        {/* Horizontal scroll carousel */}
        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto pb-6 scrollbar-hide snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {cards.map((card, i) => (
            <div key={i} className="snap-center">
              <Card3D card={card} />
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <button
            onClick={() => navigate('/giftcards')}
            className="px-8 py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, #0066FF, #0044CC)',
              color: 'white',
              boxShadow: '0 0 30px rgba(0,102,255,0.2)',
            }}
          >
            Browse All Cards
            <i className="ri-arrow-right-line ml-2" />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes cardShine {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </section>
  );
}
