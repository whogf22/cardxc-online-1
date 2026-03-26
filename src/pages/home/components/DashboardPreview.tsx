export default function DashboardPreview() {
  return (
    <section className="relative py-20 sm:py-28 overflow-hidden" style={{ background: '#0A0A0F' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[200px] opacity-15" style={{ background: '#0066FF' }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#0066FF]/20 bg-[#0066FF]/5 mb-6">
            <span className="text-xs font-semibold text-[#0066FF] uppercase tracking-wider">Dashboard</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Your Command Center
          </h2>
          <p className="text-neutral-400 max-w-xl mx-auto">
            Manage all your cards, track balances, and send gifts — all from one beautiful dashboard.
          </p>
        </div>

        {/* Floating browser frame */}
        <div className="max-w-4xl mx-auto" style={{ perspective: '1200px' }}>
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              transform: 'rotateX(5deg)',
              transformStyle: 'preserve-3d',
              boxShadow: '0 40px 80px rgba(0,102,255,0.15), 0 0 120px rgba(0,102,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              animation: 'dashFloat 6s ease-in-out infinite',
            }}
          >
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3" style={{ background: 'rgba(20,20,30,0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex-1 mx-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <i className="ri-lock-fill text-green-400 text-xs" />
                  <span className="text-neutral-400 text-xs">cardxc.online/dashboard</span>
                </div>
              </div>
            </div>

            {/* Dashboard mockup */}
            <div className="p-6 sm:p-8" style={{ background: 'linear-gradient(180deg, #0A0A1A, #0A0A0F)' }}>
              {/* Top bar */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-neutral-500 text-xs mb-1">Total Balance</div>
                  <div className="text-3xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>$2,847.50</div>
                </div>
                <div className="flex gap-2">
                  <button className="px-4 py-2 rounded-lg text-xs font-semibold text-white" style={{ background: '#0066FF', boxShadow: '0 0 20px rgba(0,102,255,0.3)' }}>
                    <i className="ri-send-plane-fill mr-1" /> Send Card
                  </button>
                  <button className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: 'rgba(255,215,0,0.15)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.25)' }}>
                    <i className="ri-download-2-fill mr-1" /> Redeem
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Mini donut chart */}
                <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="text-neutral-500 text-xs mb-3">Spending</div>
                  <div className="flex items-center gap-3">
                    <svg width="60" height="60" viewBox="0 0 60 60">
                      <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                      <circle cx="30" cy="30" r="24" fill="none" stroke="#0066FF" strokeWidth="6" strokeDasharray="100 50" strokeLinecap="round" transform="rotate(-90 30 30)" />
                      <circle cx="30" cy="30" r="24" fill="none" stroke="#FFD700" strokeWidth="6" strokeDasharray="40 110" strokeDashoffset="-100" strokeLinecap="round" transform="rotate(-90 30 30)" />
                    </svg>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: '#0066FF' }} />
                        <span className="text-neutral-400 text-[10px]">Shopping 65%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: '#FFD700' }} />
                        <span className="text-neutral-400 text-[10px]">Gifts 35%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent transactions */}
                <div className="sm:col-span-2 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="text-neutral-500 text-xs mb-3">Recent Transactions</div>
                  <div className="space-y-2.5">
                    {[
                      { name: 'Amazon Gift Card', amount: '-$50.00', icon: 'ri-shopping-bag-fill', color: '#FF6633' },
                      { name: 'Birthday Card Sent', amount: '-$25.00', icon: 'ri-cake-2-fill', color: '#FF6B6B' },
                      { name: 'Card Redeemed', amount: '+$100.00', icon: 'ri-download-2-fill', color: '#00CC88' },
                    ].map((tx, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${tx.color}15` }}>
                            <i className={`${tx.icon} text-sm`} style={{ color: tx.color }} />
                          </div>
                          <span className="text-white text-xs font-medium">{tx.name}</span>
                        </div>
                        <span className={`text-xs font-semibold ${tx.amount.startsWith('+') ? 'text-green-400' : 'text-neutral-400'}`}>
                          {tx.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes dashFloat {
          0%, 100% { transform: rotateX(5deg) translateY(0); }
          50% { transform: rotateX(3deg) translateY(-10px); }
        }
      `}</style>
    </section>
  );
}
