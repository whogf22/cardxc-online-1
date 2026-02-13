import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AccessibilityPage() {
  const navigate = useNavigate();
  const [voiceControls, setVoiceControls] = useState(true);
  const [zoomControls, setZoomControls] = useState(false);

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
          <h1 className="text-xl font-semibold text-gray-900">Accessibility</h1>
        </div>
      </div>

      <div className="px-4 mt-6">
        <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
            <span className="text-sm text-gray-800">Voice controls</span>
            <button
              onClick={() => setVoiceControls(!voiceControls)}
              className={`w-12 h-7 rounded-full transition-colors relative ${voiceControls ? 'bg-blue-500' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${voiceControls ? 'right-1' : 'left-1'}`}></span>
            </button>
          </div>
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
            <span className="text-sm text-gray-800">Zoom controls</span>
            <button
              onClick={() => setZoomControls(!zoomControls)}
              className={`w-12 h-7 rounded-full transition-colors relative ${zoomControls ? 'bg-blue-500' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${zoomControls ? 'right-1' : 'left-1'}`}></span>
            </button>
          </div>
          <button className="w-full flex items-center justify-between px-4 py-4 border-b border-gray-100 hover:bg-gray-50">
            <span className="text-sm text-gray-800">Screen reader compatibility</span>
            <i className="ri-arrow-right-s-line text-lg text-gray-400"></i>
          </button>
          <button className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50">
            <span className="text-sm text-gray-800">Font size adjustments</span>
            <i className="ri-arrow-right-s-line text-lg text-gray-400"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
