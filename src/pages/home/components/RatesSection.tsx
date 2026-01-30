import { rates } from '../../../mocks/rates';

export default function RatesSection() {
  return (
    <section id="rates" className="relative py-24 bg-dark-card">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-cream-300/10 rounded-full border border-cream-300/20 mb-6">
            <span className="text-cream-300 text-sm font-medium">Live Rates</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Transparent Pricing
          </h2>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
            No hidden fees. What you see is what you pay.
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
                  <div className={`w-12 h-12 bg-gradient-to-br ${rate.color} rounded-xl flex items-center justify-center`}>
                    <i className={`${rate.icon} text-white text-xl`}></i>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{rate.from} → {rate.to}</h3>
                    <p className="text-sm text-neutral-400">Exchange Rate</p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full border ${
                  rate.trend === 'up' 
                    ? 'bg-success-500/10 border-success-500/30' 
                    : 'bg-red-500/10 border-red-500/30'
                }`}>
                  <span className={`text-xs font-medium ${
                    rate.trend === 'up' ? 'text-success-400' : 'text-red-400'
                  }`}>
                    {rate.change}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-dark-elevated rounded-xl border border-dark-border">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">1 {rate.from}</span>
                  <span className="text-cream-300 font-bold text-xl">
                    {rate.rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {rate.to}
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
            <i className="ri-information-line mr-1"></i>
            Rates are indicative and may vary at the time of transaction
          </p>
        </div>
      </div>
    </section>
  );
}
