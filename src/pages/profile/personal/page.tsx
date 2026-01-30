import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../../../components/BottomNavigation';

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
          <h1 className="text-xl font-semibold text-gray-900">Personal Information</h1>
        </div>
      </div>

      <div className="px-4 mt-6">
        <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
          <div className="px-4 py-4 border-b border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Full Name</p>
            <p className="text-sm font-medium text-gray-900">{profile?.full_name || 'Not set'}</p>
          </div>
          <div className="px-4 py-4 border-b border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Email Address</p>
            <p className="text-sm font-medium text-gray-900">{profile?.email || 'Not set'}</p>
          </div>
          <div className="px-4 py-4 border-b border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Phone Number</p>
            <p className="text-sm font-medium text-gray-900">{profile?.phone || 'Not set'}</p>
          </div>
          <div className="px-4 py-4">
            <p className="text-xs text-gray-500 mb-1">Country</p>
            <p className="text-sm font-medium text-gray-900">{profile?.country || 'Not set'}</p>
          </div>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
}
