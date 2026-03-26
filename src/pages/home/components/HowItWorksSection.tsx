import { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';

const steps = [
  {
    number: '01',
    title: 'Create Account',
    description: 'Sign up in 2 minutes with just your email. No paperwork required.',
    icon: 'ri-user-add-line',
    gradient: 'from-lime-500 to-emerald-500',
  },
  {
    number: '02',
    title: 'Add Money',
    description: 'Fund your wallet via bank transfer, card, or other payment methods.',
    icon: 'ri-add-circle-line',
    gradient: 'from-cyan-500 to-blue-500',
  },
  {
    number: '03',
    title: 'Send Anywhere',
    description: 'Transfer money globally with real-time rates and instant delivery.',
    icon: 'ri-send-plane-line',
    path: '/transfer',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    number: '04',
    title: 'Gift Card Buy',
    description: 'Buy gift cards from Amazon, Netflix, Spotify and 700+ brands instantly.',
    icon: 'ri-gift-2-line',
    path: '/giftcards',
    gradient: 'from-violet-500 to-purple-500',
  }
];

export default function HowItWorksSection() {
  const navigate = useNavigate();

  return (
    <section id="how-it-works" className="py-14 sm:py-16 lg:py-20 bg-[#030303] w-full overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-lime-500/[0.08] rounded-full border border-lime-500/20 mb-6">
            <span className="text-lime-400 text-xs font-semibold uppercase tracking-wider">How It Works</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
            Start in 4 Steps
          </h2>
          <p className="text-lg text-neutral-400 max-w-xl mx-auto">
            Start sending money in minutes
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
          {steps.slice(0, 2).map((step, index) => (
            <div
              key={index}
              className="relative group p-6 sm:p-7 bg-[#0d0d0d] rounded-2xl border border-white/[0.06] hover:border-white/[0.1] hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="text-center">
                <div className={`w-14 h-14 mx-auto mb-5 bg-gradient-to-br ${step.gradient} rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-[1.03] transition-transform duration-200`}>
                  <i className={`${step.icon} text-2xl text-white`}></i>
                </div>
                <span className="inline-block px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10px] font-bold text-lime-400 uppercase tracking-[0.2em] mb-4">
                  Step {step.number}
                </span>
                <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
                <p className="text-neutral-400 text-sm leading-relaxed max-w-xs mx-auto">{step.description}</p>
              </div>
              {index < 1 && (
                <div className="hidden lg:block absolute top-1/2 -translate-y-1/2 left-full w-6 h-px bg-gradient-to-r from-lime-500/50 to-transparent"></div>
              )}
              {index === 1 && (
                <div className="hidden lg:flex flex-col justify-between absolute top-1/3 bottom-1/3 left-full w-6 gap-2">
                  <i className="ri-arrow-right-line text-lime-400/50 text-base"></i>
                  <i className="ri-arrow-right-line text-lime-400/50 text-base"></i>
                </div>
              )}
            </div>
          ))}
          <div className="sm:col-span-2 lg:col-span-1 flex flex-col gap-6">
            {steps.slice(2, 4).map((step, index) => (
              <Fragment key={index}>
                {index === 1 && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                    <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-widest">or</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                  </div>
                )}
                <div
                  className="relative group cursor-pointer flex-1 p-6 sm:p-7 bg-[#0d0d0d] rounded-2xl border border-white/[0.06] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_0_24px_rgba(132,204,22,0.12)] hover:border-lime-400/25"
                  onClick={() => navigate(step.path!)}
                  role="button"
                >
                  <div className="text-center">
                    <div className={`w-14 h-14 mx-auto mb-5 bg-gradient-to-br ${step.gradient} rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-[1.03] transition-transform duration-200`}>
                      <i className={`${step.icon} text-2xl text-white`}></i>
                    </div>
                    <span className="inline-block px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10px] font-bold text-lime-400 uppercase tracking-[0.2em] mb-4">
                      Step {step.number}
                    </span>
                    <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
                    <p className="text-neutral-400 text-sm leading-relaxed max-w-xs mx-auto mb-4">{step.description}</p>
                    <span className="inline-flex items-center gap-1.5 text-lime-400 text-xs font-medium opacity-80 group-hover:opacity-100 group-hover:gap-2 transition-all">
                      Get started <i className="ri-arrow-right-line"></i>
                    </span>
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate('/signup')}
            className="px-10 py-4 bg-lime-500 text-black font-bold rounded-xl hover:bg-lime-400 transition-all shadow-glow-sm hover:shadow-glow text-[15px]"
          >
            Get Started Now
            <i className="ri-arrow-right-line ml-2"></i>
          </button>
        </div>
      </div>
    </section>
  );
}
