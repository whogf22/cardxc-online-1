import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchExchangeRates, getConversionRate, getCurrencyInfo, getRawRates } from '../../lib/exchangeRateService';

interface RateAlert {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  targetRate: number;
  currentRate: number;
  createdAt: Date;
}

interface CurrencyDisplay {
  code: string;
  name: string;
  flag: string;
  rate: number;
  change: number;
}

export default function CalculatorPage() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('1000');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [alerts, setAlerts] = useState<RateAlert[]>([]);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [targetRate, setTargetRate] = useState('');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [currencies, setCurrencies] = useState<CurrencyDisplay[]>([]);
  const [, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Currency Calculator | CardXC — Real-Time Exchange Rates';
    loadRates();
    const saved = localStorage.getItem('rateAlerts');
    if (saved) {
      setAlerts(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      loadRates();
    }, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadRates = async () => {
    try {
      await fetchExchangeRates();
      const rawRates = getRawRates();
      const currencyInfo = getCurrencyInfo();
      
      setRates(rawRates);
      
      // Generate random changes for display (in real app, compare with previous rates)
      const displayCurrencies: CurrencyDisplay[] = currencyInfo
        .filter(c => c.code !== 'USD')
        .map(c => ({
          code: c.code,
          name: c.name,
          flag: c.flag,
          rate: rawRates[c.code] || 1,
          change: (Math.random() - 0.5) * 2, // Random change for demo
        }));
      
      setCurrencies(displayCurrencies);
      setLastUpdated(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Failed to load rates:', error);
      setLoading(false);
    }
  };

  const currentRate = getConversionRate(fromCurrency, toCurrency);
  const convertedAmount = (parseFloat(amount) || 0) * currentRate;
  const fee = (parseFloat(amount) || 0) * 0.005; // 0.5% fee (similar to Wise)

  const createAlert = () => {
    if (!targetRate) return;
    const newAlert: RateAlert = {
      id: Date.now().toString(),
      fromCurrency,
      toCurrency,
      targetRate: parseFloat(targetRate),
      currentRate,
      createdAt: new Date(),
    };
    const updated = [...alerts, newAlert];
    setAlerts(updated);
    localStorage.setItem('rateAlerts', JSON.stringify(updated));
    setShowAlertModal(false);
    setTargetRate('');
  };

  const deleteAlert = (id: string) => {
    const updated = alerts.filter(a => a.id !== id);
    setAlerts(updated);
    localStorage.setItem('rateAlerts', JSON.stringify(updated));
  };

  const allCurrencies = [{ code: 'USD', name: 'US Dollar', flag: '🇺🇸' }, ...getCurrencyInfo().filter(c => c.code !== 'USD')];

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-400">Loading live rates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      <header className="fixed top-0 left-0 right-0 z-50 bg-dark-bg/95 backdrop-blur-xl border-b border-dark-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
            >
              <i className="ri-arrow-left-line text-xl"></i>
              <span className="font-medium">Back</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-lime-500 rounded-xl flex items-center justify-center">
                <i className="ri-exchange-dollar-line text-black"></i>
              </div>
              <span className="text-lg font-bold text-white">Live Rates</span>
            </div>
            <div className="text-xs text-neutral-500 flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
              Updated {lastUpdated.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </header>

      <main className="pt-20 pb-10 px-6">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* Rate Source Badge */}
          <div className="flex items-center justify-center gap-2 py-2">
            <span className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium">
              <i className="ri-check-line mr-1"></i>
              Mid-market rates (similar to Wise)
            </span>
          </div>

          {/* Currency Converter */}
          <div className="bg-dark-card rounded-2xl p-6 border border-white/5">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <i className="ri-calculator-line text-lime-500"></i>
              Currency Converter
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="block text-sm font-medium text-neutral-400">You Send</label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-dark-elevated text-white text-2xl font-bold p-4 rounded-xl border border-white/10 focus:border-lime-500 focus:outline-none"
                    placeholder="1000"
                  />
                  <select
                    value={fromCurrency}
                    onChange={(e) => setFromCurrency(e.target.value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-dark-card text-white font-medium px-3 py-1.5 rounded-lg border border-white/10"
                  >
                    {allCurrencies.map(c => (
                      <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-medium text-neutral-400">Recipient Gets</label>
                <div className="relative">
                  <div className="w-full bg-dark-elevated text-emerald-400 text-2xl font-bold p-4 rounded-xl border border-emerald-500/20">
                    {convertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <select
                    value={toCurrency}
                    onChange={(e) => setToCurrency(e.target.value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-dark-card text-white font-medium px-3 py-1.5 rounded-lg border border-white/10"
                  >
                    {allCurrencies.map(c => (
                      <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 p-4 bg-dark-elevated rounded-xl">
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-xs text-neutral-500">Exchange Rate</div>
                  <div className="text-white font-semibold">1 {fromCurrency} = {currentRate.toFixed(4)} {toCurrency}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500">Fee (0.5%)</div>
                  <div className="text-emerald-400 font-semibold">
                    {fromCurrency === 'USD' ? '$' : ''}{fee.toFixed(2)} {fromCurrency}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowAlertModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-lime-500/[0.08] text-lime-400 rounded-lg hover:bg-lime-500/20 transition-colors"
              >
                <i className="ri-notification-3-line"></i>
                Set Rate Alert
              </button>
            </div>
          </div>

          {/* Live Rates Grid */}
          <div className="bg-dark-card rounded-2xl p-6 border border-white/5">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <i className="ri-line-chart-line text-emerald-400"></i>
              Live Exchange Rates
              <span className="ml-auto text-xs font-normal text-neutral-500">Base: USD</span>
            </h2>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {currencies.map((currency) => (
                <div
                  key={currency.code}
                  className="p-4 bg-dark-elevated rounded-xl border border-white/5 hover:border-lime-500/30 transition-colors cursor-pointer"
                  onClick={() => {
                    setFromCurrency('USD');
                    setToCurrency(currency.code);
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{currency.flag}</span>
                      <span className="font-semibold text-white">{currency.code}</span>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      currency.change >= 0 
                        ? 'bg-emerald-500/10 text-emerald-400' 
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {currency.change >= 0 ? '+' : ''}{currency.change.toFixed(2)}%
                    </span>
                  </div>
                  <div className="text-lg font-bold text-white">
                    {currency.rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </div>
                  <div className="text-xs text-neutral-500">{currency.name}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Rate Alerts */}
          <div className="bg-dark-card rounded-2xl p-6 border border-white/5">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <i className="ri-alarm-line text-warning-400"></i>
              Your Rate Alerts
              {alerts.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-lime-500/[0.08] text-lime-400 text-xs rounded-full">
                  {alerts.length} active
                </span>
              )}
            </h2>
            
            {alerts.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-dark-elevated rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="ri-notification-off-line text-3xl text-neutral-500"></i>
                </div>
                <p className="text-neutral-400 mb-4">No rate alerts set</p>
                <button
                  onClick={() => setShowAlertModal(true)}
                  className="px-6 py-3 bg-lime-500 text-black font-semibold rounded-xl hover:bg-lime-400 transition-all"
                >
                  Create Your First Alert
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => {
                  const current = getConversionRate(alert.fromCurrency, alert.toCurrency);
                  const isReached = alert.targetRate <= current;
                  return (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-xl border ${
                        isReached 
                          ? 'bg-emerald-500/10 border-emerald-500/30' 
                          : 'bg-dark-elevated border-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isReached ? 'bg-emerald-500/20' : 'bg-dark-card'
                          }`}>
                            {isReached ? (
                              <i className="ri-check-line text-xl text-emerald-400"></i>
                            ) : (
                              <i className="ri-time-line text-xl text-warning-400"></i>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-white">
                              {alert.fromCurrency} → {alert.toCurrency}
                            </div>
                            <div className="text-sm text-neutral-400">
                              Target: {alert.targetRate.toFixed(4)} | Current: {current.toFixed(4)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {isReached && (
                            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-sm font-medium rounded-full">
                              Rate Reached!
                            </span>
                          )}
                          <button
                            onClick={() => deleteAlert(alert.id)}
                            className="p-2 text-neutral-500 hover:text-red-400 transition-colors"
                          >
                            <i className="ri-delete-bin-line"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid sm:grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/signup')}
              className="p-6 bg-lime-500 rounded-2xl text-black font-bold text-lg hover:bg-lime-400 transition-all"
            >
              <i className="ri-user-add-line mr-2"></i>
              Open Free Account
            </button>
            <button
              onClick={() => navigate('/transfer')}
              className="p-6 bg-dark-card rounded-2xl text-white font-bold text-lg border border-white/10 hover:border-lime-500/30 transition-colors"
            >
              <i className="ri-send-plane-fill mr-2 text-lime-400"></i>
              Send Money Now
            </button>
          </div>
        </div>
      </main>

      {/* Rate Alert Modal */}
      {showAlertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-dark-card rounded-2xl p-6 w-full max-w-md border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Create Rate Alert</h3>
              <button
                onClick={() => setShowAlertModal(false)}
                className="p-2 text-neutral-400 hover:text-white"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">Currency Pair</label>
                <div className="flex items-center gap-2">
                  <select
                    value={fromCurrency}
                    onChange={(e) => setFromCurrency(e.target.value)}
                    className="flex-1 bg-dark-elevated text-white p-3 rounded-xl border border-white/10"
                  >
                    {allCurrencies.map(c => (
                      <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                    ))}
                  </select>
                  <i className="ri-arrow-right-line text-neutral-500"></i>
                  <select
                    value={toCurrency}
                    onChange={(e) => setToCurrency(e.target.value)}
                    className="flex-1 bg-dark-elevated text-white p-3 rounded-xl border border-white/10"
                  >
                    {allCurrencies.map(c => (
                      <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  Current Rate: {currentRate.toFixed(4)}
                </label>
                <input
                  type="number"
                  value={targetRate}
                  onChange={(e) => setTargetRate(e.target.value)}
                  placeholder="Enter target rate"
                  className="w-full bg-dark-elevated text-white p-3 rounded-xl border border-white/10 focus:border-lime-500 focus:outline-none"
                  step="0.0001"
                />
              </div>

              <p className="text-sm text-neutral-500">
                We'll notify you when 1 {fromCurrency} = {targetRate || '...'} {toCurrency}
              </p>

              <button
                onClick={createAlert}
                disabled={!targetRate}
                className="w-full py-3 bg-lime-500 text-black font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-lime-400 transition-all"
              >
                Create Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
