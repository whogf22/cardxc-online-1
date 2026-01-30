import { useNavigate } from 'react-router-dom';
import { useToastContext } from '../../../contexts/ToastContext';

export default function AppExperienceSection() {
  const navigate = useNavigate();
  const toast = useToastContext();

  return (
    <section className="relative py-24 bg-dark-card">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-cream-300/10 rounded-full border border-cream-300/20 mb-6">
              <span className="text-cream-300 text-sm font-medium">The CardXC Experience</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              This is more than just another app.
            </h2>
            <p className="text-xl text-neutral-400 mb-6 leading-relaxed">
              It is a powerful tool that gives you total control over your financial life.
            </p>
            <p className="text-lg text-neutral-400 mb-10 leading-relaxed">
              Create Your Account or Access the Platform today to get started.
            </p>

            <div className="flex flex-wrap gap-4">
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  toast.info('Mobile app coming soon! Use the web platform for now.');
                }}
                className="flex items-center gap-3 px-6 py-4 bg-white text-dark-bg rounded-xl hover:bg-neutral-100 transition-colors"
              >
                <i className="ri-apple-fill text-2xl"></i>
                <div className="text-left">
                  <div className="text-xs opacity-70">Download on the</div>
                  <div className="font-semibold">App Store</div>
                </div>
              </button>
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  toast.info('Mobile app coming soon! Use the web platform for now.');
                }}
                className="flex items-center gap-3 px-6 py-4 bg-white text-dark-bg rounded-xl hover:bg-neutral-100 transition-colors"
              >
                <i className="ri-google-play-fill text-2xl text-green-600"></i>
                <div className="text-left">
                  <div className="text-xs opacity-70">Get it on</div>
                  <div className="font-semibold">Google Play</div>
                </div>
              </button>
            </div>

            <div className="mt-10">
              <button
                onClick={() => navigate('/signup')}
                className="inline-flex items-center gap-3 text-cream-300 hover:text-cream-200 font-semibold text-lg group"
              >
                Or create a web account
                <i className="ri-arrow-right-line group-hover:translate-x-1 transition-transform"></i>
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="relative mx-auto max-w-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-cream-300/20 to-cream-500/10 rounded-[3rem] blur-2xl transform rotate-3"></div>
              
              <div className="relative bg-dark-elevated rounded-[2.5rem] p-4 border border-dark-border shadow-2xl">
                <div className="bg-dark-bg rounded-[2rem] overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-cream-300 to-cream-500 rounded-xl flex items-center justify-center">
                          <i className="ri-wallet-3-line text-lg text-dark-bg"></i>
                        </div>
                        <span className="font-bold text-white">CardXC</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <i className="ri-notification-3-line text-neutral-400"></i>
                        <div className="w-8 h-8 bg-gradient-to-br from-cream-300 to-cream-500 rounded-full"></div>
                      </div>
                    </div>

                    <div className="text-center mb-8">
                      <div className="text-sm text-neutral-500 mb-2">Total Balance</div>
                      <div className="text-3xl font-bold text-white">$12,450.00</div>
                      <div className="text-sm text-success-500 mt-1">+$340.00 (+2.8%)</div>
                    </div>

                    <div className="grid grid-cols-4 gap-3 mb-8">
                      {[
                        { icon: 'ri-add-line', label: 'Add' },
                        { icon: 'ri-send-plane-line', label: 'Send' },
                        { icon: 'ri-bank-card-line', label: 'Cards' },
                        { icon: 'ri-history-line', label: 'History' }
                      ].map((action, index) => (
                        <div key={index} className="text-center">
                          <div className="w-12 h-12 bg-dark-card rounded-xl flex items-center justify-center mx-auto mb-2">
                            <i className={`${action.icon} text-xl text-cream-300`}></i>
                          </div>
                          <div className="text-xs text-neutral-500">{action.label}</div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-neutral-400 mb-3">Recent Activity</div>
                      {[
                        { name: 'Netflix', type: 'Subscription', amount: '-$15.99', icon: 'ri-netflix-fill' },
                        { name: 'Transfer', type: 'Received', amount: '+$500.00', icon: 'ri-arrow-down-line' }
                      ].map((tx, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-dark-card rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-dark-elevated rounded-xl flex items-center justify-center">
                              <i className={`${tx.icon} text-lg text-neutral-400`}></i>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white">{tx.name}</div>
                              <div className="text-xs text-neutral-500">{tx.type}</div>
                            </div>
                          </div>
                          <div className={`text-sm font-semibold ${tx.amount.startsWith('+') ? 'text-success-500' : 'text-white'}`}>
                            {tx.amount}
                          </div>
                        </div>
                      ))}
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
