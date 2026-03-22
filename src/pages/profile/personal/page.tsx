import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface ProfileData {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  country: string;
}

export default function PersonalInformationPage() {
  const navigate = useNavigate();
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
      console.error('[PersonalInfo] Failed to load profile:', error);
      navigate('/signin');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="w-14 h-14 border-4 border-lime-500/30 border-t-lime-500 rounded-full animate-spin"></div>
      </div>
    );
  }

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
          <h1 className="text-xl font-semibold text-white">Personal Information</h1>
        </div>
      </div>

      <div className="px-4 mt-6">
        <div className="bg-dark-card rounded-2xl overflow-hidden border border-dark-border">
          <div className="px-4 py-4 border-b border-dark-border">
            <p className="text-xs text-neutral-500 mb-1">Full Name</p>
            <p className="text-sm font-medium text-white">{profile?.full_name || 'Not set'}</p>
          </div>
          <div className="px-4 py-4 border-b border-dark-border">
            <p className="text-xs text-neutral-500 mb-1">Email Address</p>
            <p className="text-sm font-medium text-white">{profile?.email || 'Not set'}</p>
          </div>
          <div className="px-4 py-4 border-b border-dark-border">
            <p className="text-xs text-neutral-500 mb-1">Phone Number</p>
            <p className="text-sm font-medium text-white">{profile?.phone || 'Not set'}</p>
          </div>
          <div className="px-4 py-4">
            <p className="text-xs text-neutral-500 mb-1">Country</p>
            <p className="text-sm font-medium text-white">{profile?.country || 'Not set'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
