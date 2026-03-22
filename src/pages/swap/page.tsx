import { useNavigate } from 'react-router-dom';
import SwapCard from './components/SwapCard';

export default function SwapPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-dark-bg">
      <header className="bg-dark-card border-b border-dark-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="w-10 h-10 rounded-full hover:bg-dark-elevated flex items-center justify-center transition-colors cursor-pointer"
              >
                <i className="ri-arrow-left-line text-xl text-neutral-300"></i>
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">Swap</h1>
                <p className="text-sm text-neutral-500">Exchange your assets instantly</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/wallet')}
                className="flex items-center space-x-2 px-4 py-2 bg-dark-elevated hover:bg-lime-500/20 text-lime-400 font-medium rounded-xl transition-colors cursor-pointer"
              >
                <i className="ri-wallet-3-line"></i>
                <span className="hidden sm:inline">Wallet</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 p-4 bg-amber-500/20 rounded-xl border border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/30 rounded-full flex items-center justify-center flex-shrink-0">
              <i className="ri-tools-line text-amber-400 text-lg"></i>
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-400">Coming Soon</p>
              <p className="text-xs text-amber-400/80">
                Crypto swap is currently under development. This feature will allow you to exchange assets instantly at competitive rates.
              </p>
            </div>
          </div>
        </div>

        <div className="opacity-60 pointer-events-none">
          <SwapCard />
        </div>

        <div className="mt-6 space-y-4">
          <div className="p-4 bg-dark-elevated rounded-xl border border-dark-border">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-lime-500 rounded-full flex items-center justify-center flex-shrink-0">
                <i className="ri-shield-check-line text-white"></i>
              </div>
              <div>
                <p className="text-sm font-semibold text-white mb-1">Secure & Instant</p>
                <p className="text-xs text-neutral-400">
                  When launched, all swaps will be executed instantly at the best available rate. 
                  Your funds are always secure with our non-custodial swap protocol.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
