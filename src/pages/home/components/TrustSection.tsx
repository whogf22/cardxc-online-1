import { trustBadges } from '../../../mocks/trust';

export default function TrustSection() {
  return (
    <section id="features" className="relative py-24 bg-dark-card">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-cream-300/10 rounded-full border border-cream-300/20 mb-6">
            <span className="text-cream-300 text-sm font-medium">Trusted Platform</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Your Security is
            <span className="block gradient-text mt-2">Our Priority</span>
          </h2>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
            Protected by 256-bit SSL encryption, PCI DSS Level 1 certified, with 24/7 fraud monitoring
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {trustBadges.map((badge, index) => (
            <div 
              key={index}
              className="group dark-card-interactive p-6 text-center"
            >
              <div className="w-16 h-16 bg-cream-300/10 group-hover:bg-cream-300/20 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-all">
                <i className={`${badge.icon} text-3xl text-cream-300`}></i>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{badge.title}</h3>
              <p className="text-neutral-400 text-sm">{badge.description}</p>
            </div>
          ))}
        </div>

        <div className="p-8 bg-gradient-to-br from-cream-300/10 to-cream-300/5 rounded-3xl border border-cream-300/20">
          <div className="text-center max-w-3xl mx-auto">
            <div className="w-16 h-16 bg-cream-300/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <i className="ri-bank-line text-3xl text-cream-300"></i>
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">
              Trusted by Major Nigerian Banks
            </h3>
            <p className="text-neutral-400 mb-8">
              We work with GTBank, Zenith Bank, UBA, First Bank, Access Bank, and more to ensure instant and secure payments
            </p>
            <div className="flex flex-wrap justify-center gap-8 items-center opacity-60">
              <div className="text-white font-bold text-xl">GTBank</div>
              <div className="text-white font-bold text-xl">Zenith</div>
              <div className="text-white font-bold text-xl">UBA</div>
              <div className="text-white font-bold text-xl">First Bank</div>
              <div className="text-white font-bold text-xl">Access</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
