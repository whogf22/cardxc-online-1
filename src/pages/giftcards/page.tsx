import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BuyTab from './components/BuyTab';
import SellTab from './components/SellTab';
import FluzGiftCardsTab from './components/FluzGiftCardsTab';

type TabType = 'buy' | 'sell' | 'my-cards';

export default function GiftCardsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('buy');

  const tabs = [
    { id: 'buy' as const, label: 'Buy Cards', icon: 'ri-shopping-cart-line' },
    { id: 'my-cards' as const, label: 'My Cards', icon: 'ri-gift-2-line' },
    { id: 'sell' as const, label: 'Sell Cards', icon: 'ri-hand-coin-line' },
  ];

  return (
    <div className="min-h-screen bg-dark-bg pb-24 w-full min-w-0 overflow-x-hidden relative">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-amber-500/[0.03] rounded-full blur-[80px]" />
      </div>
      <header className="sticky top-0 z-40 bg-dark-bg/90 backdrop-blur-xl border-b border-dark-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="w-10 h-10 rounded-xl bg-dark-elevated border border-dark-border flex items-center justify-center hover:bg-dark-hover transition-colors"
              >
                <i className="ri-arrow-left-line text-white"></i>
              </button>
              <div>
                <h1 className="text-lg font-bold text-white">Gift Cards</h1>
                <p className="text-xs text-neutral-400">Buy & Sell gift cards</p>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-dark-elevated border border-dark-border flex items-center justify-center">
              <i className="ri-gift-2-line text-lime-400"></i>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full min-w-0" tabIndex={-1}>
        <div className="flex gap-2 p-1 bg-dark-card rounded-2xl border border-dark-border mb-6 relative">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-lime-500 text-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <i className={tab.icon}></i>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="animate-fade-in-up" style={{ animationDelay: '0.05s', animationFillMode: 'forwards' }}>
          {activeTab === 'buy' && <BuyTab />}
          {activeTab === 'my-cards' && <FluzGiftCardsTab />}
          {activeTab === 'sell' && <SellTab />}
        </div>
      </main>
    </div>
  );
}
