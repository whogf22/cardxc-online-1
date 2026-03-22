interface GiftCardBrand {
  id: string;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  logoUrl?: string;
  logoUrlFallback?: string;
  denominations: number[];
  rate: number;
  category: 'top' | 'high-rate' | 'regular';
}

interface GiftCardItemProps {
  card: GiftCardBrand;
  onSelect: (card: GiftCardBrand) => void;
}

export default function GiftCardItem({ card, onSelect }: GiftCardItemProps) {
  const logoSrc = card.logoUrl || card.logoUrlFallback;
  const hasLogo = !!(card.logoUrl || card.logoUrlFallback);

  return (
    <button
      onClick={() => onSelect(card)}
      className="group bg-dark-card rounded-2xl border border-dark-border overflow-hidden hover:border-lime-400/30 hover:shadow-lg transition-all duration-300 text-left cursor-pointer w-full min-w-0"
    >
      {/* Fluz-style: prominent logo area at top with light bg */}
      <div className="h-24 bg-white/10 flex items-center justify-center p-4 transition-transform group-hover:scale-[1.02]">
        {hasLogo ? (
          <>
            <img
              src={logoSrc}
              alt={`${card.name} logo`}
              loading="lazy"
              decoding="async"
              className="max-h-16 max-w-full w-auto object-contain"
              onError={(e) => {
                const img = e.currentTarget;
                img.onerror = null;
                if (card.logoUrlFallback && img.src !== card.logoUrlFallback) {
                  img.src = card.logoUrlFallback;
                } else {
                  img.style.display = 'none';
                  (img.nextElementSibling as HTMLElement)?.classList.remove('hidden');
                }
              }}
            />
            <i className={`${card.icon} text-3xl hidden`} style={{ color: card.color }}></i>
          </>
        ) : (
          <i className={`${card.icon} text-3xl`} style={{ color: card.color }}></i>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2">
        <h3 className="font-semibold text-white text-sm line-clamp-2">{card.name}</h3>
        <div className="flex items-center gap-1 text-xs text-neutral-400">
          <span className="text-success-400 font-medium">{card.rate}%</span>
          <span>rate</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {card.denominations.slice(0, 3).map((denom) => (
            <span
              key={denom}
              className="px-2 py-0.5 bg-dark-elevated text-neutral-300 text-[10px] rounded-full"
            >
              ${denom}
            </span>
          ))}
          {card.denominations.length > 3 && (
            <span className="px-2 py-0.5 bg-dark-elevated text-neutral-500 text-[10px] rounded-full">
              +{card.denominations.length - 3}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export type { GiftCardBrand };
