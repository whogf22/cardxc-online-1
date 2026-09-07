import { Link } from 'react-router-dom';

export default function AboutSection() {
  return (
    <section id="about" className="py-24 lg:py-32 bg-dark-bg">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="text-center mb-14 lg:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
            Why Choose <span className="gradient-text">CardXC</span>?
          </h2>
          <p className="text-xl text-neutral-400 max-w-3xl mx-auto">
            A modern digital-wallet and payments experience built around clear controls, transparent status, and security-first engineering.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="group dark-card-interactive p-8">
            <div className="w-14 h-14 bg-lime-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <i className="ri-flashlight-line text-black text-2xl" aria-hidden />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Responsive Experience</h3>
            <p className="text-neutral-400 leading-relaxed">
              Real-time UI updates, transaction tracking, and notification foundations help keep account activity understandable. Final settlement speed can depend on the selected payment rail or external provider.
            </p>
          </div>

          <div className="group dark-card-interactive p-8">
            <div className="w-14 h-14 bg-gradient-to-br from-success-500 to-success-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <i className="ri-shield-check-line text-white text-2xl" aria-hidden />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Layered Security Controls</h3>
            <p className="text-neutral-400 leading-relaxed">
              CardXC includes controls such as multi-factor authentication, rate limiting, fraud checks, verified webhooks, and production error monitoring. No online service can eliminate every risk.
            </p>
          </div>

          <div className="group dark-card-interactive p-8">
            <div className="w-14 h-14 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <i className="ri-exchange-dollar-line text-white text-2xl" aria-hidden />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Multi-Currency Foundation</h3>
            <p className="text-neutral-400 leading-relaxed">
              The current platform code supports wallet balances for USD, EUR, GBP, NGN, and BDT. Currency availability and conversion functionality can vary by account, environment, and provider configuration.
            </p>
          </div>

          <div className="group dark-card-interactive p-8">
            <div className="w-14 h-14 bg-lime-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <i className="ri-global-line text-black text-2xl" aria-hidden />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Provider-Dependent Reach</h3>
            <p className="text-neutral-400 leading-relaxed">
              We build for cross-border use cases, while actual country coverage depends on eligibility, compliance requirements, payment-rail support, and provider approval. We do not represent a fixed worldwide coverage number without current evidence.
            </p>
          </div>

          <div className="group dark-card-interactive p-8">
            <div className="w-14 h-14 bg-gradient-to-br from-warning-400 to-warning-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <i className="ri-customer-service-2-line text-white text-2xl" aria-hidden />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Public Support Channels</h3>
            <p className="text-neutral-400 leading-relaxed">
              Support contact information is available without signing in, including email, phone, and WhatsApp. Response times can vary; CardXC does not claim a guaranteed 24/7 response SLA unless one is formally published.
            </p>
          </div>

          <div className="group dark-card-interactive p-8">
            <div className="w-14 h-14 bg-lime-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <i className="ri-line-chart-line text-black text-2xl" aria-hidden />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Transparent Availability</h3>
            <p className="text-neutral-400 leading-relaxed">
              We distinguish technical integration from external approval. A feature can remain development, beta, conditional, or disabled until provider, compliance, and production-readiness requirements are satisfied.
            </p>
          </div>
        </div>

        <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/about" className="btn-primary inline-flex items-center">
            Company & Service Information
            <i className="ri-arrow-right-line ml-2" aria-hidden />
          </Link>
          <Link to="/support" className="px-6 py-3 rounded-xl border border-dark-border text-neutral-200 hover:border-lime-500/30 hover:text-white transition-colors inline-flex items-center">
            Contact Support
          </Link>
        </div>
      </div>
    </section>
  );
}
