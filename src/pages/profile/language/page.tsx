import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const languages = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'zh', name: 'Chinese', native: '中文' },
];

export default function LanguagePage() {
  const navigate = useNavigate();
  const [selectedLang, setSelectedLang] = useState('en');

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
          <h1 className="text-xl font-semibold text-gray-900">Language & Translation</h1>
        </div>
      </div>

      <div className="px-4 mt-6">
        <h3 className="text-sm font-medium text-gray-600 mb-3">Select Language</h3>
        <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
          {languages.map((lang, index) => (
            <button
              key={lang.code}
              onClick={() => setSelectedLang(lang.code)}
              className={`w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 ${
                index !== languages.length - 1 ? 'border-b border-gray-100' : ''
              }`}
            >
              <div>
                <p className="text-sm text-gray-800">{lang.name}</p>
                <p className="text-xs text-gray-500">{lang.native}</p>
              </div>
              {selectedLang === lang.code && (
                <i className="ri-check-line text-lg text-blue-500"></i>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
