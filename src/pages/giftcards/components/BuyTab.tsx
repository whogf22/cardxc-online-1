import { useState, useEffect, useCallback } from 'react';
import GiftCardGrid from './GiftCardGrid';
import PurchaseModal from './PurchaseModal';
import type { GiftCardBrand } from './GiftCardItem';
import { giftCardApi } from '../../../lib/api';
import { useToastContext } from '../../../contexts/ToastContext';
import { formatDate } from '../../../lib/localeUtils';

export default function BuyTab() {
  const toast = useToastContext();
  const [activeSection, setActiveSection] = useState<'all' | 'top' | 'high-rate' | 'history'>('all');
  const [selectedCard, setSelectedCard] = useState<GiftCardBrand | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [products, setProducts] = useState<GiftCardBrand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [prodResult, historyResult] = await Promise.all([
        giftCardApi.getProducts(),
        giftCardApi.getRequests()
      ]);

      if (prodResult.success && prodResult.data) {
        setProducts(prodResult.data.items);
      } else if (!prodResult.success) {
        toast.error((prodResult as any).error?.message || 'Could not load gift cards. Please try again.');
      }

      if (historyResult.success && historyResult.data) {
        setHistory(historyResult.data.requests);
      }
    } catch (error: any) {
      console.error('Failed to load gift card data:', error);
      toast.error(error?.message || 'Could not load gift cards. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const subSections = [
    { id: 'all' as const, label: 'All Cards', icon: 'ri-apps-line' },
    { id: 'top' as const, label: 'Top Cards', icon: 'ri-fire-line' },
    { id: 'high-rate' as const, label: 'High Rate', icon: 'ri-arrow-up-circle-line' },
    { id: 'history' as const, label: 'History', icon: 'ri-history-line' },
  ];

  const getFilteredCards = () => {
    let filtered = products;
    switch (activeSection) {
      case 'top':
        filtered = products.filter(card => card.category === 'top');
        break;
      case 'high-rate':
        filtered = products.filter(card => card.category === 'high-rate');
        break;
      default:
        break;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(card => card.name.toLowerCase().includes(q));
    }
    return filtered;
  };

  const handleSelectCard = (card: GiftCardBrand) => {
    setSelectedCard(card);
    setShowPurchaseModal(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 border-4 border-lime-400/20 border-t-lime-400 rounded-full animate-spin mb-4" />
        <p className="text-neutral-400">Loading gift cards...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 text-lg"></i>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search gift cards by name..."
          className="w-full pl-11 pr-4 py-3 bg-dark-elevated border border-dark-border rounded-xl text-white placeholder:text-neutral-500 focus:border-lime-400/50 focus:ring-2 focus:ring-lime-400/20 transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-dark-hover transition-colors"
            aria-label="Clear search"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {subSections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${activeSection === section.id
                ? 'bg-lime-500 text-black'
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
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-dark-elevated flex items-center justify-center mb-4">
                <i className="ri-history-line text-2xl text-neutral-500"></i>
              </div>
              <p className="text-neutral-400">No purchase history yet</p>
            </div>
          ) : (
            history.map((purchase) => (
              <div
                key={purchase.id}
                className="bg-dark-elevated rounded-2xl p-4 border border-dark-border flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-dark-card flex items-center justify-center">
                    <i className="ri-gift-line text-lime-400"></i>
                  </div>
                  <div>
                    <p className="font-medium text-white">{purchase.brand}</p>
                    <p className="text-xs text-neutral-400">{formatDate(purchase.created_at)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-white">${purchase.amount}</p>
                  <span className={`text-xs capitalize ${purchase.status === 'completed' ? 'text-success-400' :
                      purchase.status === 'pending' ? 'text-warning-400' : 'text-danger-400'
                    }`}>
                    {purchase.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <GiftCardGrid
          cards={getFilteredCards()}
          onSelectCard={handleSelectCard}
          emptyMessage={searchQuery ? `No gift cards match "${searchQuery}"` : undefined}
        />
      )}

      <PurchaseModal
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        card={selectedCard}
      />
    </div>
  );
}
