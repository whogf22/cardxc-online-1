import { useState, useEffect } from 'react';
import { fetchExchangeRates, getConversionRate } from '../../../lib/exchangeRateService';

export default function CalculatorSection() {
  const [amount, setAmount] = useState<string>('100');
  const [highlighted, setHighlighted] = useState(false);

  useEffect(() => {
    if (window.location.hash === '#calculator') {
      setHighlighted(true);
      const t = setTimeout(() => setHighlighted(false), 2500);
      return () => clearTimeout(t);
    }
  }, []);
  const [fromCurrency, setFromCurrency] = useState<'USD' | 'NGN'>('USD');
  const [toCurrency, setToCurrency] = useState<'USD' | 'NGN'>('NGN');
  const [rate, setRate] = useState(0);
  const [rateLoading, setRateLoading] = useState(true);

  useEffect(() => {
    const loadRate = async () => {
      try {
        await fetchExchangeRates();
        const ngnRate = getConversionRate('USD', 'NGN');
        setRate(ngnRate);
      } catch (error) {
        console.error('[Calculator] Failed to load rate:', error);
        setRate(0);
      } finally {
        setRateLoading(false);
      }
    };
    loadRate();
  }, []);

  const currencies = ['USD', 'NGN'];

  const calculateConversion = () => {
    const numAmount = parseFloat(amount) || 0;
    if (rate === 0) return '0.00';
    if (fromCurrency === 'USD' && toCurrency === 'NGN') {
      return (numAmount * rate).toFixed(2);
    } else if (fromCurrency === 'NGN' && toCurrency === 'USD') {
      return (numAmount / rate).toFixed(2);
    }
    return numAmount.toFixed(2);
  };

  const numAmount = parseFloat(amount) || 0;
  const fee = rate > 0 ? numAmount * 0.01 : 0;
  const convertedAmount = parseFloat(calculateConversion());
  const received = convertedAmount - (convertedAmount * 0.01);
  const bankFee = numAmount * 0.04;
  const savings = bankFee - fee;

  return (
    <section
      id="calculator"
      className={`py-16 sm:py-20 lg:py-28 bg-dark-elevated scroll-mt-24 transition-all duration-500 ${highlighted ? 'ring-4 ring-lime-400/40 ring-offset-4 ring-offset-dark-bg rounded-2xl' : ''}`}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="text-center mb-12 sm:mb-16 lg:mb-20 space-y-4 sm:space-y-6">
          <div className="inline-flex items-center gap-2 bg-lime-400/10 text-lime-400 px-5 py-2.5 rounded-full text-sm sm:text-base font-semibold touch-target border border-lime-400/20">
            <i className="ri-calculator-line text-lg"></i>
            Fee Calculator
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight px-4 sm:px-0">
            See How Much You'll
            <span className="block mt-2 gradient-text">
              Save with CardXC
            </span>
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed px-4 sm:px-0">
            Enter an amount to see exactly how much your recipient will receive
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="dark-card overflow-hidden">
            <div className="p-6 sm:p-8 lg:p-12 space-y-6 sm:space-y-8">
              <div className="space-y-3 sm:space-y-4">
                <label className="block text-base sm:text-lg font-semibold text-neutral-300">
                  You Send
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="input-dark text-xl sm:text-2xl font-bold pr-20"
                    placeholder="1000"
                    min="0"
                    step="100"
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-xl sm:text-2xl font-bold text-neutral-500">
                    {fromCurrency}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-3 sm:space-y-4">
                  <label className="block text-sm sm:text-base font-semibold text-neutral-300">
                    From
                  </label>
                  <select
                    value={fromCurrency}
                    onChange={(e) => setFromCurrency(e.target.value as 'USD' | 'NGN')}
                    className="input-dark appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23737373'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.5em 1.5em', paddingRight: '3rem' }}
                  >
                    {currencies.map(curr => (
                      <option key={curr} value={curr}>{curr}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-3 sm:space-y-4">
                  <label className="block text-sm sm:text-base font-semibold text-neutral-300">
                    To
                  </label>
                  <select
                    value={toCurrency}
                    onChange={(e) => setToCurrency(e.target.value as 'USD' | 'NGN')}
                    className="input-dark appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23737373'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.5em 1.5em', paddingRight: '3rem' }}
                  >
                    {currencies.map(curr => (
                      <option key={curr} value={curr}>{curr}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-dark-elevated p-6 sm:p-8 lg:p-12 border-t border-dark-border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                <div className="space-y-4 sm:space-y-6 p-6 rounded-2xl bg-dark-card border border-dark-border">
                  <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                    <i className="ri-wallet-3-line text-lime-400"></i>
                    CardXC
                  </h3>
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Exchange Rate</span>
                      <span className="text-white font-semibold">{rateLoading ? '...' : `₦${rate.toLocaleString()}`}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Fee (1%)</span>
                      <span className="text-white font-semibold">{fromCurrency === 'USD' ? '$' : '₦'}{fee.toFixed(2)}</span>
                    </div>
                    <div className="pt-4 border-t border-dark-border flex items-center justify-between">
                      <span className="text-neutral-300 font-semibold">They Receive</span>
                      <span className="text-2xl sm:text-3xl font-bold text-lime-400">
                        {toCurrency === 'NGN' ? '₦' : '$'}{received.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 sm:space-y-6 p-6 rounded-2xl bg-dark-card border border-dark-border opacity-60">
                  <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                    <i className="ri-bank-line text-neutral-500"></i>
                    Traditional Banks
                  </h3>
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Exchange Rate</span>
                      <span className="text-white font-semibold">{rateLoading ? '...' : `₦${(rate * 0.95).toLocaleString()}`}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Fee (4%)</span>
                      <span className="text-white font-semibold">{fromCurrency === 'USD' ? '$' : '₦'}{bankFee.toFixed(2)}</span>
                    </div>
                    <div className="pt-4 border-t border-dark-border flex items-center justify-between">
                      <span className="text-neutral-300 font-semibold">They Receive</span>
                      <span className="text-2xl sm:text-3xl font-bold text-neutral-400">
                        {toCurrency === 'NGN' ? '₦' : '$'}{(convertedAmount * 0.91).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {savings > 0 && (
                <div className="mt-6 sm:mt-8 p-4 sm:p-6 rounded-2xl bg-success-500/10 border border-success-500/30">
                  <div className="flex items-center justify-center gap-3 sm:gap-4">
                    <i className="ri-money-dollar-circle-line text-2xl sm:text-3xl text-success-400"></i>
                    <div className="text-center sm:text-left">
                      <span className="text-success-400 font-bold text-lg sm:text-xl">
                        You save {fromCurrency === 'USD' ? '$' : '₦'}{savings.toFixed(2)}
                      </span>
                      <span className="text-success-400/80 ml-2">compared to traditional banks</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
