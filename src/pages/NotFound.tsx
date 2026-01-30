import { useNavigate, useLocation } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-sky-50 px-4">
      <div className="max-w-lg w-full text-center animate-fade-in">
        <div className="relative mb-8">
          <span className="text-[10rem] sm:text-[14rem] font-black text-slate-100 select-none leading-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 bg-gradient-to-br from-sky-100 to-sky-50 rounded-3xl flex items-center justify-center shadow-lg shadow-sky-100">
              <i className="ri-compass-discover-line text-5xl text-sky-500"></i>
            </div>
          </div>
        </div>
        
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
          Page Not Found
        </h1>
        
        <p className="text-slate-600 mb-2 leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <p className="text-sm text-slate-400 font-mono mb-8 bg-slate-100 px-4 py-2 rounded-lg inline-block">
          {location.pathname}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate('/')}
            className="px-8 py-4 bg-sky-600 text-white rounded-xl font-semibold hover:bg-sky-700 transition-all cursor-pointer whitespace-nowrap shadow-lg shadow-sky-600/20 hover:shadow-xl hover:shadow-sky-600/30 touch-target"
          >
            <span className="flex items-center justify-center gap-2">
              <i className="ri-home-line"></i>
              Go to Home
            </span>
          </button>
          
          <button
            onClick={() => navigate(-1)}
            className="px-8 py-4 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-all cursor-pointer whitespace-nowrap touch-target"
          >
            <span className="flex items-center justify-center gap-2">
              <i className="ri-arrow-left-line"></i>
              Go Back
            </span>
          </button>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200">
          <p className="text-sm text-slate-500 mb-4">Looking for something specific?</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="/dashboard" className="text-sm text-sky-600 hover:text-sky-700 hover:underline">Dashboard</a>
            <span className="text-slate-300">•</span>
            <a href="/wallet" className="text-sm text-sky-600 hover:text-sky-700 hover:underline">Payment Account</a>
            <span className="text-slate-300">•</span>
            <a href="/signin" className="text-sm text-sky-600 hover:text-sky-700 hover:underline">Sign In</a>
          </div>
        </div>
      </div>
    </div>
  );
}