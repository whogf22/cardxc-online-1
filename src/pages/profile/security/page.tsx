import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../../../components/BottomNavigation';

interface ProfileData {
  two_factor_enabled: boolean;
}

export default function LoginSecurityPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await fetch('/api/user/profile', {
        credentials: 'include',
      });
      const data = await response.json();
      
      if (!data.success || !data.data?.user) {
        navigate('/signin');
        return;
      }

      setProfile(data.data.user);
    } catch (error) {
      console.error('[Security] Failed to load profile:', error);
      navigate('/signin');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <i className="ri-loader-4-line animate-spin text-4xl text-blue-500"></i>
      </div>
    );
  }

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
          <h1 className="text-xl font-semibold text-gray-900">Login & Security</h1>
        </div>
      </div>

      <div className="px-4 mt-6">
        <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
          <button className="w-full flex items-center justify-between px-4 py-4 border-b border-gray-100 hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <i className="ri-lock-password-line text-lg text-gray-600"></i>
              <span className="text-sm text-gray-800">Change Password</span>
            </div>
            <i className="ri-arrow-right-s-line text-lg text-gray-400"></i>
          </button>
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <i className="ri-shield-keyhole-line text-lg text-gray-600"></i>
              <span className="text-sm text-gray-800">Two-factor Authentication</span>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${profile?.two_factor_enabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
              {profile?.two_factor_enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
}
