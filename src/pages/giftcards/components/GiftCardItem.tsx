interface GiftCardBrand {
  id: string;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  denominations: number[];
  rate: number;
  category: 'top' | 'high-rate' | 'regular';
}

interface GiftCardItemProps {
  card: GiftCardBrand;
  onSelect: (card: GiftCardBrand) => void;
}

export default function GiftCardItem({ card, onSelect }: GiftCardItemProps) {
  return (
    <button
      onClick={() => onSelect(card)}
      className="group bg-dark-card rounded-2xl border border-dark-border p-4 hover:border-cream-300/30 hover:shadow-lg transition-all duration-300 text-left cursor-pointer"
    >
      <div className="flex flex-col gap-3">
        <div 
          className="w-14 h-14 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
          style={{ backgroundColor: card.bgColor }}
        >
          <i className={`${card.icon} text-2xl`} style={{ color: card.color }}></i>
        </div>
        
        <div>
          <h3 className="font-semibold text-white text-sm mb-1">{card.name}</h3>
          <div className="flex items-center gap-1 text-xs text-neutral-400">
            <span className="text-success-400 font-medium">{card.rate}%</span>
            <span>rate</span>
          </div>
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
