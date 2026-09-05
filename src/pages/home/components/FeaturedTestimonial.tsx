import { useEffect, useRef, useState } from 'react';

/**
 * Featured customer testimonial.
 *
 * COMPLIANCE: This component previously rendered a fabricated quote attributed to
 * a stock-photo "customer." Invented endorsements violate the FTC Act (15 U.S.C. 45)
 * and 16 CFR Part 465. It now renders nothing until a genuine, consented testimonial
 * is supplied.
 * [BUSINESS: provide a real, consented featured testimonial (quote + attribution) to enable.]
 */

// Populate only with a genuine, consented testimonial. Leave null to hide the section.
const featured: { quote: string; name: string; role: string; image?: string } | null = null;

export default function FeaturedTestimonial() {
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
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  if (!featured) {
    return null;
  }

  return (
    <section id="testimonials" className="relative py-24 bg-dark-card border-y border-dark-border overflow-hidden" ref={sectionRef}>
      <div className="relative max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            How Our Customers
            <span className="block mt-2 text-lime-400">Feel About CardXC</span>
          </h2>
        </div>

        <div className="flex justify-center">
          <div className={`relative max-w-2xl transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-20'}`}>
            <div className="absolute -left-8 -top-8 opacity-20">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
                <path d="M11.192 15.757c0-.88-.23-1.618-.69-2.217-.326-.412-.768-.683-1.327-.812-.55-.128-1.07-.137-1.54-.028-.16-.95.1-1.956.76-3.022.66-1.065 1.515-1.867 2.558-2.403L9.373 5c-.8.396-1.56.898-2.26 1.505-.71.607-1.34 1.305-1.9 2.094s-.98 1.68-1.25 2.69-.346 2.04-.217 3.1c.168 1.4.62 2.52 1.356 3.35.735.84 1.652 1.26 2.748 1.26.965 0 1.766-.29 2.4-.878.628-.576.94-1.365.94-2.368zm8.192 0c0-.88-.23-1.618-.69-2.217-.326-.412-.768-.683-1.327-.812-.55-.128-1.07-.137-1.54-.028-.16-.95.1-1.956.76-3.022.66-1.065 1.515-1.867 2.558-2.403L17.373 5c-.8.396-1.56.898-2.26 1.505-.71.607-1.34 1.305-1.9 2.094s-.98 1.68-1.25 2.69-.346 2.04-.217 3.1c.168 1.4.62 2.52 1.356 3.35.735.84 1.652 1.26 2.748 1.26.965 0 1.766-.29 2.4-.878.628-.576.94-1.365.94-2.368z" fill="currentColor" className="text-lime-400"/>
              </svg>
            </div>

            <div className="bg-dark-elevated rounded-3xl p-8 md:p-10 shadow-dark-elevated border border-dark-border relative">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-lime-400/10 rounded-2xl -z-10 transform rotate-6 border border-dark-border"></div>

              <p className="text-lg md:text-xl text-neutral-300 leading-relaxed mb-8">
                {featured.quote}
              </p>

              <div className="flex items-center gap-4">
                {featured.image && (
                  <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-lime-400/30">
                    <img
                      src={featured.image}
                      alt={featured.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div>
                  <div className="text-white font-semibold text-lg">{featured.name}</div>
                  <div className="text-neutral-400">{featured.role}</div>
                </div>
              </div>
            </div>

            <div className="absolute -right-8 -bottom-8 opacity-20 transform rotate-180">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
                <path d="M11.192 15.757c0-.88-.23-1.618-.69-2.217-.326-.412-.768-.683-1.327-.812-.55-.128-1.07-.137-1.54-.028-.16-.95.1-1.956.76-3.022.66-1.065 1.515-1.867 2.558-2.403L9.373 5c-.8.396-1.56.898-2.26 1.505-.71.607-1.34 1.305-1.9 2.094s-.98 1.68-1.25 2.69-.346 2.04-.217 3.1c.168 1.4.62 2.52 1.356 3.35.735.84 1.652 1.26 2.748 1.26.965 0 1.766-.29 2.4-.878.628-.576.94-1.365.94-2.368zm8.192 0c0-.88-.23-1.618-.69-2.217-.326-.412-.768-.683-1.327-.812-.55-.128-1.07-.137-1.54-.028-.16-.95.1-1.956.76-3.022.66-1.065 1.515-1.867 2.558-2.403L17.373 5c-.8.396-1.56.898-2.26 1.505-.71.607-1.34 1.305-1.9 2.094s-.98 1.68-1.25 2.69-.346 2.04-.217 3.1c.168 1.4.62 2.52 1.356 3.35.735.84 1.652 1.26 2.748 1.26.965 0 1.766-.29 2.4-.878.628-.576.94-1.365.94-2.368z" fill="currentColor" className="text-lime-400"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
