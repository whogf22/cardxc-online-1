export default function ValuesSection() {
  const values = [
    {
      icon: 'ri-exchange-line',
      title: 'Transparency',
      description: 'We value your trust, which is why we strive to keep you informed every step of the way.'
    },
    {
      icon: 'ri-award-line',
      title: 'Credibility',
      description: 'We take pride in our track record of delivering exceptional results and earning the trust of our clients.'
    },
    {
      icon: 'ri-checkbox-circle-line',
      title: 'Reliability',
      description: 'We understand the importance of providing solutions that you can count on.'
    },
    {
      icon: 'ri-shield-star-line',
      title: 'Trust & Security',
      description: 'Your data and funds are safeguarded with the highest standards.'
    }
  ];

  return (
    <section className="relative py-24 bg-dark-bg">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-16">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-cream-300/10 rounded-full border border-cream-300/20 mb-6">
            <span className="text-cream-300 text-sm font-medium">Our Values</span>
          </div>
          <p className="text-xl text-neutral-300 leading-relaxed max-w-3xl">
            Our team is IGNITED. With us, you see a fine blend of innovation, ingenuity, and hard work, because we want to provide you with efficient and dependable solutions. Our culture of Transparency, credibility, and reliability heralds our business success.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {values.map((value, index) => (
            <div 
              key={index}
              className="group flex items-start gap-5 p-6 rounded-2xl hover:bg-dark-card transition-all duration-300"
            >
              <div className="w-14 h-14 bg-dark-card group-hover:bg-dark-elevated rounded-2xl flex items-center justify-center flex-shrink-0 transition-all">
                <i className={`${value.icon} text-2xl text-cream-300`}></i>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">{value.title}</h3>
                <p className="text-neutral-400 leading-relaxed">{value.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
