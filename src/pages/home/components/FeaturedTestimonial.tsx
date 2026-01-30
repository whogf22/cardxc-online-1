import { useEffect, useRef, useState } from 'react';

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

  return (
    <section className="relative py-24 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 overflow-hidden" ref={sectionRef}>

      <div className="relative max-w-7xl mx-auto px-6">
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            How Our Customers
            <span className="block mt-2">Feel About CardXC</span>
          </h2>
        </div>

        <div className="flex justify-center">
          <div className={`relative max-w-2xl transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-20'}`}>
            <div className="absolute -left-8 -top-8 opacity-30">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
                <path d="M11.192 15.757c0-.88-.23-1.618-.69-2.217-.326-.412-.768-.683-1.327-.812-.55-.128-1.07-.137-1.54-.028-.16-.95.1-1.956.76-3.022.66-1.065 1.515-1.867 2.558-2.403L9.373 5c-.8.396-1.56.898-2.26 1.505-.71.607-1.34 1.305-1.9 2.094s-.98 1.68-1.25 2.69-.346 2.04-.217 3.1c.168 1.4.62 2.52 1.356 3.35.735.84 1.652 1.26 2.748 1.26.965 0 1.766-.29 2.4-.878.628-.576.94-1.365.94-2.368zm8.192 0c0-.88-.23-1.618-.69-2.217-.326-.412-.768-.683-1.327-.812-.55-.128-1.07-.137-1.54-.028-.16-.95.1-1.956.76-3.022.66-1.065 1.515-1.867 2.558-2.403L17.373 5c-.8.396-1.56.898-2.26 1.505-.71.607-1.34 1.305-1.9 2.094s-.98 1.68-1.25 2.69-.346 2.04-.217 3.1c.168 1.4.62 2.52 1.356 3.35.735.84 1.652 1.26 2.748 1.26.965 0 1.766-.29 2.4-.878.628-.576.94-1.365.94-2.368z" fill="white"/>
              </svg>
            </div>

            <div className="bg-white rounded-3xl p-8 md:p-10 shadow-2xl relative">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-600 rounded-2xl -z-10 transform rotate-6"></div>
              
              <p className="text-lg md:text-xl text-gray-700 leading-relaxed mb-8">
                I recently used CardXC to manage my international payments, and I was genuinely impressed by how efficient the entire process was. CardXC delivered exactly what it promised, and did so in a way that made the entire experience smooth and efficient. It's clear that a lot of thought has gone into building a system that respects both the user's time and expectations.
              </p>

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-blue-200">
                  <img 
                    src="/images/testimonials/featured-person.jpg" 
                    alt="Sarah M."
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="text-gray-900 font-semibold text-lg">Sarah M.</div>
                  <div className="text-gray-500">CardXC User</div>
                </div>
              </div>
            </div>

            <div className="absolute -right-8 -bottom-8 opacity-30 transform rotate-180">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
                <path d="M11.192 15.757c0-.88-.23-1.618-.69-2.217-.326-.412-.768-.683-1.327-.812-.55-.128-1.07-.137-1.54-.028-.16-.95.1-1.956.76-3.022.66-1.065 1.515-1.867 2.558-2.403L9.373 5c-.8.396-1.56.898-2.26 1.505-.71.607-1.34 1.305-1.9 2.094s-.98 1.68-1.25 2.69-.346 2.04-.217 3.1c.168 1.4.62 2.52 1.356 3.35.735.84 1.652 1.26 2.748 1.26.965 0 1.766-.29 2.4-.878.628-.576.94-1.365.94-2.368zm8.192 0c0-.88-.23-1.618-.69-2.217-.326-.412-.768-.683-1.327-.812-.55-.128-1.07-.137-1.54-.028-.16-.95.1-1.956.76-3.022.66-1.065 1.515-1.867 2.558-2.403L17.373 5c-.8.396-1.56.898-2.26 1.505-.71.607-1.34 1.305-1.9 2.094s-.98 1.68-1.25 2.69-.346 2.04-.217 3.1c.168 1.4.62 2.52 1.356 3.35.735.84 1.652 1.26 2.748 1.26.965 0 1.766-.29 2.4-.878.628-.576.94-1.365.94-2.368z" fill="white"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
