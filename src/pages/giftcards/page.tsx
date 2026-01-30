import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BuyTab from './components/BuyTab';
import SellTab from './components/SellTab';

type TabType = 'buy' | 'sell';

export default function GiftCardsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('buy');

  const tabs = [
    { id: 'buy' as const, label: 'Buy Cards', icon: 'ri-shopping-cart-line' },
    { id: 'sell' as const, label: 'Sell Cards', icon: 'ri-hand-coin-line' },
  ];

  return (
    <div className="min-h-screen bg-dark-bg pb-24">
      <header className="sticky top-0 z-40 bg-dark-bg/90 backdrop-blur-xl border-b border-dark-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
              <i className="ri-gift-2-line text-cream-300"></i>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-2 p-1 bg-dark-card rounded-2xl border border-dark-border mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-cream-300 text-dark-bg'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <i className={tab.icon}></i>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="animate-fade-in">
          {activeTab === 'buy' ? <BuyTab /> : <SellTab />}
        </div>
      </main>
    </div>
  );
}
