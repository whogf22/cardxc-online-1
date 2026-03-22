import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../contexts/AuthContext';
import { getCartoonAvatarUrl } from '../../utils/avatar';

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
  profile_picture?: string;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const isPro = profile?.kyc_status === 'approved';

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="w-14 h-14 border-4 border-lime-500/30 border-t-lime-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg pb-24">
      {/* Header */}
      <div className="bg-dark-card border-b border-dark-border px-4 pt-12 pb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-dark-elevated transition-colors"
          >
            <i className="ri-arrow-left-s-line text-2xl text-neutral-300"></i>
          </button>
          <h1 className="text-xl font-semibold text-white">Profile</h1>
        </div>
      </div>

      {/* Profile Card - Unique design */}
      <div className="px-4 mt-2">
        <div className="relative rounded-2xl overflow-hidden group">
          {/* Base: dark gradient with mesh feel */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950" />
          {/* Accent stripe - card-inspired */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-lime-400 to-transparent opacity-80" />
          {/* Geometric accents */}
          <div className="absolute -right-12 -top-12 w-36 h-36 rounded-full bg-lime-500/10 blur-2xl" />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-24 h-24 rounded-full border border-white/5" />
          <div className="absolute bottom-2 left-2 w-16 h-16 rounded-lg border border-white/5 rotate-12" />
          
          <div className="relative z-10 p-5 flex items-center gap-4">
            {/* Avatar with glow ring */}
            <div className="relative flex-shrink-0">
              <div className="absolute -inset-1 rounded-full bg-lime-400/30 blur-md animate-pulse" />
              <div className="relative w-16 h-16 rounded-full ring-2 ring-white/20 ring-offset-2 ring-offset-slate-900 overflow-hidden bg-slate-700">
                {profile?.profile_picture ? (
                  <img src={profile.profile_picture} alt="" className="w-full h-full object-cover" />
                ) : (
                  <img src={getCartoonAvatarUrl((profile?.id || profile?.email || 'default').toString(), 128)} alt="" className="w-full h-full object-cover" />
                )}
              </div>
            </div>
            
            {/* User Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-white text-lg font-semibold truncate">
                {profile?.full_name || 'User'}
              </h2>
              {profile?.email && (
                <p className="text-neutral-400 text-xs mt-0.5 truncate">{profile.email}</p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {isPro ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-400/30 text-amber-300 text-[10px] font-semibold tracking-wide">
                    <i className="ri-vip-crown-line text-xs" />
                    PRO
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-neutral-400 text-[10px] font-medium">
                    Free
                  </span>
                )}
                {profile?.created_at && (
                  <span className="text-neutral-500 text-[10px]">
                    Since {new Date(profile.created_at).getFullYear()}
                  </span>
                )}
              </div>
            </div>
            
            {/* Chevron */}
            <button
              onClick={() => navigate('/profile/personal')}
              className="flex-shrink-0 w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <i className="ri-arrow-right-s-line text-neutral-400 text-lg" />
            </button>
          </div>
        </div>
      </div>

      {/* Settings Section */}
      <div className="px-4 mt-6">
        <h3 className="text-sm font-semibold text-neutral-400 mb-3 uppercase tracking-wider">Settings</h3>
        <div className="bg-dark-card rounded-2xl overflow-hidden border border-dark-border">
          {settingsMenuItems.map((item, index) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center justify-between px-4 py-4 hover:bg-dark-elevated transition-colors ${
                index !== settingsMenuItems.length - 1 ? 'border-b border-dark-border' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <i className={`${item.icon} text-lg text-lime-400`}></i>
                <span className="text-sm text-white">{item.label}</span>
              </div>
              <i className="ri-arrow-right-s-line text-lg text-neutral-500"></i>
            </button>
          ))}
        </div>
      </div>

      {/* Support Section */}
      <div className="px-4 mt-6">
        <h3 className="text-sm font-semibold text-neutral-400 mb-3 uppercase tracking-wider">Support</h3>
        <div className="bg-dark-card rounded-2xl overflow-hidden border border-dark-border">
          {supportMenuItems.map((item, index) => (
            <button
              key={`${item.path}-${index}`}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center justify-between px-4 py-4 hover:bg-dark-elevated transition-colors ${
                index !== supportMenuItems.length - 1 ? 'border-b border-dark-border' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <i className={`${item.icon} text-lg text-lime-400`}></i>
                <span className="text-sm text-white">{item.label}</span>
              </div>
              <i className="ri-arrow-right-s-line text-lg text-neutral-500"></i>
            </button>
          ))}
        </div>
      </div>

      {/* Logout Button */}
      <div className="px-4 mt-8">
        <button
          onClick={handleLogout}
          className="w-full py-4 bg-red-500/10 text-red-400 font-semibold rounded-xl hover:bg-red-500/20 border border-red-500/30 transition-colors flex items-center justify-center gap-2"
        >
          <i className="ri-logout-box-line"></i>
          Logout
        </button>
      </div>
    </div>
  );
}
