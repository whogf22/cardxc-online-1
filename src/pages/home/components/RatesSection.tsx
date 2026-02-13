import { useState, useEffect } from 'react';
import { fetchExchangeRates, getCurrencyInfo, getRawRates } from '../../../lib/exchangeRateService';

interface RateDisplay {
  from: string;
  to: string;
  rate: number;
  icon: string;
  color: string;
  flag: string;
  name: string;
}

export default function RatesSection() {
  const [rates, setRates] = useState<RateDisplay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRates();
  }, []);

  const loadRates = async () => {
    try {
      await fetchExchangeRates();
      const rawRates = getRawRates();
      const currencyInfo = getCurrencyInfo();
      
      const colors = [
        'from-blue-500 to-indigo-500',
        'from-purple-500 to-pink-500',
        'from-emerald-500 to-teal-500',
        'from-red-500 to-orange-500',
        'from-amber-500 to-yellow-500',
        'from-green-500 to-emerald-500',
      ];

      const displayRates: RateDisplay[] = currencyInfo
        .filter(c => c.code !== 'USD')
        .slice(0, 6)
        .map((currency, index) => {
          return {
            from: 'USD',
            to: currency.code,
            rate: rawRates[currency.code] || 1,
            icon: 'ri-exchange-dollar-line',
            color: colors[index % colors.length],
            flag: currency.flag,
            name: currency.name,
          };
        });

      setRates(displayRates);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load rates:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section id="rates" className="relative py-24 bg-dark-card">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="w-8 h-8 border-2 border-lime-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-neutral-400 mt-4">Loading live rates...</p>
        </div>
      </section>
    );
  }

  return (
    <section id="rates" className="relative py-24 bg-dark-card">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-lime-400/10 rounded-full border border-lime-400/20 mb-6">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
            <span className="text-lime-400 text-sm font-medium">Live Rates</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Transparent Pricing
          </h2>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
            Real mid-market rates. No hidden fees. What you see is what you pay.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rates.map((rate, index) => (
            <div 
              key={index}
              className="group p-6 dark-card-interactive"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 bg-gradient-to-br ${rate.color} rounded-xl flex items-center justify-center text-2xl`}>
                    {rate.flag}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{rate.from} → {rate.to}</h3>
                    <p className="text-sm text-neutral-400">{rate.name}</p>
                  </div>
                </div>
                <div className="px-3 py-1 rounded-full border bg-emerald-500/10 border-emerald-500/30">
                  <span className="text-xs font-medium text-emerald-400">
                    <i className="ri-exchange-line mr-1"></i>Live
                  </span>
                </div>
              </div>

              <div className="p-4 bg-dark-elevated rounded-xl border border-dark-border">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">1 {rate.from}</span>
                  <span className="text-lime-400 font-bold text-xl">
                    {rate.rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {rate.to}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-dark-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">Transfer Speed</span>
                  <span className="text-white font-medium">Instant</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-neutral-500 text-sm">
            <i className="ri-refresh-line mr-1"></i>
            Rates update automatically from live market data
          </p>
        </div>
      </div>
    </section>
  );
}
