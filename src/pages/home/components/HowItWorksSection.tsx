export default function HowItWorksSection() {
  const steps = [
    {
      number: '01',
      title: 'Create Account',
      description: 'Sign up in seconds with just your email',
      icon: 'ri-user-add-line',
      color: 'from-cream-300 to-cream-400'
    },
    {
      number: '02',
      title: 'Add Funds',
      description: 'Top up your wallet with card or bank transfer',
      icon: 'ri-wallet-line',
      color: 'from-primary-400 to-primary-500'
    },
    {
      number: '03',
      title: 'Send Money',
      description: 'Transfer to anyone, anywhere instantly',
      icon: 'ri-send-plane-line',
      color: 'from-success-400 to-success-500'
    },
    {
      number: '04',
      title: 'Track & Manage',
      description: 'Monitor all transactions in real-time',
      icon: 'ri-bar-chart-line',
      color: 'from-warning-400 to-warning-500'
    }
  ];

  return (
    <section className="relative py-24 lg:py-32 bg-dark-bg overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-0 w-[400px] h-[400px] bg-cream-300/5 rounded-full blur-3xl -translate-x-1/2"></div>
        <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] bg-cream-400/5 rounded-full blur-3xl translate-x-1/2"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        {/* Section header */}
        <div className="text-center mb-16 lg:mb-20 animate-fade-in">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-cream-300/10 rounded-full border border-cream-300/20 mb-6">
            <i className="ri-lightbulb-flash-line text-cream-300"></i>
            <span className="text-cream-300 text-sm font-medium">Simple Process</span>
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 lg:mb-6">
            How It <span className="gradient-text">Works</span>
          </h2>
          <p className="text-lg sm:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">
            Get started in four simple steps. From account creation to tracking your transactions, we make it seamless and secure.
          </p>
        </div>

        {/* Steps container */}
        <div className="relative">
          {/* Desktop connecting line - only visible on large screens */}
          <div className="hidden lg:block absolute top-32 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cream-300/20 to-transparent"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {steps.map((step, index) => (
              <div 
                key={index}
                className="group relative animate-fade-in"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                {/* Mobile connector line */}
                {index < steps.length - 1 && (
                  <div className="md:hidden absolute -bottom-8 left-1/2 -translate-x-1/2 w-1 h-8 bg-gradient-to-b from-cream-300/30 to-transparent"></div>
                )}

                {/* Card */}
                <div className="relative h-full p-6 sm:p-8 rounded-2xl lg:rounded-3xl border border-dark-border bg-dark-card/40 backdrop-blur-sm hover:bg-dark-card/60 hover:border-cream-300/20 transition-all duration-500 group-hover:shadow-lg">
                  {/* Step number */}
                  <div className="mb-6 flex items-start justify-between">
                    <div className={`text-4xl lg:text-5xl font-bold bg-gradient-to-br ${step.color} bg-clip-text text-transparent opacity-30 group-hover:opacity-50 transition-opacity duration-300`}>
                      {step.number}
                    </div>
                  </div>

                  {/* Icon */}
                  <div className={`w-14 h-14 lg:w-16 lg:h-16 flex items-center justify-center rounded-2xl bg-gradient-to-br ${step.color} mb-6 group-hover:scale-110 transition-transform duration-500`}>
                    <i className={`${step.icon} text-2xl lg:text-3xl text-white`}></i>
                  </div>

                  {/* Title */}
                  <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 group-hover:text-cream-300 transition-colors duration-300">
                    {step.title}
                  </h3>

                  {/* Description */}
                  <p className="text-neutral-400 text-base lg:text-lg leading-relaxed group-hover:text-neutral-300 transition-colors duration-300">
                    {step.description}
                  </p>

                  {/* Bottom accent line */}
                  <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${step.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-b-3xl`}></div>
                </div>

                {/* Connector arrow (desktop) - between steps */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:flex absolute -right-3 top-32 z-20 text-cream-300/30 group-hover:text-cream-300/60 transition-colors duration-300">
                    <i className="ri-arrow-right-s-line text-2xl"></i>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 lg:mt-20 text-center animate-fade-in" style={{ animationDelay: '600ms' }}>
          <p className="text-neutral-400 text-lg mb-6">
            Ready to get started? Join thousands of users sending money smarter.
          </p>
          <button
            onClick={() => {
              const signupElement = document.querySelector('button[aria-label="Get started with CardXC"]');
              signupElement?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-3 px-8 lg:px-10 py-4 lg:py-5 bg-gradient-to-r from-cream-300 to-cream-400 text-dark-bg rounded-2xl lg:rounded-3xl font-semibold text-base lg:text-lg shadow-glow-sm hover:shadow-glow hover:scale-105 active:scale-100 transition-all duration-300 touch-target-lg"
          >
            <i className="ri-arrow-right-line text-xl group-hover:translate-x-1 transition-transform"></i>
            Start Your Journey
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.8s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </section>
  );
}
