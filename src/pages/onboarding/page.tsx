import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const slides = [
  {
    id: 1,
    title: 'Pay for everything easily and conveniently!',
    description: 'Handle all your payments easily, anytime, from one secure app.',
    illustration: (
      <div className="relative w-64 h-64 mx-auto">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <div className="w-40 h-24 bg-fintech-500 rounded-xl transform -rotate-12 shadow-lg flex items-center justify-center">
              <i className="ri-visa-fill text-white text-4xl"></i>
            </div>
            <div className="absolute -bottom-4 -right-8 w-36 h-20 bg-gray-800 rounded-xl transform rotate-6 shadow-lg flex items-center justify-center">
              <i className="ri-mastercard-fill text-white text-3xl"></i>
            </div>
            <div className="absolute -top-8 -right-4 w-12 h-16 bg-fintech-400 rounded-lg transform rotate-12 flex items-center justify-center shadow-md">
              <i className="ri-money-dollar-circle-line text-white text-xl"></i>
            </div>
            <div className="absolute -bottom-8 -left-8">
              <svg className="w-16 h-16 text-fintech-300" fill="none" viewBox="0 0 64 64">
                <path d="M32 8c-6 0-12 6-12 12 0 4 4 8 8 12s8 12 8 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M28 16c4-4 8-4 12 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <ellipse cx="32" cy="56" rx="16" ry="4" fill="currentColor" opacity="0.2"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 2,
    title: 'Set Up Your Fingerprint',
    description: 'Add your fingerprint to protect your account and keep your transactions safe.',
    illustration: (
      <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
        <div className="relative">
          <svg className="w-48 h-48 text-fintech-500" viewBox="0 0 100 100" fill="none">
            <path d="M50 10C30 10 15 30 15 50s15 40 35 40c5 0 10-1 15-3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.3"/>
            <path d="M50 20C35 20 25 35 25 50s10 30 25 30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.5"/>
            <path d="M50 30C40 30 35 40 35 50s5 20 15 20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.7"/>
            <path d="M50 40C45 40 42 45 42 50s3 10 8 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
            <circle cx="50" cy="50" r="3" fill="currentColor"/>
          </svg>
        </div>
      </div>
    ),
  },
  {
    id: 3,
    title: 'Transfer Money Instantly',
    description: 'Send and receive money instantly with zero fees to anyone, anywhere.',
    illustration: (
      <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-fintech-100 rounded-full flex items-center justify-center">
            <i className="ri-user-fill text-fintech-600 text-2xl"></i>
          </div>
          <div className="flex flex-col items-center">
            <i className="ri-arrow-right-line text-fintech-500 text-2xl animate-pulse"></i>
            <div className="w-12 h-8 bg-fintech-500 rounded-lg flex items-center justify-center mt-1">
              <span className="text-white text-xs font-bold">$$$</span>
            </div>
          </div>
          <div className="w-16 h-16 bg-fintech-100 rounded-full flex items-center justify-center">
            <i className="ri-user-fill text-fintech-600 text-2xl"></i>
          </div>
        </div>
      </div>
    ),
  },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      navigate('/signup');
    }
  };

  const handleSkip = () => {
    navigate('/signin');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 flex flex-col px-6 pt-12 pb-8">
        <div className="flex-1 flex flex-col justify-center">
          <div className="bg-fintech-50 rounded-3xl p-8 mb-12">
            {slides[currentSlide].illustration}
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              {slides[currentSlide].title}
            </h1>
            <p className="text-gray-500">
              {slides[currentSlide].description}
            </p>
          </div>

          <div className="flex justify-center gap-2 mb-12">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`transition-all duration-300 rounded-full ${
                  index === currentSlide
                    ? 'w-8 h-2 bg-fintech-500'
                    : 'w-2 h-2 bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleNext}
            className="w-full py-4 bg-fintech-500 hover:bg-fintech-600 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-fintech-500/25"
          >
            {currentSlide === slides.length - 1 ? 'Get Started' : 'Continue'}
          </button>
          
          {currentSlide < slides.length - 1 && (
            <button
              onClick={handleSkip}
              className="w-full py-4 text-gray-500 font-medium hover:text-gray-700 transition-colors"
            >
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
