export default function AboutSection() {
  return (
    <section id="about" className="py-24 bg-dark-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Why Choose <span className="gradient-text">CardXC</span>?
          </h2>
          <p className="text-xl text-neutral-400 max-w-3xl mx-auto">
            Experience the future of digital payments with our secure, fast, and user-friendly platform
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="group dark-card-interactive p-8">
            <div className="w-14 h-14 bg-gradient-to-br from-cream-300 to-cream-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <i className="ri-flashlight-line text-dark-bg text-2xl"></i>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Lightning Fast</h3>
            <p className="text-neutral-400 leading-relaxed">
              Send and receive money instantly with our real-time processing engine. No more waiting days for transfers to complete.
            </p>
          </div>

          <div className="group dark-card-interactive p-8">
            <div className="w-14 h-14 bg-gradient-to-br from-success-500 to-success-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <i className="ri-shield-check-line text-white text-2xl"></i>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Bank-Level Security</h3>
            <p className="text-neutral-400 leading-relaxed">
              Your funds are protected with enterprise-grade encryption, multi-factor authentication, and 24/7 fraud monitoring.
            </p>
          </div>

          <div className="group dark-card-interactive p-8">
            <div className="w-14 h-14 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <i className="ri-exchange-dollar-line text-white text-2xl"></i>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Multi-Currency Support</h3>
            <p className="text-neutral-400 leading-relaxed">
              Hold, exchange, and manage 50+ currencies with competitive exchange rates and transparent fees.
            </p>
          </div>

          <div className="group dark-card-interactive p-8">
            <div className="w-14 h-14 bg-gradient-to-br from-cream-400 to-cream-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <i className="ri-global-line text-dark-bg text-2xl"></i>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Global Reach</h3>
            <p className="text-neutral-400 leading-relaxed">
              Send money to 180+ countries with local payment methods and competitive exchange rates.
            </p>
          </div>

          <div className="group dark-card-interactive p-8">
            <div className="w-14 h-14 bg-gradient-to-br from-warning-400 to-warning-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <i className="ri-customer-service-2-line text-white text-2xl"></i>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">24/7 Support</h3>
            <p className="text-neutral-400 leading-relaxed">
              Our dedicated support team is available around the clock to help you with any questions or issues.
            </p>
          </div>

          <div className="group dark-card-interactive p-8">
            <div className="w-14 h-14 bg-gradient-to-br from-cream-300 to-cream-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <i className="ri-line-chart-line text-dark-bg text-2xl"></i>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Transparent Pricing</h3>
            <p className="text-neutral-400 leading-relaxed">
              No hidden fees. See exactly what you'll pay before you send, with competitive rates and low transaction costs.
            </p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <a
            href="/signup"
            className="btn-primary inline-flex items-center"
          >
            Start Using CardXC Today
            <i className="ri-arrow-right-line ml-2"></i>
          </a>
        </div>
      </div>
    </section>
  );
}
