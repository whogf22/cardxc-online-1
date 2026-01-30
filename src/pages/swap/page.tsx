import { useNavigate } from 'react-router-dom';
import SwapCard from './components/SwapCard';

export default function SwapPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <header className="bg-white/80 backdrop-blur-lg border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <i className="ri-arrow-left-line text-xl text-slate-600"></i>
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Swap</h1>
                <p className="text-sm text-slate-500">Exchange your assets instantly</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/wallet')}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors cursor-pointer"
              >
                <i className="ri-wallet-3-line"></i>
                <span className="hidden sm:inline">Wallet</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SwapCard />

        <div className="mt-6 space-y-4">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center">
              <i className="ri-line-chart-line text-emerald-500 mr-2"></i>
              Popular Pairs
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { from: 'USD', to: 'BTC', rate: '$43,478.26' },
                { from: 'USD', to: 'ETH', rate: '$2,380.95' },
                { from: 'BTC', to: 'ETH', rate: '18.5 ETH' },
                { from: 'USD', to: 'USDT', rate: '1:1' },
              ].map((pair, index) => (
                <div key={index} className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm font-medium text-slate-900">{pair.from}/{pair.to}</p>
                  <p className="text-xs text-slate-500">{pair.rate}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <i className="ri-shield-check-line text-white"></i>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 mb-1">Secure & Instant</p>
                <p className="text-xs text-slate-600">
                  All swaps are executed instantly at the best available rate. 
                  Your funds are always secure with our non-custodial swap protocol.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-100">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
                <i className="ri-lightbulb-line text-white"></i>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 mb-1">Pro Tip</p>
                <p className="text-xs text-slate-600">
                  Swap fees are only 0.3%. For the best rates, consider swapping during 
                  low market volatility periods.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
