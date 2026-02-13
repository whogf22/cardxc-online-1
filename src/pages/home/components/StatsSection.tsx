export default function StatsSection() {
  const stats = [
    { value: '100%', label: 'Secure', icon: 'ri-shield-check-fill' },
    { value: '24/7', label: 'Support', icon: 'ri-customer-service-fill' },
    { value: '0%', label: 'Hidden Fees', icon: 'ri-money-dollar-circle-fill' },
    { value: 'Instant', label: 'Transfers', icon: 'ri-flashlight-fill' }
  ];

  return (
    <section className="py-16 bg-[#030303] border-y border-white/[0.04]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center group">
              <div className="w-12 h-12 mx-auto mb-4 bg-lime-500/[0.08] rounded-xl flex items-center justify-center border border-lime-500/10 group-hover:border-lime-500/20 group-hover:bg-lime-500/[0.12] transition-all">
                <i className={`${stat.icon} text-xl text-lime-400`}></i>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-xs text-neutral-500 uppercase tracking-wider">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
