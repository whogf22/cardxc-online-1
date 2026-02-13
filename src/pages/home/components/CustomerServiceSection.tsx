import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_TEL, SUPPORT_WHATSAPP_URL } from '../../../lib/contactPlaceholders';

interface CustomerServiceSectionProps {
  /** Opens the contact modal when provided (e.g. from homepage) */
  onOpenContact?: () => void;
}

export default function CustomerServiceSection({ onOpenContact }: CustomerServiceSectionProps) {
  const supportChannels = [
    {
      icon: 'ri-whatsapp-line',
      title: 'WhatsApp Support',
      description: SUPPORT_PHONE,
      action: 'Message Us',
      link: SUPPORT_WHATSAPP_URL,
      color: 'from-success-500 to-success-600'
    },
    {
      icon: 'ri-mail-line',
      title: 'Email Support',
      description: SUPPORT_EMAIL,
      action: 'Send Email',
      link: `mailto:${SUPPORT_EMAIL}`,
      color: 'from-primary-400 to-primary-600'
    },
    {
      icon: 'ri-phone-line',
      title: 'Phone Support',
      description: SUPPORT_PHONE,
      action: 'Call Now',
      link: SUPPORT_PHONE_TEL,
      color: 'from-lime-500 to-lime-700'
    }
  ];

  return (
    <section id="contact" className="relative py-24 bg-dark-bg">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-lime-400/10 rounded-full border border-lime-400/20 mb-6">
            <span className="text-lime-400 text-sm font-medium">Customer Support</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            We're Here to Help
            <span className="block gradient-text mt-2">24/7 Support</span>
          </h2>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
            Our dedicated support team is always ready to assist you with any questions
          </p>
          {onOpenContact && (
            <div className="mt-6">
              <button
                type="button"
                onClick={onOpenContact}
                className="inline-flex items-center gap-2 px-6 py-3 bg-lime-500 text-black font-semibold rounded-xl shadow-glow-sm hover:shadow-glow hover:scale-105 active:scale-100 transition-all duration-300"
              >
                <i className="ri-mail-send-line text-lg" aria-hidden />
                Get in Touch
              </button>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {supportChannels.map((channel, index) => (
            <a
              key={index}
              href={channel.link}
              target={channel.link.startsWith('http') ? '_blank' : undefined}
              rel={channel.link.startsWith('https') ? 'noopener noreferrer' : undefined}
              className="group dark-card-interactive p-8 text-center"
            >
              <div className={`w-16 h-16 bg-gradient-to-br ${channel.color} rounded-2xl flex items-center justify-center mx-auto mb-6`}>
                <i className={`${channel.icon} text-3xl text-white`}></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{channel.title}</h3>
              <p className="text-neutral-400 mb-6">{channel.description}</p>
              <div className="inline-flex items-center space-x-2 text-lime-400 font-semibold group-hover:translate-x-1 transition-transform">
                <span>{channel.action}</span>
                <i className="ri-arrow-right-line"></i>
              </div>
            </a>
          ))}
        </div>

        <div className="p-8 bg-gradient-to-br from-dark-elevated to-dark-card rounded-3xl border border-dark-border">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-3xl font-bold text-white mb-4">
                Quick Response Time
              </h3>
              <p className="text-neutral-400 leading-relaxed mb-6">
                Our average response time is under 2 minutes. We're committed to resolving your issues quickly and efficiently.
              </p>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-lime-400/10 rounded-lg flex items-center justify-center">
                    <i className="ri-check-line text-lime-400"></i>
                  </div>
                  <span className="text-neutral-300">Average response under 2 minutes</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-lime-400/10 rounded-lg flex items-center justify-center">
                    <i className="ri-check-line text-lime-400"></i>
                  </div>
                  <span className="text-neutral-300">Available 24/7 every day</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-lime-400/10 rounded-lg flex items-center justify-center">
                    <i className="ri-check-line text-lime-400"></i>
                  </div>
                  <span className="text-neutral-300">Friendly and professional team</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-6 dark-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-semibold">Response Time</span>
                  <span className="text-lime-400 font-bold">&lt; 2 min</span>
                </div>
                <div className="w-full bg-dark-border rounded-full h-2">
                  <div className="bg-lime-500 h-2 rounded-full" style={{ width: '95%' }}></div>
                </div>
              </div>

              <div className="p-6 dark-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-semibold">Customer Satisfaction</span>
                  <span className="text-lime-400 font-bold">98%</span>
                </div>
                <div className="w-full bg-dark-border rounded-full h-2">
                  <div className="bg-lime-500 h-2 rounded-full" style={{ width: '98%' }}></div>
                </div>
              </div>

              <div className="p-6 dark-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-semibold">Issue Resolution</span>
                  <span className="text-lime-400 font-bold">99%</span>
                </div>
                <div className="w-full bg-dark-border rounded-full h-2">
                  <div className="bg-lime-500 h-2 rounded-full" style={{ width: '99%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
