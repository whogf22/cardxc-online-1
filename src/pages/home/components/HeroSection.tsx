import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchExchangeRates, getConversionRate } from '../../../lib/exchangeRateService';

export default function HeroSection() {
  const navigate = useNavigate();
  const [eurRate, setEurRate] = useState(0.92);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRate();
  }, []);

  const loadRate = async () => {
    try {
      await fetchExchangeRates();
      const rate = getConversionRate('USD', 'EUR');
      setEurRate(rate);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load rate:', error);
      setLoading(false);
    }
  };

  const sendAmount = 1000;
  const receiveAmount = sendAmount * eurRate;

  return (
    <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[#030303]" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-lime-500/[0.07] rounded-full blur-[120px]"></div>
        <div className="absolute bottom-1/4 -right-32 w-[400px] h-[400px] bg-lime-400/[0.04] rounded-full blur-[100px]"></div>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-lime-500/20 to-transparent"></div>
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 bg-lime-500/[0.08] px-4 py-2 rounded-full border border-lime-500/20">
              <div className="w-2 h-2 bg-lime-400 rounded-full animate-pulse"></div>
              <span className="text-xs font-semibold text-lime-400 uppercase tracking-wider">Secure & Fast Payments</span>
            </div>

            <div className="space-y-5">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight">
                Send Money<br />
                <span className="text-lime-400">Worldwide</span>
              </h1>
              <p className="text-lg text-neutral-400 max-w-md leading-relaxed">
                Fast, secure, and affordable international transfers. Trust CardXC for your global payment needs.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => navigate('/signup')}
                className="group px-8 py-4 bg-lime-500 text-black font-bold rounded-xl hover:bg-lime-400 transition-all shadow-lime-glow hover:shadow-glow text-[15px]"
              >
                Open Free Account
                <i className="ri-arrow-right-line ml-2 group-hover:translate-x-1 transition-transform inline-block"></i>
              </button>
              <button
                onClick={() => navigate('/calculator')}
                className="px-8 py-4 bg-white/[0.04] text-white font-semibold rounded-xl border border-white/[0.08] hover:border-lime-500/30 hover:bg-white/[0.06] transition-all text-[15px]"
              >
                Calculate Transfer
              </button>
            </div>

            <div className="flex items-center gap-8 pt-2">
              {[
                { value: '100%', label: 'Secure' },
                { value: '24/7', label: 'Support' },
                { value: 'Instant', label: 'Transfers' }
              ].map((stat, i) => (
                <div key={i} className="flex items-center gap-8">
                  {i > 0 && <div className="w-px h-8 bg-white/[0.08] -ml-8"></div>}
                  <div>
                    <div className="text-xl font-bold text-white">{stat.value}</div>
                    <div className="text-xs text-neutral-500 uppercase tracking-wider">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-lime-500/20 via-lime-400/10 to-lime-500/20 rounded-2xl blur-xl"></div>
              <div className="relative bg-[#0d0d0d] rounded-2xl p-7 border border-white/[0.08] shadow-dark-elevated">
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-400 font-medium">Send Money</span>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-lime-400 rounded-full animate-pulse"></span>
                      <span className="text-lime-400 text-xs font-semibold">Live Rate</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
                      <div className="text-xs text-neutral-500 mb-1.5 font-medium">You send</div>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-white tracking-tight">
                          {sendAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <div className="flex items-center gap-2 bg-white/[0.06] px-3 py-1.5 rounded-lg border border-white/[0.06]">
                          <span className="text-base">🇺🇸</span>
                          <span className="text-sm font-semibold text-white">USD</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-center">
                      <div className="w-9 h-9 bg-lime-500 rounded-full flex items-center justify-center shadow-glow-sm">
                        <i className="ri-arrow-down-line text-black text-lg"></i>
                      </div>
                    </div>
                    
                    <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
                      <div className="text-xs text-neutral-500 mb-1.5 font-medium">Recipient gets</div>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-lime-400 tracking-tight">
                          {loading ? '...' : `€${receiveAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </span>
                        <div className="flex items-center gap-2 bg-white/[0.06] px-3 py-1.5 rounded-lg border border-white/[0.06]">
                          <span className="text-base">🇪🇺</span>
                          <span className="text-sm font-semibold text-white">EUR</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-500">Exchange rate</span>
                      <span className="text-white font-medium">
                        1 USD = {loading ? '...' : eurRate.toFixed(4)} EUR
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-500">Fee</span>
                      <span className="text-lime-400 font-semibold">1%</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => navigate('/signup')}
                    className="w-full py-3.5 bg-lime-500 text-black font-bold rounded-xl hover:bg-lime-400 transition-all shadow-glow-sm hover:shadow-glow text-[15px]"
                  >
                    Send Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
