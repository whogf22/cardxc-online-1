import { testimonials } from '../../../mocks/testimonials';
import { useEffect, useRef, useState } from 'react';

export default function TestimonialsSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section id="testimonials" className="relative py-24 bg-dark-bg" ref={sectionRef}>
      <div className="max-w-7xl mx-auto px-6">
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}>
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-cream-300/10 rounded-full border border-cream-300/20 mb-6">
            <span className="text-cream-300 text-sm font-medium">Testimonials</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Trusted by Thousands
            <span className="block gradient-text mt-2">Across Nigeria</span>
          </h2>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
            See what our customers say about their trading experience
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div 
              key={index}
              className={`group dark-card-interactive p-6 transition-all duration-700 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-16'}`}
              style={{ transitionDelay: isVisible ? `${index * 100}ms` : '0ms' }}
            >
              <div className="flex items-center space-x-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <i key={i} className="ri-star-fill text-warning-400 text-lg"></i>
                ))}
              </div>

              <p className="text-neutral-300 leading-relaxed mb-6">
                "{testimonial.review}"
              </p>

              <div className="flex items-center space-x-3 pt-4 border-t border-dark-border">
                <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-cream-300/30">
                  {testimonial.image ? (
                    <img 
                      src={testimonial.image} 
                      alt={testimonial.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-cream-300 to-cream-500 flex items-center justify-center">
                      <span className="text-dark-bg font-bold text-lg">
                        {testimonial.name.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-white font-semibold">{testimonial.name}</div>
                  <div className="text-neutral-500 text-sm">{testimonial.location}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-8 p-6 dark-card">
            <div className="text-center px-4">
              <div className="text-4xl font-bold text-white mb-1">4.9/5</div>
              <div className="text-neutral-500 text-sm">Average Rating</div>
            </div>
            <div className="hidden sm:block w-px h-12 bg-dark-border"></div>
            <div className="text-center px-4">
              <div className="text-4xl font-bold text-white mb-1">2,000+</div>
              <div className="text-neutral-500 text-sm">Happy Customers</div>
            </div>
            <div className="hidden sm:block w-px h-12 bg-dark-border"></div>
            <div className="text-center px-4">
              <div className="text-4xl font-bold text-white mb-1">10K+</div>
              <div className="text-neutral-500 text-sm">Transactions</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
