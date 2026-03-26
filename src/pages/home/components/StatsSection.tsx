import { useEffect, useRef, useState } from 'react';

function AnimatedCounter({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 2000;
          const startTime = performance.now();
          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div ref={ref} className="text-3xl sm:text-4xl md:text-5xl font-bold" style={{ color: '#FFD700', fontFamily: "'Space Grotesk', sans-serif" }}>
      {prefix}{count.toLocaleString()}{suffix}
    </div>
  );
}

export default function StatsSection() {
  const stats = [
    { target: 500000, suffix: '+', label: 'Cards Sent' },
    { target: 12, prefix: '$', suffix: 'M+', label: 'in Gifts Delivered' },
    { target: 98, suffix: '.9%', label: 'Customer Satisfaction' },
  ];

  return (
    <section className="relative py-6 overflow-hidden" style={{ background: '#0A0A0F' }}>
      <div
        className="relative rounded-2xl mx-4 sm:mx-6 lg:mx-auto max-w-7xl py-8 sm:py-10 px-6"
        style={{
          background: 'rgba(255,255,255,0.02)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-4 text-center">
          {stats.map((stat, i) => (
            <div key={i} className="space-y-2">
              <AnimatedCounter target={stat.target} suffix={stat.suffix} prefix={stat.prefix || ''} />
              <div className="text-sm text-neutral-400 uppercase tracking-wider">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
