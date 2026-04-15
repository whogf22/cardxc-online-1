import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Footer from '../home/components/Footer';
import ContactModal from '../home/components/ContactModal';

const faqs = [
  {
    question: 'What is CardXC?',
    answer:
      'CardXC is a digital wallet and payments platform that lets you send money globally, buy virtual cards, purchase gift cards from 700+ brands, and manage all your finances in one place.',
  },
  {
    question: 'How do I create an account?',
    answer:
      'Sign up with your email, verify your identity through our quick KYC process, and you\'re ready to go. The entire process takes just a few minutes.',
  },
  {
    question: 'What virtual card brands are supported?',
    answer:
      'We issue VISA and Mastercard virtual cards that work worldwide for online purchases, subscriptions, and more.',
  },
  {
    question: 'Are there any hidden fees?',
    answer:
      'No hidden fees. We\'re transparent about all charges. You\'ll always see the exact fees before confirming any transaction.',
  },
  {
    question: 'How long do transfers take?',
    answer:
      'Most transfers complete within minutes. International transfers may take slightly longer depending on the destination, but we always aim for the fastest possible delivery.',
  },
  {
    question: 'Is my money safe?',
    answer:
      'Yes, we use 256-bit encryption, two-factor authentication (2FA), and 24/7 fraud monitoring to keep your funds and personal data secure.',
  },
  {
    question: 'Which countries are supported?',
    answer:
      'We support users globally with multi-currency support. You can send and receive money across borders with competitive exchange rates.',
  },
  {
    question: 'How do gift cards work?',
    answer:
      'Browse 700+ brands, purchase instantly with your CardXC wallet balance, and receive your gift card code digitally. It\'s that simple.',
  },
  {
    question: 'What is KYC verification?',
    answer:
      'Know Your Customer (KYC) verification is required by law to prevent fraud and money laundering. We\'ll ask for a valid ID and a selfie to verify your identity.',
  },
  {
    question: 'How do I contact support?',
    answer:
      'Reach us via email at support@cardxc.online, phone at +1 (516) 666-6333, or WhatsApp 24/7. Our support team is always ready to help with any questions or issues.',
  },
  {
    question: 'Can I use my virtual card for subscriptions?',
    answer:
      'Yes, CardXC virtual cards work with all major subscription services including Netflix, Spotify, Apple Music, Amazon Prime, and more. Just add your virtual card details as a payment method.',
  },
  {
    question: 'What currencies does CardXC support?',
    answer:
      'We support multiple currencies including USD, EUR, GBP, and more. You can hold, send, and receive in different currencies with competitive real-time exchange rates.',
  },
  {
    question: 'How do I add funds to my wallet?',
    answer:
      'You can fund your CardXC wallet via bank transfer, debit card, or other supported payment methods. Deposits are typically processed within minutes.',
  },
  {
    question: 'Is there a limit on transactions?',
    answer:
      'Transaction limits depend on your verification level. Basic accounts have standard limits, while fully verified accounts enjoy higher limits for transfers and gift card purchases. Complete KYC verification to unlock the highest limits.',
  },
  {
    question: 'What happens if I lose access to my account?',
    answer:
      'Use the \'Forgot Password\' feature to reset your credentials via email. If you\'ve also lost access to your email, contact our support team with your registered details for identity verification and account recovery.',
  },
];

function FAQItem({ faq }: { faq: (typeof faqs)[0] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-white/[0.06] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-sm sm:text-base font-semibold text-white">{faq.question}</span>
        <i
          className={`ri-arrow-down-s-line text-xl text-lime-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        ></i>
      </button>
      {open && (
        <div className="px-6 pb-5 pt-0">
          <p className="text-sm text-neutral-400 leading-relaxed">{faq.answer}</p>
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  const navigate = useNavigate();
  const [isContactOpen, setIsContactOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'FAQ | CardXC';
  }, []);

  return (
    <div className="min-h-screen bg-[#030303] w-full min-w-0 overflow-x-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#030303]/80 backdrop-blur-xl border-b border-white/[0.06] safe-top">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 w-full">
          <div className="flex items-center justify-between h-16">
            <button onClick={() => navigate('/')} className="flex items-center gap-3 group">
              <div className="w-9 h-9 bg-lime-500 rounded-lg flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-shadow">
                <i className="ri-wallet-3-line text-lg text-black font-bold"></i>
              </div>
              <span className="text-lg font-bold text-white tracking-tight">CardXC</span>
            </button>

            <div className="hidden md:flex items-center gap-8">
              <Link to="/gift-cards" className="text-[13px] text-neutral-400 hover:text-lime-400 transition-colors">Gift Cards</Link>
              <a href="/#features" className="text-[13px] text-neutral-400 hover:text-lime-400 transition-colors">Features</a>
              <Link to="/how-it-works" className="text-[13px] text-neutral-400 hover:text-lime-400 transition-colors">How It Works</Link>
              <Link to="/faq" className="text-[13px] text-lime-400 font-medium">FAQ</Link>
              <button onClick={() => setIsContactOpen(true)} className="text-[13px] text-neutral-400 hover:text-lime-400 transition-colors">Contact</button>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <button onClick={() => navigate('/signin')} className="px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white transition-colors">Sign In</button>
              <button onClick={() => navigate('/signup')} className="px-5 py-2 text-sm font-semibold text-black bg-lime-500 rounded-lg hover:bg-lime-400 transition-all shadow-glow-sm hover:shadow-glow">Get Started</button>
            </div>

            <Link to="/" className="md:hidden flex items-center gap-2 text-neutral-400 hover:text-lime-400 transition-colors">
              <i className="ri-arrow-left-line"></i>
              <span className="text-sm">Back</span>
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-16 w-full min-w-0">
        <section className="py-16 sm:py-24">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-lime-500/[0.1] px-4 py-2 rounded-full border border-lime-500/25 mb-6">
                <i className="ri-question-answer-line text-lime-400"></i>
                <span className="text-xs font-semibold text-lime-400 uppercase tracking-wider">Support</span>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
                Frequently Asked Questions
              </h1>
              <p className="text-neutral-400 max-w-md mx-auto">
                Everything you need to know about CardXC. Can't find an answer? Contact our support team.
              </p>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <FAQItem key={i} faq={faq} />
              ))}
            </div>

            <div className="mt-12 text-center">
              <p className="text-neutral-400 mb-4">Still have questions?</p>
              <button
                onClick={() => setIsContactOpen(true)}
                className="px-6 py-3 bg-lime-500 text-black font-semibold rounded-xl hover:bg-lime-400 transition-all shadow-glow-sm hover:shadow-glow"
              >
                Contact Support
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer onOpenContact={() => setIsContactOpen(true)} />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </div>
  );
}
