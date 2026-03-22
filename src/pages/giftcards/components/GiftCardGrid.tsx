import GiftCardItem, { GiftCardBrand } from './GiftCardItem';

interface GiftCardGridProps {
  cards: GiftCardBrand[];
  onSelectCard: (card: GiftCardBrand) => void;
  emptyMessage?: string;
}

export default function GiftCardGrid({ cards, onSelectCard, emptyMessage = "No cards available" }: GiftCardGridProps) {
  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-dark-elevated flex items-center justify-center mb-4">
          <i className="ri-gift-line text-2xl text-neutral-500"></i>
        </div>
        <p className="text-neutral-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4 w-full min-w-0">
      {cards.map((card) => (
        <GiftCardItem key={card.id} card={card} onSelect={onSelectCard} />
      ))}
    </div>
  );
}
