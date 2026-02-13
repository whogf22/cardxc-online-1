import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage('Verification token is missing. Please check your email link.');
      return;
    }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStatus('success');
          setMessage(data.message || 'Email verified successfully!');
        } else {
          setStatus('error');
          setMessage(data.error || 'Verification failed. Please try again.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Something went wrong. Please try again.');
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <i className="ri-bank-card-line text-white text-2xl"></i>
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">CardXC</span>
        </div>

        {status === 'loading' && (
          <div className="bg-gray-50 rounded-2xl p-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <i className="ri-loader-4-line animate-spin text-3xl text-gray-400"></i>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Verifying your email...</h2>
            <p className="text-gray-500">Please wait while we verify your email address.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="bg-emerald-50 rounded-2xl p-8 border border-emerald-100">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
              <i className="ri-check-line text-3xl text-emerald-600"></i>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Email Verified!</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <Link
              to="/signin"
              className="inline-flex items-center justify-center gap-2 w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all"
            >
              <i className="ri-login-box-line"></i>
              Sign In to Your Account
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-red-50 rounded-2xl p-8 border border-red-100">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <i className="ri-close-line text-3xl text-red-600"></i>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Verification Failed</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="space-y-3">
              <Link
                to="/signin"
                className="inline-flex items-center justify-center gap-2 w-full py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all"
              >
                <i className="ri-login-box-line"></i>
                Go to Sign In
              </Link>
              <p className="text-sm text-gray-500">
                Need a new verification link?{' '}
                <Link to="/signup" className="text-emerald-600 hover:underline">Sign up again</Link>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
