import { Link } from 'react-router-dom';
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_TEL, SUPPORT_WHATSAPP_URL } from '../../../lib/contactPlaceholders';

const QUICK_LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'How It Works', to: '/how-it-works' },
  { label: 'FAQ', to: '/how-it-works' },
  { label: 'Contact', href: '/#contact' },
];

const LEGAL_LINKS = [
  { label: 'Terms of Service', to: '/terms' },
  { label: 'Privacy Notice', to: '/privacy' },
  { label: 'Refund Policy', to: '/refund-policy' },
  { label: 'AML Policy', to: '/aml-policy' },
] as const;

const SOCIAL_LINKS = [
  { name: 'twitter', url: 'https://twitter.com' },
  { name: 'facebook', url: 'https://www.facebook.com/share/16o9sy49rA/' },
  { name: 'linkedin', url: 'https://linkedin.com' },
  { name: 'instagram', url: 'https://instagram.com' },
] as const;

interface FooterProps {
  onOpenContact?: () => void;
}

export default function Footer({ onOpenContact }: FooterProps) {
  return (
    <footer id="contact" className="bg-[#0a0a0a] border-t border-white/[0.06] text-white w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-10 sm:py-14 lg:py-16 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-12">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-lime-500 rounded-lg flex items-center justify-center shadow-glow-sm">
                <i className="ri-wallet-3-line text-lg text-black font-bold" aria-hidden />
              </div>
              <span className="text-xl font-bold tracking-tight">CardXC</span>
            </div>
            <p className="text-sm text-neutral-400 leading-relaxed max-w-sm">
              A digital wallet and payments platform. Fast, secure, and affordable international money transfers.
            </p>
            <div className="flex items-center gap-2.5">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-lime-500/[0.12] border border-white/[0.06] hover:border-lime-500/20 transition-all"
                  aria-label={`Follow us on ${social.name}`}
                >
                  <i className={`ri-${social.name}-line text-base text-neutral-400 hover:text-lime-400`} aria-hidden />
                </a>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-lime-400 uppercase tracking-[0.15em]">Quick Links</h3>
            <ul className="space-y-2">
              {QUICK_LINKS.map((link) => (
                <li key={link.label}>
                  {link.label === 'Contact' && onOpenContact ? (
                    <button
                      type="button"
                      onClick={onOpenContact}
                      className="text-sm text-neutral-400 hover:text-white transition-colors py-1"
                    >
                      {link.label}
                    </button>
                  ) : 'to' in link && link.to ? (
                    <Link
                      to={link.to}
                      className="text-sm text-neutral-400 hover:text-white transition-colors py-1 inline-block"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      className="text-sm text-neutral-400 hover:text-white transition-colors py-1 inline-block"
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-lime-400 uppercase tracking-[0.15em]">Legal</h3>
            <ul className="space-y-2">
              {LEGAL_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm text-neutral-400 hover:text-white transition-colors py-1 inline-block"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-lime-400 uppercase tracking-[0.15em]">Contact Us</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06] shrink-0 mt-0.5">
                  <i className="ri-mail-line text-lime-400 text-sm" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-neutral-500 uppercase tracking-wider">Email</p>
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sm text-neutral-300 hover:text-lime-400 transition-colors break-all">
                    {SUPPORT_EMAIL}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06] shrink-0 mt-0.5">
                  <i className="ri-phone-line text-lime-400 text-sm" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-neutral-500 uppercase tracking-wider">Phone</p>
                  <a href={SUPPORT_PHONE_TEL} className="text-sm text-neutral-300 hover:text-lime-400 transition-colors">
                    {SUPPORT_PHONE}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06] shrink-0 mt-0.5">
                  <i className="ri-whatsapp-line text-lime-400 text-sm" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-neutral-500 uppercase tracking-wider">WhatsApp</p>
                  <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-neutral-300 hover:text-lime-400 transition-colors">
                    {SUPPORT_PHONE}
                  </a>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/[0.06]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <p className="text-xs text-neutral-500">
                &copy; {new Date().getFullYear()} CardXC. All rights reserved.
              </p>
              <p className="text-xs text-neutral-600 mt-1">
                CardXC is a digital wallet and payments platform operated by GameNova Vault LLC.
              </p>
            </div>
            <div className="flex items-center gap-5">
              <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                <i className="ri-shield-check-line text-emerald-500" aria-hidden />
                256-bit SSL
              </span>
              <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                <i className="ri-lock-2-line text-lime-400" aria-hidden />
                PCI Compliant
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
