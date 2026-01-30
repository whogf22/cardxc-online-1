import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { resetApiClient } from '../../lib/apiClient';
import { trackLogin } from '../../lib/analytics';
import { checkBiometricSupport } from '../../lib/authHelpers';
import { useAuthContext } from '../../contexts/AuthContext';

export default function SignInPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isAdmin, loading: authLoading, signIn } = useAuthContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricMessage, setBiometricMessage] = useState('');
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [googleOAuthAvailable, setGoogleOAuthAvailable] = useState(false);

  useEffect(() => {
    if (searchParams.get('session') === 'expired') {
      setError('Your session has expired. Please sign in again.');
    }
    
    const errorDesc = searchParams.get('error_description');
    if (errorDesc) {
      setError(decodeURIComponent(errorDesc.replace(/\+/g, ' ')));
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      if (isAdmin) {
        navigate('/admin-dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
    
    checkBiometricSupport().then(({ available, message }) => {
      setBiometricAvailable(available);
      setBiometricMessage(message);
    });

    fetch('/api/auth/google-status')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data?.available) {
          setGoogleOAuthAvailable(true);
        }
      })
      .catch(() => {});
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn(email, password, requiresTwoFactor ? twoFactorToken : undefined);
      
      if (!result.success) {
        setError(result.error || 'Failed to sign in. Please check your credentials.');
        return;
      }

      if (result.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        return;
      }

      resetApiClient();
      trackLogin('email');
      console.log('[SignIn] Login successful');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!biometricAvailable) {
      setError(biometricMessage || 'Biometric login is not available on this device');
      return;
    }
    
    setError('Biometric login requires setup. Please sign in with your password first, then enable biometric login in Settings.');
  };

  const handleGoogleLogin = async () => {
    if (!googleOAuthAvailable) {
      setError('Google login is not configured. Please use email/password.');
      return;
    }
    window.location.href = '/api/auth/google';
  };

  if (requiresTwoFactor) {
    return (
      <div className="min-h-screen bg-dark-bg flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-40 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse-soft"></div>
          <div className="absolute bottom-1/4 -right-40 w-[500px] h-[500px] bg-cream-400/10 rounded-full blur-[140px]"></div>
        </div>

        <div className="flex-1 flex flex-col px-6 pt-12 pb-8 relative z-10">
          <button
            onClick={() => { setRequiresTwoFactor(false); setTwoFactorToken(''); }}
            className="self-start w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors mb-8 border border-white/10"
          >
            <i className="ri-arrow-left-s-line text-xl text-white"></i>
          </button>

          <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <i className="ri-shield-keyhole-line text-white text-2xl"></i>
              </div>
              <span className="text-2xl font-bold text-white">2FA Verification</span>
            </div>

            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Enter 2FA Code</h1>
              <p className="text-sm sm:text-base text-neutral-400">
                Open your authenticator app and enter the 6-digit code.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
                <i className="ri-error-warning-line text-red-400 text-xl mt-0.5 flex-shrink-0"></i>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <form onSubmit={handleSignIn} className="space-y-5">
              <div>
                <label htmlFor="twoFactorToken" className="block text-sm font-medium text-neutral-300 mb-2">
                  6-Digit Code
                </label>
                <input
                  id="twoFactorToken"
                  type="text"
                  value={twoFactorToken}
                  onChange={(e) => setTwoFactorToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  maxLength={6}
                  pattern="[0-9]{6}"
                  autoComplete="one-time-code"
                  className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-center text-2xl tracking-widest"
                  placeholder="000000"
                />
              </div>

              <button
                type="submit"
                disabled={loading || twoFactorToken.length !== 6}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25"
              >
                {loading ? (
                  <>
                    <i className="ri-loader-4-line animate-spin text-xl"></i>
                    Verifying...
                  </>
                ) : (
                  'Verify & Login'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-40 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse-soft"></div>
        <div className="absolute bottom-1/4 -right-40 w-[500px] h-[500px] bg-cream-400/10 rounded-full blur-[140px]"></div>
      </div>

      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgba(247, 220, 204, 0.15) 1px, transparent 0)`,
          backgroundSize: '64px 64px'
        }}></div>
      </div>

      <div className="flex-1 flex flex-col px-6 pt-12 pb-8 relative z-10">
        <button
          onClick={() => navigate('/')}
          className="self-start w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors mb-8 border border-white/10"
        >
          <i className="ri-arrow-left-s-line text-xl text-white"></i>
        </button>

        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
          <div className="relative">
            <div className="relative z-10 p-8 rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-2xl">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <i className="ri-bank-card-line text-white text-2xl"></i>
                </div>
                <span className="text-2xl font-bold text-white">CardXC</span>
              </div>

              <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Welcome Back</h1>
                <p className="text-sm sm:text-base text-neutral-400">
                  Sign in to access your account and manage your finances securely.
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
                  <i className="ri-error-warning-line text-red-400 text-xl mt-0.5 flex-shrink-0"></i>
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <form onSubmit={handleSignIn} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-neutral-300 mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    placeholder="Enter email address"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-neutral-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all pr-12"
                      placeholder="Enter password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-400 hover:text-white transition-colors"
                    >
                      <i className={showPassword ? 'ri-eye-off-line text-xl' : 'ri-eye-line text-xl'}></i>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleBiometricLogin}
                    className={`flex items-center gap-2 text-sm transition-colors ${
                      biometricAvailable 
                        ? 'text-emerald-400 hover:text-emerald-300 cursor-pointer' 
                        : 'text-neutral-500 cursor-not-allowed'
                    }`}
                  >
                    <i className="ri-fingerprint-line text-lg"></i>
                    <span>Biometric</span>
                  </button>
                  <Link
                    to="/forgot-password"
                    className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    Forgot Password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5"
                >
                  {loading ? (
                    <>
                      <i className="ri-loader-4-line animate-spin text-xl"></i>
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <i className="ri-arrow-right-line text-lg"></i>
                    </>
                  )}
                </button>
              </form>

              {googleOAuthAvailable && (
                <>
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-dark-bg text-neutral-500">Or continue with</span>
                    </div>
                  </div>

                  <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 py-3.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span className="font-medium text-white">Continue with Google</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <p className="text-center text-neutral-400 mt-8">
            Don't have an account?{' '}
            <Link to="/signup" className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
              Create Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
