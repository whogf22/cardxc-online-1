import { useState } from 'react';

const brands = [
  { name: 'Amazon', domain: 'amazon.com', icon: 'ri-amazon-fill' },
  { name: 'Netflix', domain: 'netflix.com', icon: 'ri-netflix-fill' },
  { name: 'Spotify', domain: 'spotify.com', icon: 'ri-spotify-fill' },
  { name: 'Apple', domain: 'apple.com', icon: 'ri-apple-fill' },
  { name: 'Google Play', domain: 'play.google.com', icon: 'ri-google-play-fill' },
  { name: 'Steam', domain: 'store.steampowered.com', icon: 'ri-steam-fill' },
  { name: 'Starbucks', domain: 'starbucks.com', icon: 'ri-cup-line' },
  { name: 'Xbox', domain: 'xbox.com', icon: 'ri-gamepad-line' },
];

const flipMessages: { icon: string; text: string }[] = [
  { icon: 'ri-gift-2-line', text: 'Gift cards' },
  { icon: 'ri-star-smile-line', text: 'Surprise!' },
  { icon: 'ri-sparkling-line', text: '700+ brands' },
  { icon: 'ri-heart-line', text: 'Perfect gift' },
  { icon: 'ri-flashlight-fill', text: 'Instant' },
  { icon: 'ri-shopping-bag-line', text: 'Shop now' },
  { icon: 'ri-vip-crown-line', text: 'Premium' },
  { icon: 'ri-coupon-3-line', text: 'Best rates' },
  { icon: 'ri-smartphone-line', text: 'Digital' },
  { icon: 'ri-secure-payment-line', text: 'Secure' },
  { icon: 'ri-emotion-happy-line', text: 'Happy!' },
  { icon: 'ri-gift-line', text: 'Send love' },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function BrandItem({ brand }: { brand: (typeof brands)[0] }) {
  const [pressed, setPressed] = useState(false);
  const [flipContent, setFlipContent] = useState(flipMessages[0]);

  const handleClick = () => {
    setFlipContent(pickRandom(flipMessages));
    setPressed(true);
    setTimeout(() => setPressed(false), 2500);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="brand-flip-btn group relative shrink-0 w-[140px] h-[72px] rounded-2xl overflow-hidden"
    >
      <div className={`brand-flip-inner relative w-full h-full ${pressed ? 'brand-flipped' : ''}`}>
        <div className="brand-flip-front absolute inset-0 flex items-center gap-3 py-3 px-5 rounded-2xl bg-[#0d0d0d] border border-white/[0.06] hover:border-white/[0.1] group/card">
          <div className="brand-logo-wrap w-10 h-10 flex items-center justify-center rounded-xl bg-lime-500/[0.08] border border-lime-500/10 overflow-hidden group-hover/card:animate-cartoon-bounce">
            <i className={`${brand.icon} text-xl text-lime-400`}></i>
          </div>
          <span className="text-sm font-semibold text-white whitespace-nowrap">{brand.name}</span>
        </div>
        <div className="brand-flip-back absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-2xl bg-[#0d0d0d] border border-lime-500/20">
          <i className="ri-gift-2-line text-2xl text-lime-400"></i>
          <span className="font-bold text-xs text-lime-400">{flipContent.text}</span>
        </div>
      </div>
    </button>
  );
}

export default function BrandsStrip() {
  const duplicated = [...brands, ...brands];

  return (
    <section aria-label="Popular gift card brands" className="relative py-12 sm:py-16 bg-[#030303] border-y border-white/[0.04] overflow-hidden w-full">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 w-full">
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-lime-500/[0.08] rounded-full border border-lime-500/20">
            <span className="text-lime-400 text-xs font-semibold uppercase tracking-wider">Popular gift card brands</span>
          </div>
        </div>
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-24 sm:w-32 bg-gradient-to-r from-[#030303] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 sm:w-32 bg-gradient-to-l from-[#030303] to-transparent z-10 pointer-events-none" />
          <div className="flex animate-marquee gap-5 sm:gap-6 items-center py-2">
            {duplicated.map((brand, i) => (
              <BrandItem key={i} brand={brand} />
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 35s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
        @keyframes cartoonBounce {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.15); }
          50% { transform: scale(0.95); }
          75% { transform: scale(1.08); }
        }
        @keyframes cartoonWiggle {
          0%, 100% { transform: rotate(0deg) scale(1.06); }
          25% { transform: rotate(-4deg) scale(1.08); }
          75% { transform: rotate(4deg) scale(1.08); }
        }
        @keyframes cartoonPop {
          0% { transform: scale(1); }
          40% { transform: scale(1.1); }
          70% { transform: scale(0.98); }
          100% { transform: scale(1.05); }
        }
        .animate-cartoon-bounce {
          animation: cartoonBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .brand-flip-btn {
          perspective: 400px;
          transition: box-shadow 0.3s ease;
        }
        .brand-flip-btn:hover:not(:has(.brand-flipped)) {
          animation: cartoonWiggle 0.6s ease-in-out infinite;
        }
        .brand-flip-btn:hover:not(:has(.brand-flipped)) .brand-flip-inner {
          animation: cartoonPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .brand-flip-inner {
          transform-style: preserve-3d;
          transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .brand-flip-inner.brand-flipped {
          transform: rotateY(180deg);
        }
        .brand-flip-front,
        .brand-flip-back {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .brand-flip-back {
          transform: rotateY(180deg);
        }
        .brand-flip-btn:hover {
          box-shadow: 0 0 24px rgba(132, 204, 22, 0.12);
        }
      `}</style>
    </section>
  );
}
