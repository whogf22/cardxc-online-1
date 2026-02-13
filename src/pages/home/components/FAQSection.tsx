import { useState } from 'react';

const faqs = [
  {
    q: 'What are the fees for sending money?',
    a: 'CardXC charges a transparent fee on each transfer—typically lower than traditional banks. Use our Fee Calculator to see the exact amount you pay and what your recipient gets before you send.'
  },
  {
    q: 'How fast are transfers?',
    a: 'Most transfers complete within minutes. Same-day delivery is available to many countries. You can track status in your account.'
  },
  {
    q: 'Is my money secure?',
    a: 'Yes. We use 256-bit SSL encryption, two-factor authentication, and 24/7 fraud monitoring. Your funds are protected with bank-level security.'
  },
  {
    q: 'Which countries do you support?',
    a: 'You can send money and gift cards to 180+ countries. Supported currencies and limits depend on your account and destination.'
  },
  {
    q: 'How do I get started?',
    a: 'Sign up with your email, verify your account, add funds to your wallet, then send money or buy gift cards. No paperwork required to start.'
  }
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24 bg-[#0a0a0a] border-t border-white/[0.04]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-lime-500/[0.08] rounded-full border border-lime-500/20 mb-6">
            <span className="text-lime-400 text-xs font-semibold uppercase tracking-wider">FAQ</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
            Quick answers to common questions. Can&apos;t find what you need? Contact support.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className={`rounded-xl border overflow-hidden transition-all ${
                openIndex === index
                  ? 'bg-[#0d0d0d] border-lime-500/20'
                  : 'bg-[#0d0d0d]/50 border-white/[0.06] hover:border-white/[0.1]'
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                aria-expanded={openIndex === index}
              >
                <span className="font-semibold text-white pr-4">{faq.q}</span>
                <div className={`w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 transition-all ${
                  openIndex === index ? 'bg-lime-500/[0.12] rotate-180' : 'bg-white/[0.04]'
                }`}>
                  <i className={`ri-arrow-down-s-line text-lg ${openIndex === index ? 'text-lime-400' : 'text-neutral-400'}`}></i>
                </div>
              </button>
              {openIndex === index && (
                <div className="px-6 pb-5 pt-0">
                  <p className="text-neutral-400 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
