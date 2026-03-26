import { Link } from 'react-router-dom';
import { useState } from 'react';
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_TEL, SUPPORT_WHATSAPP_URL } from '../../../lib/contactPlaceholders';

const SOCIAL_LINKS = [
  { name: 'twitter', icon: 'ri-twitter-x-fill', url: 'https://x.com/cardxc' },
  { name: 'facebook', icon: 'ri-facebook-fill', url: 'https://www.facebook.com/share/16o9sy49rA/' },
  { name: 'linkedin', icon: 'ri-linkedin-fill', url: 'https://linkedin.com/company/cardxc' },
  { name: 'instagram', icon: 'ri-instagram-fill', url: 'https://instagram.com/cardxc' },
];

interface FooterProps {
  onOpenContact?: () => void;
}

export default function Footer({ onOpenContact }: FooterProps) {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 3000);
    }
  };

  return (
    <footer id="contact" className="relative pt-16 pb-8 overflow-hidden" style={{ background: '#060610', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0066FF, #0044CC)' }}>
                <i className="ri-wallet-3-line text-lg text-white font-bold" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>CardXC</span>
            </div>
            <p className="text-neutral-500 text-sm leading-relaxed">
              The next-generation digital gift card platform. Send premium cards instantly, anywhere in the world.
            </p>
            <div className="flex items-center gap-2.5">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-110"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                  aria-label={`Follow us on ${social.name}`}
                >
                  <i className={`${social.icon} text-neutral-400 text-sm`} />
                </a>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.15em] mb-4" style={{ color: '#0066FF' }}>Navigation</h4>
            <ul className="space-y-2.5">
              <li><Link to="/" className="text-sm text-neutral-500 hover:text-[#0066FF] transition-colors">Home</Link></li>
              <li><a href="#features" className="text-sm text-neutral-500 hover:text-[#0066FF] transition-colors">Features</a></li>
              <li><Link to="/how-it-works" className="text-sm text-neutral-500 hover:text-[#0066FF] transition-colors">How It Works</Link></li>
              <li><Link to="/giftcards" className="text-sm text-neutral-500 hover:text-[#0066FF] transition-colors">Gift Cards</Link></li>
              {onOpenContact && (
                <li><button onClick={onOpenContact} className="text-sm text-neutral-500 hover:text-[#0066FF] transition-colors">Contact</button></li>
              )}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.15em] mb-4" style={{ color: '#0066FF' }}>Legal</h4>
            <ul className="space-y-2.5">
              <li><Link to="/terms" className="text-sm text-neutral-500 hover:text-[#0066FF] transition-colors">Terms of Service</Link></li>
              <li><Link to="/privacy" className="text-sm text-neutral-500 hover:text-[#0066FF] transition-colors">Privacy Notice</Link></li>
              <li><Link to="/refund-policy" className="text-sm text-neutral-500 hover:text-[#0066FF] transition-colors">Refund Policy</Link></li>
              <li><Link to="/aml-policy" className="text-sm text-neutral-500 hover:text-[#0066FF] transition-colors">AML Policy</Link></li>
            </ul>
          </div>

          {/* Newsletter + Contact */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.15em] mb-4" style={{ color: '#0066FF' }}>Stay Updated</h4>
            <p className="text-neutral-500 text-sm mb-4">Get the latest news and exclusive offers.</p>
            <form onSubmit={handleSubscribe} className="flex gap-2 mb-5">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 px-4 py-2.5 rounded-lg text-sm text-white placeholder-neutral-600 outline-none transition-all focus:ring-1"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, #0066FF, #0044CC)', color: 'white', boxShadow: '0 0 15px rgba(0,102,255,0.2)' }}
              >
                {subscribed ? <i className="ri-check-line" /> : <i className="ri-send-plane-fill" />}
              </button>
            </form>
            {subscribed && <p className="text-[#00CC88] text-xs mb-3">Subscribed successfully!</p>}
            <ul className="space-y-2">
              <li>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center gap-2 text-neutral-500 text-sm hover:text-[#0066FF] transition-colors">
                  <i className="ri-mail-fill" /> {SUPPORT_EMAIL}
                </a>
              </li>
              <li>
                <a href={SUPPORT_PHONE_TEL} className="flex items-center gap-2 text-neutral-500 text-sm hover:text-[#0066FF] transition-colors">
                  <i className="ri-phone-fill" /> {SUPPORT_PHONE}
                </a>
              </li>
              <li>
                <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-neutral-500 text-sm hover:text-[#0066FF] transition-colors">
                  <i className="ri-whatsapp-fill" /> WhatsApp
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div>
            <p className="text-xs text-neutral-600">&copy; {new Date().getFullYear()} CardXC. All rights reserved.</p>
            <p className="text-xs text-neutral-700 mt-0.5">CardXC is a digital wallet and payments platform operated by CARDXC LLC.</p>
          </div>
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5 text-xs text-neutral-500">
              <i className="ri-shield-check-line text-[#00CC88]" /> 256-bit SSL
            </span>
            <span className="flex items-center gap-1.5 text-xs text-neutral-500">
              <i className="ri-lock-2-line text-[#0066FF]" /> PCI Compliant
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
