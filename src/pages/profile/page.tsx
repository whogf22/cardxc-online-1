import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../contexts/AuthContext';

interface ProfileData {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  country: string;
  created_at: string;
  kyc_status: string;
  account_status: string;
  two_factor_enabled: boolean;
}

interface MenuItem {
  icon: string;
  label: string;
  path: string;
}

const settingsMenuItems: MenuItem[] = [
  { icon: 'ri-user-line', label: 'Personal information', path: '/profile/personal' },
  { icon: 'ri-bank-card-line', label: 'Payments information', path: '/profile/payments' },
  { icon: 'ri-lock-line', label: 'Login & security', path: '/profile/security' },
  { icon: 'ri-accessibility-line', label: 'Accessibility', path: '/profile/accessibility' },
  { icon: 'ri-translate-2', label: 'Language & translation', path: '/profile/language' },
  { icon: 'ri-notification-3-line', label: 'Notifications', path: '/profile/notifications' },
  { icon: 'ri-shield-check-line', label: 'Privacy & sharing', path: '/profile/privacy' },
];

const supportMenuItems: MenuItem[] = [
  { icon: 'ri-question-line', label: 'Help center', path: '/support' },
  { icon: 'ri-flag-line', label: 'Report a problem', path: '/support' },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { signOut } = useAuthContext();
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
      console.error('[ProfilePage] Failed to load profile:', error);
      navigate('/signin');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/', { replace: true });
    } catch (error) {
      console.error('[ProfilePage] Failed to log out:', error);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const isPro = profile?.kyc_status === 'approved';

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <i className="ri-loader-4-line animate-spin text-4xl text-blue-500"></i>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 flex items-center justify-center"
          >
            <i className="ri-arrow-left-s-line text-2xl text-gray-800"></i>
          </button>
          <h1 className="text-xl font-semibold text-gray-900">Profile</h1>
        </div>
      </div>

      {/* Profile Card */}
      <div className="px-4 mt-2">
        <div className="bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 rounded-2xl p-5 relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full"></div>
          <div className="absolute -right-4 top-16 w-20 h-20 bg-white/5 rounded-full"></div>
          
          <div className="flex items-center gap-4 relative z-10">
            {/* Avatar */}
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/30">
              <span className="text-white text-xl font-bold">
                {getInitials(profile?.full_name || 'User')}
              </span>
            </div>
            
            {/* User Info */}
            <div className="flex-1">
              <h2 className="text-white text-lg font-semibold">
                {profile?.full_name || 'User'}
              </h2>
              {isPro && (
                <span className="inline-block mt-1 px-3 py-0.5 bg-blue-700/50 backdrop-blur-sm text-white text-xs font-medium rounded-full border border-white/20">
                  PRO MEMBER
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Settings Section */}
      <div className="px-4 mt-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Settings</h3>
        <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
          {settingsMenuItems.map((item, index) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors ${
                index !== settingsMenuItems.length - 1 ? 'border-b border-gray-100' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <i className={`${item.icon} text-lg text-gray-600`}></i>
                <span className="text-sm text-gray-800">{item.label}</span>
              </div>
              <i className="ri-arrow-right-s-line text-lg text-gray-400"></i>
            </button>
          ))}
        </div>
      </div>

      {/* Support Section */}
      <div className="px-4 mt-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Support</h3>
        <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
          {supportMenuItems.map((item, index) => (
            <button
              key={`${item.path}-${index}`}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors ${
                index !== supportMenuItems.length - 1 ? 'border-b border-gray-100' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <i className={`${item.icon} text-lg text-gray-600`}></i>
                <span className="text-sm text-gray-800">{item.label}</span>
              </div>
              <i className="ri-arrow-right-s-line text-lg text-gray-400"></i>
            </button>
          ))}
        </div>
      </div>

      {/* Logout Button */}
      <div className="px-4 mt-8">
        <button
          onClick={handleLogout}
          className="w-full py-4 bg-red-50 text-red-500 font-semibold rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
        >
          <i className="ri-logout-box-line"></i>
          Logout
        </button>
      </div>
    </div>
  );
}
