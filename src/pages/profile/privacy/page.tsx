import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function PrivacySharingPage() {
  const navigate = useNavigate();
  const [shareActivity, setShareActivity] = useState(false);
  const [shareAnalytics, setShareAnalytics] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white px-4 pt-12 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/profile')}
            className="w-10 h-10 flex items-center justify-center"
          >
            <i className="ri-arrow-left-s-line text-2xl text-gray-800"></i>
          </button>
          <h1 className="text-xl font-semibold text-gray-900">Privacy & Sharing</h1>
        </div>
      </div>

      <div className="px-4 mt-6">
        <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
            <div>
              <p className="text-sm text-gray-800">Share activity status</p>
              <p className="text-xs text-gray-500">Let others see when you're active</p>
            </div>
            <button
              onClick={() => setShareActivity(!shareActivity)}
              className={`w-12 h-7 rounded-full transition-colors relative ${shareActivity ? 'bg-blue-500' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${shareActivity ? 'right-1' : 'left-1'}`}></span>
            </button>
          </div>
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
            <div>
              <p className="text-sm text-gray-800">Share analytics data</p>
              <p className="text-xs text-gray-500">Help improve our services</p>
            </div>
            <button
              onClick={() => setShareAnalytics(!shareAnalytics)}
              className={`w-12 h-7 rounded-full transition-colors relative ${shareAnalytics ? 'bg-blue-500' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${shareAnalytics ? 'right-1' : 'left-1'}`}></span>
            </button>
          </div>
          <button className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50">
            <span className="text-sm text-gray-800">Data download</span>
            <i className="ri-arrow-right-s-line text-lg text-gray-400"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
