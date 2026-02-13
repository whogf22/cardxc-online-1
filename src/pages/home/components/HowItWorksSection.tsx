import { useNavigate } from 'react-router-dom';

const steps = [
  {
    number: '01',
    title: 'Create Account',
    description: 'Sign up in 2 minutes with just your email. No paperwork required.',
    icon: 'ri-user-add-line'
  },
  {
    number: '02',
    title: 'Add Money',
    description: 'Fund your wallet via bank transfer, card, or other payment methods.',
    icon: 'ri-add-circle-line'
  },
  {
    number: '03',
    title: 'Send Anywhere',
    description: 'Transfer money globally with real-time rates and instant delivery.',
    icon: 'ri-send-plane-line'
  }
];

export default function HowItWorksSection() {
  const navigate = useNavigate();

  return (
    <section id="how-it-works" className="py-24 bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-lime-500/[0.08] rounded-full border border-lime-500/20 mb-6">
            <span className="text-lime-400 text-xs font-semibold uppercase tracking-wider">How It Works</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
            Start in 3 Steps
          </h2>
          <p className="text-lg text-neutral-400">
            Start sending money in minutes
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {steps.map((step, index) => (
            <div key={index} className="relative text-center group">
              <div className="w-16 h-16 mx-auto mb-6 bg-lime-500 rounded-2xl flex items-center justify-center shadow-glow-sm group-hover:shadow-lime-glow transition-shadow">
                <i className={`${step.icon} text-2xl text-black`}></i>
              </div>
              <div className="text-[11px] font-bold text-lime-400 mb-2 uppercase tracking-[0.2em]">Step {step.number}</div>
              <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
              <p className="text-neutral-400 text-sm leading-relaxed max-w-xs mx-auto">{step.description}</p>
              
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[calc(50%+4rem)] w-[calc(100%-8rem)] h-px bg-gradient-to-r from-lime-500/30 to-transparent"></div>
              )}
            </div>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate('/signup')}
            className="px-10 py-4 bg-lime-500 text-black font-bold rounded-xl hover:bg-lime-400 transition-all shadow-lime-glow hover:shadow-glow text-[15px]"
          >
            Get Started Now
            <i className="ri-arrow-right-line ml-2"></i>
          </button>
        </div>
      </div>
    </section>
  );
}
