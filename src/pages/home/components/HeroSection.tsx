import { useNavigate } from 'react-router-dom';

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-dark-bg preserve-3d">
      {/* 3D Background Lighting */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-40 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse-soft"></div>
        <div className="absolute bottom-1/4 -right-40 w-[700px] h-[700px] bg-cream-400/10 rounded-full blur-[140px]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-dark-elevated/40 rounded-full blur-[160px]"></div>
      </div>

      {/* 3D Mesh Grid */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgba(247, 220, 204, 0.15) 1px, transparent 0)`,
          backgroundSize: '64px 64px'
        }}></div>
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-24 sm:py-32">
        <div className="text-center space-y-10 sm:space-y-12 lg:space-y-16">
          {/* Floating Badge */}
          <div className="inline-flex items-center gap-3 bg-white/5 backdrop-blur-xl px-6 py-3.5 rounded-full border border-white/10 shadow-3d-depth animate-float">
            <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-[0_0_12px_rgba(52,211,153,0.6)] animate-pulse"></div>
            <span className="text-sm sm:text-base font-black text-white uppercase tracking-[0.2em]">World Class FinTech</span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-black text-white leading-[0.95] tracking-tighter transform-gpu hover:scale-[1.02] transition-transform duration-700 depth-text">
            GLOBAL PAYMENTS
            <span className="block mt-4 gradient-text filter drop-shadow-[0_0_30px_rgba(247,220,204,0.3)]">
              REIMAGINED
            </span>
          </h1>

          <p className="text-xl sm:text-2xl text-neutral-400 max-w-4xl mx-auto leading-relaxed px-6">
            Transfer assets globally with institutional precision. 
            <span className="block mt-2 font-black text-white uppercase tracking-widest text-sm opacity-60">Zero Friction • Real-Time • Secure</span>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8">
            <button
              onClick={() => navigate('/signup')}
              className="btn-3d w-full sm:w-auto h-20 px-14 !rounded-[1.5rem] text-xl"
            >
              <span className="flex items-center justify-center gap-4">
                Initialize Account
                <i className="ri-arrow-right-line text-2xl"></i>
              </span>
            </button>

            <button
              onClick={() => {
                const calculatorSection = document.getElementById('calculator');
                calculatorSection?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full sm:w-auto h-20 px-12 bg-dark-card text-white rounded-[1.5rem] font-black text-lg border border-white/10 shadow-3d-depth hover:shadow-3d-float hover:-translate-y-2 active:shadow-3d-pressed active:translate-y-1 transition-all transform-gpu"
            >
              <span className="flex items-center justify-center gap-4">
                <i className="ri-calculator-fill text-2xl text-cream-300"></i>
                ROI Analysis
              </span>
            </button>
          </div>

          {/* 3D Feature Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-10 pt-20">
            {[
              { icon: 'shield-check-fill', label: 'SSL SECURE', color: 'text-emerald-400' },
              { icon: 'flashlight-fill', label: 'INSTANT', color: 'text-primary-400' },
              { icon: 'copper-coin-fill', label: 'ELITE RATES', color: 'text-cream-300' },
              { icon: 'customer-service-fill', label: '24/7 VIP', color: 'text-warning-400' }
            ].map((item, index) => (
              <div 
                key={index} 
                className="group flex flex-col items-center gap-4 p-8 rounded-[2rem] bg-white/[0.03] backdrop-blur-md border border-white/5 shadow-3d-depth hover:shadow-3d-float hover:-translate-y-4 hover:border-white/20 transition-all duration-500 transform-gpu cursor-pointer"
              >
                <div className={`w-16 h-16 flex items-center justify-center rounded-2xl bg-white/5 mb-2 group-hover:scale-110 transition-transform shadow-inner ${item.color}`}>
                  <i className={`ri-${item.icon} text-3xl`}></i>
                </div>
                <span className="text-xs font-black text-neutral-300 tracking-[0.2em] group-hover:text-white transition-colors">{item.label}</span>
                {/* Reflection */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-[2rem]"></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 animate-bounce opacity-40">
        <div className="w-10 h-16 rounded-full border-2 border-white/10 flex items-start justify-center p-2">
          <div className="w-1.5 h-4 bg-cream-300 rounded-full animate-pulse"></div>
        </div>
      </div>
    </section>
  );
}
