import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthContext } from '../../contexts/AuthContext';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { signIn, isAuthenticated, isAdmin, loading: authLoading } = useAuthContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('session') === 'expired') {
      setSessionExpired(true);
      setError('Your session has expired. Please sign in again.');
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      if (isAdmin) {
        navigate('/admin-dashboard', { replace: true });
      } else {
        setError('Admin access required. You have been redirected to the customer dashboard.');
        navigate('/dashboard', { replace: true });
      }
    }
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSessionExpired(false);

    try {
      const result = await signIn(email, password, requiresTwoFactor ? twoFactorToken : undefined);

      if (!result.success) {
        setError(result.error || 'Failed to sign in');
        return;
      }

      if (result.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        return;
      }

      console.log('[Admin] Login successful, checking role...');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleSignInAgain = () => {
    setError('');
    setSessionExpired(false);
    setEmail('');
    setPassword('');
    setTwoFactorToken('');
    setRequiresTwoFactor(false);
    window.history.replaceState({}, '', '/admin-login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-full mb-4">
            <i className="ri-shield-keyhole-line text-3xl text-white"></i>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Admin Portal</h1>
          <p className="text-slate-400">Secure access for administrators</p>
        </div>

        <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700">
          {sessionExpired ? (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500/20 rounded-full mb-4">
                  <i className="ri-time-line text-3xl text-amber-400"></i>
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">Session Expired</h2>
                <p className="text-slate-400 text-sm">Your session has expired for security reasons. Please sign in again to continue.</p>
              </div>
              
              <button
                onClick={handleSignInAgain}
                className="w-full bg-gradient-to-r from-sky-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all whitespace-nowrap cursor-pointer"
              >
                Sign In Again
              </button>

              <div className="text-center">
                <Link to="/" className="text-sm text-slate-400 hover:text-slate-300">
                  ← Back to home
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-6">
              {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {requiresTwoFactor ? (
                <>
                  <div className="text-center mb-4">
                    <i className="ri-shield-keyhole-line text-4xl text-amber-400 mb-2"></i>
                    <h2 className="text-xl font-semibold text-white">2FA Verification</h2>
                    <p className="text-slate-400 text-sm">Enter the 6-digit code from your authenticator app</p>
                  </div>

                  <div>
                    <label htmlFor="twoFactorToken" className="block text-sm font-medium text-slate-300 mb-2">
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
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all text-center text-2xl tracking-widest"
                      placeholder="000000"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || twoFactorToken.length !== 6}
                    className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white py-3 rounded-lg font-semibold hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                  >
                    {loading ? 'Verifying...' : 'Verify & Access'}
                  </button>

                  <button
                    type="button"
                    onClick={handleSignInAgain}
                    className="w-full text-slate-400 hover:text-slate-300 text-sm"
                  >
                    ← Back to login
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                      Admin Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all text-sm"
                      placeholder="Enter admin email"
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all text-sm"
                      placeholder="••••••••"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white py-3 rounded-lg font-semibold hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                  >
                    {loading ? 'Verifying...' : 'Access Admin Portal'}
                  </button>
                </>
              )}
            </form>
          )}

          {!sessionExpired && !requiresTwoFactor && (
            <div className="mt-6 text-center">
              <Link to="/" className="text-sm text-slate-400 hover:text-slate-300">
                ← Back to home
              </Link>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            This portal is restricted to authorized administrators only
          </p>
        </div>
      </div>
    </div>
  );
}
