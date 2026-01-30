export default function StatsSection() {
  const stats = [
    {
      icon: 'ri-shield-check-line',
      value: '100%',
      label: 'Secure Transactions',
      description: 'Bank-level encryption',
      color: 'text-success-400'
    },
    {
      icon: 'ri-time-line',
      value: '5 Min',
      label: 'Average Payout',
      description: 'Lightning fast transfers',
      color: 'text-primary-400'
    },
    {
      icon: 'ri-star-line',
      value: '4.9/5',
      label: 'Customer Rating',
      description: 'From 2,000+ reviews',
      color: 'text-cream-300'
    },
    {
      icon: 'ri-customer-service-2-line',
      value: '24/7',
      label: 'Support Available',
      description: 'Always here to help',
      color: 'text-warning-400'
    }
  ];

  return (
    <section className="relative py-20 bg-dark-card border-t border-dark-border">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center group">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-dark-elevated group-hover:bg-cream-300/10 rounded-2xl mb-4 transition-all border border-dark-border group-hover:border-cream-300/20">
                <i className={`${stat.icon} text-3xl ${stat.color}`}></i>
              </div>
              <div className="text-4xl font-bold text-white mb-2">{stat.value}</div>
              <div className="text-white font-medium mb-1">{stat.label}</div>
              <div className="text-sm text-neutral-400">{stat.description}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
