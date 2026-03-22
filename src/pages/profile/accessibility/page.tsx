import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AccessibilityPage() {
  const navigate = useNavigate();
  const [voiceControls, setVoiceControls] = useState(true);
  const [zoomControls, setZoomControls] = useState(false);

  return (
    <div className="min-h-screen bg-dark-bg pb-24">
      <div className="bg-dark-card px-4 pt-12 pb-4 border-b border-dark-border">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/profile')}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-dark-elevated transition-colors"
          >
            <i className="ri-arrow-left-s-line text-2xl text-neutral-300"></i>
          </button>
          <h1 className="text-xl font-semibold text-white">Accessibility</h1>
        </div>
      </div>

      <div className="px-4 mt-6">
        <div className="bg-dark-card rounded-2xl overflow-hidden border border-dark-border">
          <div className="flex items-center justify-between px-4 py-4 border-b border-dark-border">
            <span className="text-sm text-white">Voice controls</span>
            <button
              onClick={() => setVoiceControls(!voiceControls)}
              className={`w-12 h-7 rounded-full transition-colors relative ${voiceControls ? 'bg-lime-500' : 'bg-dark-elevated'}`}
            >
              <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${voiceControls ? 'right-1' : 'left-1'}`}></span>
            </button>
          </div>
          <div className="flex items-center justify-between px-4 py-4 border-b border-dark-border">
            <span className="text-sm text-white">Zoom controls</span>
            <button
              onClick={() => setZoomControls(!zoomControls)}
              className={`w-12 h-7 rounded-full transition-colors relative ${zoomControls ? 'bg-lime-500' : 'bg-dark-elevated'}`}
            >
              <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${zoomControls ? 'right-1' : 'left-1'}`}></span>
            </button>
          </div>
          <button className="w-full flex items-center justify-between px-4 py-4 border-b border-dark-border hover:bg-dark-elevated transition-colors">
            <span className="text-sm text-white">Screen reader compatibility</span>
            <i className="ri-arrow-right-s-line text-lg text-neutral-500"></i>
          </button>
          <button className="w-full flex items-center justify-between px-4 py-4 hover:bg-dark-elevated transition-colors">
            <span className="text-sm text-white">Font size adjustments</span>
            <i className="ri-arrow-right-s-line text-lg text-neutral-500"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
