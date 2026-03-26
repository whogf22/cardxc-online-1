import { AnimateOnScroll } from '../../../components/AnimateOnScroll';

export default function StatsSection() {
  const stats = [
    { value: '100%', label: 'Secure', icon: 'ri-shield-check-fill' },
    { value: '24/7', label: 'Support', icon: 'ri-customer-service-fill' },
    { value: '0%', label: 'Hidden Fees', icon: 'ri-money-dollar-circle-fill' },
    { value: 'Instant', label: 'Transfers', icon: 'ri-flashlight-fill' }
  ];

  return (
    <section className="py-14 sm:py-20 bg-[#030303] border-y border-white/[0.04] w-full overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 w-full">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 md:gap-10">
          {stats.map((stat, index) => (
            <AnimateOnScroll key={index} delay={index * 80}>
            <div className="text-center group">
              <div className="w-14 h-14 mx-auto mb-5 bg-lime-500/[0.08] rounded-2xl flex items-center justify-center border border-lime-500/10 group-hover:border-lime-500/20 group-hover:bg-lime-500/[0.12] group-hover:scale-110 transition-all duration-300">
                <i className={`${stat.icon} text-2xl text-lime-400`}></i>
              </div>
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-xs text-neutral-500 uppercase tracking-wider">{stat.label}</div>
            </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
