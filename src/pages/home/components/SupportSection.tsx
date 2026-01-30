export default function SupportSection() {
  return (
    <section className="relative py-24 bg-dark-bg">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-cream-300/10 to-cream-500/5 rounded-3xl blur-2xl"></div>
            <div className="relative bg-dark-card rounded-3xl p-8 border border-dark-border">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-cream-300 to-cream-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <i className="ri-customer-service-2-line text-lg text-dark-bg"></i>
                  </div>
                  <div className="bg-dark-elevated rounded-2xl rounded-tl-none p-4 max-w-sm">
                    <p className="text-neutral-300">Hi! How can I help you today?</p>
                    <span className="text-xs text-neutral-500 mt-2 block">Support Team • Just now</span>
                  </div>
                </div>

                <div className="flex items-start gap-4 justify-end">
                  <div className="bg-cream-300/10 rounded-2xl rounded-tr-none p-4 max-w-sm">
                    <p className="text-cream-200">I need help with my virtual card.</p>
                    <span className="text-xs text-neutral-500 mt-2 block">You • Just now</span>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-cream-300 to-cream-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <i className="ri-customer-service-2-line text-lg text-dark-bg"></i>
                  </div>
                  <div className="bg-dark-elevated rounded-2xl rounded-tl-none p-4 max-w-sm">
                    <p className="text-neutral-300">I'd be happy to help! Let me check your account details and assist you right away.</p>
                    <span className="text-xs text-neutral-500 mt-2 block">Support Team • Just now</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="w-16 h-16 bg-cream-300/10 rounded-2xl flex items-center justify-center mb-6">
              <i className="ri-customer-service-line text-3xl text-cream-300"></i>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              24/7 Customer Support.
              <span className="block gradient-text mt-2">Always Here For You.</span>
            </h2>
            <p className="text-xl text-neutral-400 leading-relaxed">
              Our team is here for you. Whether you are new to digital finance or an experienced user, we offer dedicated support whenever you need it.
            </p>

            <div className="mt-10 grid sm:grid-cols-3 gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-cream-300/10 rounded-xl flex items-center justify-center">
                  <i className="ri-chat-1-line text-2xl text-cream-300"></i>
                </div>
                <div>
                  <div className="text-white font-semibold">Live Chat</div>
                  <div className="text-neutral-500 text-sm">Instant responses</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-success-500/10 rounded-xl flex items-center justify-center">
                  <i className="ri-mail-line text-2xl text-success-500"></i>
                </div>
                <div>
                  <div className="text-white font-semibold">Email Support</div>
                  <div className="text-neutral-500 text-sm">support@cardxc.com</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-400/10 rounded-xl flex items-center justify-center">
                  <i className="ri-phone-line text-2xl text-primary-400"></i>
                </div>
                <div>
                  <div className="text-white font-semibold">Phone Support</div>
                  <div className="text-neutral-500 text-sm">+1 (234) 567-890</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
