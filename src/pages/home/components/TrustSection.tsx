const badges = [
  { icon: 'ri-shield-check-fill', title: 'Bank-Level Security', description: '256-bit SSL encryption protects all your data' },
  { icon: 'ri-lock-fill', title: 'PCI Compliant', description: 'Level 1 PCI DSS certified payment processing' },
  { icon: 'ri-fingerprint-fill', title: '2FA Protection', description: 'Two-factor authentication on all accounts' },
  { icon: 'ri-eye-off-fill', title: '24/7 Monitoring', description: 'Real-time fraud detection and prevention' }
];

export default function TrustSection() {
  return (
    <section className="py-24 bg-[#030303]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/[0.08] rounded-full border border-emerald-500/20 mb-6">
            <i className="ri-shield-check-fill text-emerald-400 text-sm"></i>
            <span className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">Security</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
            Your Money is Safe
          </h2>
          <p className="text-lg text-neutral-400 max-w-xl mx-auto">
            Enterprise-grade security for your peace of mind
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {badges.map((badge, index) => (
            <div key={index} className="text-center p-6 bg-[#0d0d0d] rounded-2xl border border-white/[0.06] hover:border-emerald-500/20 transition-colors group">
              <div className="w-14 h-14 mx-auto mb-4 bg-emerald-500/[0.08] rounded-xl flex items-center justify-center border border-emerald-500/10 group-hover:border-emerald-500/20 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all">
                <i className={`${badge.icon} text-2xl text-emerald-400`}></i>
              </div>
              <h3 className="text-base font-semibold text-white mb-2">{badge.title}</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">{badge.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
