import { useState } from 'react';
import GiftCardGrid from './GiftCardGrid';
import PurchaseModal from './PurchaseModal';
import type { GiftCardBrand } from './GiftCardItem';

const giftCardBrands: GiftCardBrand[] = [
  { id: 'amazon', name: 'Amazon', icon: 'ri-amazon-fill', color: '#FF9900', bgColor: 'rgba(255, 153, 0, 0.15)', denominations: [25, 50, 100, 200, 500], rate: 85, category: 'top' },
  { id: 'apple', name: 'Apple/iTunes', icon: 'ri-apple-fill', color: '#A2AAAD', bgColor: 'rgba(162, 170, 173, 0.15)', denominations: [25, 50, 100, 200], rate: 82, category: 'top' },
  { id: 'google-play', name: 'Google Play', icon: 'ri-google-play-fill', color: '#34A853', bgColor: 'rgba(52, 168, 83, 0.15)', denominations: [15, 25, 50, 100], rate: 80, category: 'regular' },
  { id: 'steam', name: 'Steam', icon: 'ri-steam-fill', color: '#1B2838', bgColor: 'rgba(27, 40, 56, 0.25)', denominations: [20, 50, 100], rate: 78, category: 'regular' },
  { id: 'netflix', name: 'Netflix', icon: 'ri-netflix-fill', color: '#E50914', bgColor: 'rgba(229, 9, 20, 0.15)', denominations: [25, 50, 100], rate: 88, category: 'high-rate' },
  { id: 'spotify', name: 'Spotify', icon: 'ri-spotify-fill', color: '#1DB954', bgColor: 'rgba(29, 185, 84, 0.15)', denominations: [10, 30, 60], rate: 86, category: 'high-rate' },
  { id: 'playstation', name: 'PlayStation', icon: 'ri-playstation-fill', color: '#003791', bgColor: 'rgba(0, 55, 145, 0.15)', denominations: [25, 50, 100], rate: 79, category: 'regular' },
  { id: 'xbox', name: 'Xbox', icon: 'ri-xbox-fill', color: '#107C10', bgColor: 'rgba(16, 124, 16, 0.15)', denominations: [25, 50, 100], rate: 79, category: 'regular' },
  { id: 'nike', name: 'Nike', icon: 'ri-shopping-bag-line', color: '#FA5400', bgColor: 'rgba(250, 84, 0, 0.15)', denominations: [25, 50, 100, 150], rate: 90, category: 'high-rate' },
  { id: 'starbucks', name: 'Starbucks', icon: 'ri-cup-fill', color: '#00704A', bgColor: 'rgba(0, 112, 74, 0.15)', denominations: [10, 25, 50], rate: 87, category: 'top' },
];

const purchaseHistory = [
  { id: '1', brand: 'Amazon', amount: 100, date: '2026-01-25', status: 'completed' },
  { id: '2', brand: 'Netflix', amount: 50, date: '2026-01-24', status: 'completed' },
  { id: '3', brand: 'Spotify', amount: 30, date: '2026-01-23', status: 'pending' },
];

type SubSection = 'all' | 'top' | 'high-rate' | 'history';

export default function BuyTab() {
  const [activeSection, setActiveSection] = useState<SubSection>('all');
  const [selectedCard, setSelectedCard] = useState<GiftCardBrand | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  const subSections = [
    { id: 'all' as const, label: 'All Cards', icon: 'ri-apps-line' },
    { id: 'top' as const, label: 'Top Cards', icon: 'ri-fire-line' },
    { id: 'high-rate' as const, label: 'High Rate', icon: 'ri-arrow-up-circle-line' },
    { id: 'history' as const, label: 'History', icon: 'ri-history-line' },
  ];

  const getFilteredCards = () => {
    switch (activeSection) {
      case 'top':
        return giftCardBrands.filter(card => card.category === 'top');
      case 'high-rate':
        return giftCardBrands.filter(card => card.category === 'high-rate');
      default:
        return giftCardBrands;
    }
  };

  const handleSelectCard = (card: GiftCardBrand) => {
    setSelectedCard(card);
    setShowPurchaseModal(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {subSections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeSection === section.id
                ? 'bg-cream-300 text-dark-bg'
                : 'bg-dark-elevated text-neutral-300 hover:bg-dark-hover border border-dark-border'
            }`}
          >
            <i className={section.icon}></i>
            {section.label}
          </button>
        ))}
      </div>

      {activeSection === 'history' ? (
        <div className="space-y-3">
          {purchaseHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-dark-elevated flex items-center justify-center mb-4">
                <i className="ri-history-line text-2xl text-neutral-500"></i>
              </div>
              <p className="text-neutral-400">No purchase history yet</p>
            </div>
          ) : (
            purchaseHistory.map((purchase) => (
              <div 
                key={purchase.id}
                className="bg-dark-elevated rounded-2xl p-4 border border-dark-border flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-dark-card flex items-center justify-center">
                    <i className="ri-gift-line text-cream-300"></i>
                  </div>
                  <div>
                    <p className="font-medium text-white">{purchase.brand}</p>
                    <p className="text-xs text-neutral-400">{purchase.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-white">${purchase.amount}</p>
                  <span className={`text-xs ${
                    purchase.status === 'completed' ? 'text-success-400' : 'text-warning-400'
                  }`}>
                    {purchase.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <GiftCardGrid cards={getFilteredCards()} onSelectCard={handleSelectCard} />
      )}

      <PurchaseModal
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        card={selectedCard}
      />
    </div>
  );
}
