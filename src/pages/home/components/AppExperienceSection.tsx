import { useNavigate } from 'react-router-dom';

export default function AppExperienceSection() {
  const navigate = useNavigate();

  return (
    <section className="relative py-24 bg-dark-card">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-lime-400/10 rounded-full border border-lime-400/20 mb-6">
              <span className="text-lime-400 text-sm font-medium">The CardXC Experience</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Your wallet, send money & gift cards in one place.
            </h2>
            <p className="text-xl text-neutral-400 mb-6 leading-relaxed">
              Add funds, send money internationally, buy and send gift cards, and use virtual cards for online payments—all from your CardXC account.
            </p>
            <p className="text-lg text-neutral-400 mb-10 leading-relaxed">
              Sign in or create an account to get started.
            </p>

            <div className="flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => navigate('/signup')}
                className="flex items-center gap-3 px-8 py-4 bg-lime-500 text-black rounded-xl hover:opacity-90 transition-opacity font-semibold"
              >
                <i className="ri-user-add-line text-xl"></i>
                Get Started Free
              </button>
              <button
                type="button"
                onClick={() => navigate('/signin')}
                className="flex items-center gap-3 px-8 py-4 bg-white/10 text-white border border-white/20 rounded-xl hover:bg-white/20 transition-colors font-semibold"
              >
                <i className="ri-login-box-line text-xl"></i>
                Sign In
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="relative mx-auto max-w-sm">
              <div className="absolute inset-0 bg-lime-500/15 rounded-[3rem] blur-2xl transform rotate-3"></div>
              
              <div className="relative bg-dark-elevated rounded-[2.5rem] p-4 border border-dark-border shadow-2xl">
                <div className="bg-dark-bg rounded-[2rem] overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-lime-500 rounded-xl flex items-center justify-center">
                          <i className="ri-wallet-3-line text-lg text-black" aria-hidden />
                        </div>
                        <span className="font-bold text-white">CardXC</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <i className="ri-notification-3-line text-neutral-400" aria-hidden />
                        <div className="relative">
                          <span className="absolute inset-0 w-9 h-9 rounded-full bg-lime-400/40 animate-ping opacity-75" aria-hidden />
                          <div className="relative w-9 h-9 rounded-full bg-lime-500 flex items-center justify-center ring-2 ring-lime-400/30 ring-offset-2 ring-offset-dark-bg">
                            <i className="ri-user-smile-line text-sm text-black" aria-hidden />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-center mb-8">
                      <div className="text-sm text-neutral-500 mb-2">Wallet Balance</div>
                      <div className="text-3xl font-bold text-white">$••••.••</div>
                      <div className="text-xs text-neutral-500 mt-1">Available to send or spend</div>
                    </div>

                    <div className="grid grid-cols-4 gap-3 mb-8">
                      {[
                        { icon: 'ri-add-circle-line', label: 'Add Funds' },
                        { icon: 'ri-send-plane-line', label: 'Send Money' },
                        { icon: 'ri-gift-line', label: 'Gift Cards' },
                        { icon: 'ri-bank-card-line', label: 'Cards' }
                      ].map((action, index) => (
                        <div key={index} className="text-center">
                          <div className="w-12 h-12 bg-dark-card rounded-xl flex items-center justify-center mx-auto mb-2">
                            <i className={`${action.icon} text-xl text-lime-400`} aria-hidden />
                          </div>
                          <div className="text-xs text-neutral-500">{action.label}</div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-neutral-400 mb-3">Features</div>
                      {[
                        { name: 'Send Money', type: 'International transfers', icon: 'ri-send-plane-line' },
                        { name: 'Gift Cards', type: 'Buy & send instantly', icon: 'ri-gift-line' },
                        { name: 'Add Funds', type: 'Multiple methods', icon: 'ri-arrow-down-line' },
                        { name: 'Virtual Cards', type: 'Secure online payments', icon: 'ri-bank-card-line' }
                      ].map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-dark-card rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-dark-elevated rounded-xl flex items-center justify-center">
                              <i className={`${item.icon} text-lg text-neutral-400`} aria-hidden />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white">{item.name}</div>
                              <div className="text-xs text-neutral-500">{item.type}</div>
                            </div>
                          </div>
                          <i className="ri-arrow-right-s-line text-neutral-500" aria-hidden />
                        </div>
                      ))}
                    </div>

                    <div className="mt-6">
                      <div className="rounded-2xl bg-dark-elevated/80 border border-dark-border px-3 py-3 shadow-inner">
                        <div className="grid grid-cols-4 items-center gap-1">
                          {[
                            { icon: 'ri-calculator-line', label: 'Fee Calc' },
                            { icon: 'ri-exchange-line', label: 'Swap' },
                            { icon: 'ri-shield-check-line', label: 'Secure' },
                            { icon: 'ri-customer-service-2-line', label: 'Support' }
                          ].map((item, i) => (
                            <div
                              key={i}
                              className="flex flex-col items-center justify-center gap-1 py-1"
                            >
                              <div className="w-8 h-8 rounded-xl bg-dark-card/80 flex items-center justify-center">
                                <i className={`${item.icon} text-base text-lime-400/90`} aria-hidden />
                              </div>
                              <span className="text-[10px] text-neutral-500 leading-tight text-center max-w-[4rem] truncate">
                                {item.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-center mt-3 mb-1">
                        <div className="w-10 h-1 rounded-full bg-neutral-500/40" aria-hidden />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
