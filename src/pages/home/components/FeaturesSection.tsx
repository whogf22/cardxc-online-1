import { useEffect, useRef, useState } from 'react';

interface Feature {
  icon: string;
  title: string;
  description: string;
  gradient: string;
}

const features: Feature[] = [
  {
    icon: 'ri-send-plane-2-fill',
    title: 'Instant Transfers',
    description: 'Send money globally in seconds',
    gradient: 'from-emerald-400 to-emerald-600'
  },
  {
    icon: 'ri-shield-flash-fill',
    title: 'Elite Security',
    description: 'Bank-grade encryption & 2FA protection',
    gradient: 'from-success-400 to-success-500'
  },
  {
    icon: 'ri-wallet-3-fill',
    title: 'Universal Wallet',
    description: 'USD, USDT & 150+ international assets',
    gradient: 'from-primary-400 to-primary-500'
  },
  {
    icon: 'ri-pie-chart-2-fill',
    title: 'Advanced Intel',
    description: 'Deep spending insights & real-time logs',
    gradient: 'from-warning-400 to-warning-500'
  },
  {
    icon: 'ri-safe-fill',
    title: 'Vault Systems',
    description: 'Institutional-grade asset protection',
    gradient: 'from-cream-400 to-cream-500'
  },
  {
    icon: 'ri-customer-service-2-fill',
    title: 'VIP Support',
    description: 'Dedicated 24/7 financial assistance',
    gradient: 'from-primary-300 to-primary-400'
  }
];

function FeatureCard({ feature, index, isVisible }: { feature: Feature; index: number; isVisible: boolean }) {
  return (
    <div
      className="group perspective-1000"
      style={{ 
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(100px)',
        transition: `all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 120}ms`
      }}
    >
      {/* Static 3D Card for stability and performance */}
      <div className="relative h-full p-8 lg:p-10 rounded-[2.5rem] bg-dark-card/40 backdrop-blur-3xl border border-white/5 shadow-3d-depth transition-all duration-500 transform-gpu cursor-pointer hover:-translate-y-4 hover:shadow-3d-float hover:border-white/10 overflow-hidden">
        
        {/* Interactive Reflection Layer */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 -rotate-12 translate-x-1/2"></div>

        <div className="relative z-10">
          <div className={`w-16 h-16 lg:w-20 lg:h-20 flex items-center justify-center rounded-[1.5rem] bg-gradient-to-br ${feature.gradient} mb-8 shadow-3d-depth transform transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6`}>
            <i className={`${feature.icon} text-3xl lg:text-4xl text-white`}></i>
          </div>

          <h3 className="text-2xl lg:text-3xl font-black text-white mb-4 uppercase tracking-tighter group-hover:text-cream-300 transition-colors">
            {feature.title}
          </h3>

          <p className="text-neutral-500 text-base lg:text-lg font-medium leading-relaxed group-hover:text-neutral-300 transition-colors">
            {feature.description}
          </p>
        </div>

        {/* Bottom Accent Glow */}
        <div className={`absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
      </div>
    </div>
  );
}

export default function FeaturesSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.1 });
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} id="features" className="relative py-32 lg:py-48 bg-[#030303] overflow-hidden">
      {/* 3D Scene Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[160px]"></div>
        <div className="absolute bottom-0 left-[-10%] w-[40%] h-[50%] bg-cream-300/5 rounded-full blur-[140px]"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className={`text-center mb-24 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}>
          <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 rounded-full border border-emerald-500/20 mb-8 shadow-glow-sm">
            <i className="ri-shield-flash-fill text-emerald-400"></i>
            <span className="text-emerald-400 text-xs font-black uppercase tracking-[0.2em]">Enterprise Grade</span>
          </div>
          <h2 className="text-5xl sm:text-6xl lg:text-8xl font-black text-white mb-6 uppercase tracking-tighter">
            THE FUTURE OF <span className="gradient-text">CAPITAL</span>
          </h2>
          <p className="text-xl text-neutral-500 max-w-3xl mx-auto font-medium">
            Built for speed, engineered for security, and designed for the absolute best experience in global finance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
          {features.map((feature, index) => (
            <FeatureCard key={index} feature={feature} index={index} isVisible={isVisible} />
          ))}
        </div>
      </div>
    </section>
  );
}
