import { useNavigate, useParams } from 'react-router-dom';
import { getFeatureBySlug } from '../../data/features';
import CalculatorSection from '../home/components/CalculatorSection';

export default function FeaturePage() {
  const navigate = useNavigate();
  const { featureId } = useParams<{ featureId: string }>();
  const feature = featureId ? getFeatureBySlug(featureId) : undefined;

  if (!feature) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Feature not found</h1>
          <button
            onClick={() => navigate('/')}
            className="text-lime-400 hover:text-lime-300 font-medium"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const isCalculator = feature.slug === 'fee-calculator';

  return (
    <div className="min-h-screen bg-dark-bg">
      <header className="fixed top-0 left-0 right-0 z-50 bg-dark-bg/95 backdrop-blur-xl border-b border-dark-border">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <button
              onClick={() => navigate('/#features')}
              className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors touch-target"
              aria-label="Back to features"
            >
              <i className="ri-arrow-left-line text-xl"></i>
              <span className="font-medium">Back to Features</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-3"
              aria-label="CardXC Home"
            >
              <div className="w-10 h-10 bg-lime-500 rounded-xl flex items-center justify-center">
                <i className="ri-wallet-3-line text-lg text-black"></i>
              </div>
              <span className="text-lg font-bold text-white">CardXC</span>
            </button>
          </div>
        </div>
      </header>

      <main className="pt-16 sm:pt-20 pb-24">
        {isCalculator ? (
          <CalculatorSection />
        ) : (
          <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 py-12 lg:py-20">
            <div className="mb-10">
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br ${feature.gradient} mb-8 shadow-3d-depth`}>
                <i className={`${feature.icon} text-4xl text-white`}></i>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4">
                {feature.fullTitle ?? feature.title}
              </h1>
              <p className="text-xl text-neutral-400 leading-relaxed mb-8">
                {feature.description}
              </p>
            </div>

            <div className="prose prose-invert max-w-none">
              <p className="text-lg text-neutral-300 leading-relaxed mb-10">
                {feature.fullDescription}
              </p>

              {feature.points && feature.points.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-white mb-6">What you get</h2>
                  <ul className="space-y-4">
                    {feature.points.map((point, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 text-neutral-300"
                      >
                        <span className={`flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br ${feature.gradient} flex items-center justify-center mt-0.5`}>
                          <i className="ri-check-line text-white text-sm"></i>
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-16 flex flex-wrap gap-4">
              <button
                onClick={() => navigate('/signup')}
                className="px-8 py-4 bg-lime-500 text-black font-semibold rounded-xl shadow-glow-sm hover:shadow-glow hover:scale-[1.02] active:scale-100 transition-all"
              >
                Get Started
              </button>
              <button
                onClick={() => navigate('/#features')}
                className="px-8 py-4 bg-dark-card border border-dark-border text-white font-semibold rounded-xl hover:bg-dark-elevated transition-colors"
              >
                View All Features
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
