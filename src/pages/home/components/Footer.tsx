import { useNavigate } from 'react-router-dom';

export default function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="bg-dark-card border-t border-dark-border text-white">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-12 sm:py-16 lg:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 sm:gap-12 lg:gap-16">
          <div className="space-y-5 sm:space-y-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-cream-300 to-cream-500 rounded-xl flex items-center justify-center shadow-glow-sm">
                <i className="ri-wallet-3-line text-2xl sm:text-3xl text-dark-bg"></i>
              </div>
              <span className="text-2xl sm:text-3xl font-bold">CardXC</span>
            </div>
            <p className="text-base sm:text-lg text-neutral-400 leading-relaxed">
              Fast, secure, and affordable international money transfers trusted by thousands worldwide.
            </p>
            <div className="flex items-center gap-4">
              {['twitter', 'facebook', 'linkedin', 'instagram'].map((social) => (
                <a
                  key={social}
                  href={`https://${social}.com`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-12 h-12 flex items-center justify-center rounded-xl bg-dark-elevated hover:bg-cream-300/10 hover:scale-110 active:scale-100 transition-all duration-300 touch-target border border-dark-border hover:border-cream-300/30"
                  aria-label={`Follow us on ${social}`}
                >
                  <i className={`ri-${social}-line text-xl text-neutral-400 hover:text-cream-300`}></i>
                </a>
              ))}
            </div>
          </div>

          <div className="space-y-5 sm:space-y-6">
            <h3 className="text-lg sm:text-xl font-bold text-cream-300">Quick Links</h3>
            <ul className="space-y-3 sm:space-y-4">
              {[
                { label: 'About Us', href: '#about' },
                { label: 'How It Works', href: '#features' },
                { label: 'Exchange Rates', href: '#rates' },
                { label: 'Contact', href: '#contact' }
              ].map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="inline-flex items-center gap-2 text-base sm:text-lg text-neutral-400 hover:text-white hover:translate-x-1 transition-all duration-300 py-2 touch-target"
                  >
                    <i className="ri-arrow-right-s-line text-cream-300"></i>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-5 sm:space-y-6">
            <h3 className="text-lg sm:text-xl font-bold text-cream-300">Legal</h3>
            <ul className="space-y-3 sm:space-y-4">
              {[
                { label: 'Terms of Service', path: '/terms' },
                { label: 'Privacy Policy', path: '/privacy' },
                { label: 'Refund Policy', path: '/refund-policy' },
                { label: 'AML Policy', path: '/aml-policy' }
              ].map((link) => (
                <li key={link.label}>
                  <button
                    onClick={() => navigate(link.path)}
                    className="inline-flex items-center gap-2 text-base sm:text-lg text-neutral-400 hover:text-white hover:translate-x-1 transition-all duration-300 py-2 touch-target"
                  >
                    <i className="ri-arrow-right-s-line text-cream-300"></i>
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-5 sm:space-y-6">
            <h3 className="text-lg sm:text-xl font-bold text-cream-300">Contact Us</h3>
            <ul className="space-y-4 sm:space-y-5">
              <li className="flex items-start gap-4">
                <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-dark-elevated border border-dark-border">
                  <i className="ri-mail-line text-cream-300"></i>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Email</p>
                  <a href="mailto:support@cardxc.com" className="text-base sm:text-lg text-neutral-300 hover:text-cream-300 transition-colors">
                    support@cardxc.com
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-dark-elevated border border-dark-border">
                  <i className="ri-phone-line text-cream-300"></i>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Phone</p>
                  <a href="tel:+1234567890" className="text-base sm:text-lg text-neutral-300 hover:text-cream-300 transition-colors">
                    +1 (234) 567-890
                  </a>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 sm:mt-16 pt-8 sm:pt-10 border-t border-dark-border">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <p className="text-sm sm:text-base text-neutral-500 text-center sm:text-left">
              &copy; {new Date().getFullYear()} CardXC. All rights reserved.
            </p>
            <div className="flex items-center gap-6 sm:gap-8">
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <i className="ri-shield-check-line text-success-500"></i>
                <span>256-bit SSL</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <i className="ri-lock-2-line text-cream-300"></i>
                <span>PCI Compliant</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
