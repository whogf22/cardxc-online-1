import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../../lib/api';

interface ProfileData {
  two_factor_enabled: boolean;
}

export default function LoginSecurityPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // Change Password modal
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePwError, setChangePwError] = useState('');
  const [changePwLoading, setChangePwLoading] = useState(false);

  // 2FA modals
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [show2FADisable, setShow2FADisable] = useState(false);
  const [twoFactorSecret, setTwoFactorSecret] = useState<{ secret: string; qrCode: string } | null>(null);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [disable2FAPassword, setDisable2FAPassword] = useState('');
  const [disable2FAError, setDisable2FAError] = useState('');
  const [disable2FALoading, setDisable2FALoading] = useState(false);

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
      console.error('[Security] Failed to load profile:', error);
      navigate('/signin');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePwError('');
    if (newPassword.length < 8) {
      setChangePwError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangePwError('Passwords do not match');
      return;
    }
    setChangePwLoading(true);
    try {
      const res = await authApi.changePassword(currentPassword, newPassword);
      if (res.success) {
        setShowChangePassword(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setChangePwError(res.error?.message || 'Failed to change password');
      }
    } catch (err: any) {
      setChangePwError(err?.message || 'Failed to change password');
    } finally {
      setChangePwLoading(false);
    }
  };

  const handleStart2FASetup = async () => {
    setTwoFactorError('');
    setTwoFactorToken('');
    setTwoFactorLoading(true);
    try {
      const res = await authApi.setup2FA();
      if (res.success && res.data) {
        setTwoFactorSecret(res.data);
        setShow2FASetup(true);
      } else {
        setTwoFactorError(res.error?.message || 'Failed to setup 2FA');
      }
    } catch (err: any) {
      setTwoFactorError(err?.message || 'Failed to setup 2FA');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (twoFactorToken.length !== 6) return;
    setTwoFactorError('');
    setTwoFactorLoading(true);
    try {
      const res = await authApi.verify2FA(twoFactorToken);
      if (res.success) {
        setShow2FASetup(false);
        setTwoFactorSecret(null);
        setTwoFactorToken('');
        loadProfile();
      } else {
        setTwoFactorError(res.error?.message || 'Invalid code');
      }
    } catch (err: any) {
      setTwoFactorError(err?.message || 'Verification failed');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisable2FAError('');
    setDisable2FALoading(true);
    try {
      const res = await authApi.disable2FA(disable2FAPassword);
      if (res.success) {
        setShow2FADisable(false);
        setDisable2FAPassword('');
        loadProfile();
      } else {
        setDisable2FAError(res.error?.message || 'Failed to disable 2FA');
      }
    } catch (err: any) {
      setDisable2FAError(err?.message || 'Failed to disable 2FA');
    } finally {
      setDisable2FALoading(false);
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
          <h1 className="text-xl font-semibold text-white">Login & Security</h1>
        </div>
      </div>

      {twoFactorError && !show2FASetup && (
        <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">
          {twoFactorError}
        </div>
      )}

      <div className="px-4 mt-6">
        <div className="bg-dark-card rounded-2xl overflow-hidden border border-dark-border">
          <button
            onClick={() => setShowChangePassword(true)}
            className="w-full flex items-center justify-between px-4 py-4 border-b border-dark-border hover:bg-dark-elevated transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <i className="ri-lock-password-line text-lg text-lime-400"></i>
              <span className="text-sm text-white">Change Password</span>
            </div>
            <i className="ri-arrow-right-s-line text-lg text-neutral-500"></i>
          </button>
          <button
            onClick={() => (profile?.two_factor_enabled ? setShow2FADisable(true) : handleStart2FASetup())}
            disabled={twoFactorLoading}
            className="w-full flex items-center justify-between px-4 py-4 hover:bg-dark-elevated transition-colors text-left disabled:opacity-60"
          >
            <div className="flex items-center gap-3">
              <i className="ri-shield-keyhole-line text-lg text-lime-400"></i>
              <span className="text-sm text-white">Two-factor Authentication</span>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${profile?.two_factor_enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-dark-elevated text-neutral-500'}`}>
              {profile?.two_factor_enabled ? 'Enabled' : 'Disabled'}
            </span>
          </button>
        </div>
      </div>

      {/* Change Password Modal */}
      {showChangePassword && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowChangePassword(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-dark-card border border-dark-border rounded-2xl p-5 z-50 max-w-md mx-auto shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">Change Password</h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="input-dark w-full px-4 py-2.5 rounded-xl"
                  placeholder="Enter current password"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-dark w-full px-4 py-2.5 rounded-xl"
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-dark w-full px-4 py-2.5 rounded-xl"
                  placeholder="Confirm new password"
                  required
                />
              </div>
              {changePwError && <p className="text-sm text-red-400">{changePwError}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePassword(false)}
                  className="flex-1 py-2.5 border border-dark-border rounded-xl text-neutral-300 font-medium hover:bg-dark-elevated transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changePwLoading}
                  className="flex-1 py-2.5 bg-lime-500 text-white rounded-xl font-medium hover:bg-lime-600 disabled:opacity-60"
                >
                  {changePwLoading ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* 2FA Setup Modal */}
      {show2FASetup && twoFactorSecret && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => { setShow2FASetup(false); setTwoFactorSecret(null); }} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-dark-card border border-dark-border rounded-2xl p-5 z-50 max-w-md mx-auto shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-2">Enable Two-Factor Authentication</h3>
            <p className="text-sm text-neutral-400 mb-4">Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
            <div className="flex justify-center mb-4">
              <img src={twoFactorSecret.qrCode} alt="2FA QR Code" className="w-48 h-48" />
            </div>
            <form onSubmit={handleVerify2FA} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Enter 6-digit code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={twoFactorToken}
                  onChange={(e) => setTwoFactorToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input-dark w-full px-4 py-2.5 rounded-xl text-center text-lg tracking-widest"
                  placeholder="000000"
                />
              </div>
              {twoFactorError && <p className="text-sm text-red-400">{twoFactorError}</p>}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShow2FASetup(false); setTwoFactorSecret(null); }}
                  className="flex-1 py-2.5 border border-dark-border rounded-xl text-neutral-300 font-medium hover:bg-dark-elevated transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={twoFactorLoading || twoFactorToken.length !== 6}
                  className="flex-1 py-2.5 bg-lime-500 text-white rounded-xl font-medium hover:bg-lime-600 disabled:opacity-60"
                >
                  {twoFactorLoading ? 'Verifying...' : 'Verify & Enable'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* 2FA Disable Modal */}
      {show2FADisable && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShow2FADisable(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-dark-card border border-dark-border rounded-2xl p-5 z-50 max-w-md mx-auto shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-2">Disable Two-Factor Authentication</h3>
            <p className="text-sm text-neutral-400 mb-4">Enter your password to disable 2FA</p>
            <form onSubmit={handleDisable2FA} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Password</label>
                <input
                  type="password"
                  value={disable2FAPassword}
                  onChange={(e) => setDisable2FAPassword(e.target.value)}
                  className="input-dark w-full px-4 py-2.5 rounded-xl"
                  placeholder="Enter your password"
                  required
                />
              </div>
              {disable2FAError && <p className="text-sm text-red-400">{disable2FAError}</p>}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShow2FADisable(false)}
                  className="flex-1 py-2.5 border border-dark-border rounded-xl text-neutral-300 font-medium hover:bg-dark-elevated transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disable2FALoading}
                  className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 disabled:opacity-60"
                >
                  {disable2FALoading ? 'Disabling...' : 'Disable 2FA'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
