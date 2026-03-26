const brands = [
  { name: 'Amazon', icon: 'ri-amazon-fill' },
  { name: 'Netflix', icon: 'ri-netflix-fill' },
  { name: 'Spotify', icon: 'ri-spotify-fill' },
  { name: 'Apple', icon: 'ri-apple-fill' },
  { name: 'Google Play', icon: 'ri-google-play-fill' },
  { name: 'Steam', icon: 'ri-steam-fill' },
  { name: 'Starbucks', icon: 'ri-cup-fill' },
  { name: 'Xbox', icon: 'ri-xbox-fill' },
];

export default function BrandsStrip() {
  const duplicated = [...brands, ...brands];

  return (
    <section className="relative py-8 overflow-hidden" style={{ background: '#0A0A0F', borderTop: '1px solid rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <p className="text-center text-neutral-600 text-xs uppercase tracking-widest mb-6">Popular gift card brands</p>
      </div>
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#0A0A0F] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#0A0A0F] to-transparent z-10 pointer-events-none" />
        <div className="flex animate-marquee gap-6 items-center py-2">
          {duplicated.map((brand, i) => (
            <div
              key={i}
              className="flex-shrink-0 flex items-center gap-2.5 px-5 py-2.5 rounded-xl transition-all duration-300 hover:scale-105 cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <i className={`${brand.icon} text-lg text-neutral-500`} />
              <span className="text-neutral-400 text-sm font-medium whitespace-nowrap">{brand.name}</span>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </section>
  );
}
