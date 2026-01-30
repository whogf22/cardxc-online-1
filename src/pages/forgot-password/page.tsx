// Forgot Password Page - allows users to request a password reset email

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email) {
      setError('Please enter your email address');
      setLoading(false);
      return;
    }

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw resetError;
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4 py-12 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-20 w-80 h-80 bg-cream-300/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-cream-400/5 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 w-full max-w-md">
          <div className="text-center mb-10">
            <Link to="/" className="inline-flex items-center space-x-3 cursor-pointer group">
              <div className="w-14 h-14 bg-gradient-to-br from-cream-300 to-cream-500 rounded-2xl flex items-center justify-center shadow-glow group-hover:shadow-glow-sm transition-all duration-300">
                <i className="ri-wallet-3-line text-dark-bg text-2xl"></i>
              </div>
              <span className="text-3xl font-bold text-white">CardXC</span>
            </Link>
          </div>

          <div className="dark-card p-8 text-center">
            <div className="w-20 h-20 bg-success-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="ri-mail-check-line text-success-500 text-4xl"></i>
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-3">Check Your Email</h1>
            <p className="text-neutral-400 mb-6">
              We've sent a password reset link to<br />
              <span className="text-cream-300 font-medium">{email}</span>
            </p>
            
            <p className="text-sm text-neutral-500 mb-8">
              Didn't receive the email? Check your spam folder or try again.
            </p>

            <div className="space-y-4">
              <button
                onClick={() => setSuccess(false)}
                className="btn-secondary w-full"
              >
                Try Again
              </button>
              
              <Link
                to="/signin"
                className="btn-primary w-full flex items-center justify-center"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-cream-300/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-cream-400/5 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cream-300/3 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center space-x-3 cursor-pointer group">
            <div className="w-14 h-14 bg-gradient-to-br from-cream-300 to-cream-500 rounded-2xl flex items-center justify-center shadow-glow group-hover:shadow-glow-sm transition-all duration-300">
              <i className="ri-wallet-3-line text-dark-bg text-2xl"></i>
            </div>
            <span className="text-3xl font-bold text-white">CardXC</span>
          </Link>
        </div>

        <div className="dark-card p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-cream-300/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-lock-password-line text-cream-300 text-3xl"></i>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Forgot Password?</h1>
            <p className="text-neutral-400">Enter your email to reset your password</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-danger-500/10 border border-danger-500/30 rounded-xl flex items-start space-x-3">
              <i className="ri-error-warning-line text-danger-400 text-xl mt-0.5"></i>
              <p className="text-sm text-danger-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <i className="ri-mail-line text-neutral-500"></i>
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="input-dark pl-12"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center"
            >
              {loading ? (
                <>
                  <i className="ri-loader-4-line animate-spin mr-2"></i>
                  Sending...
                </>
              ) : (
                <>
                  <i className="ri-mail-send-line mr-2"></i>
                  Send Reset Link
                </>
              )}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dark-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-dark-card text-neutral-500">Remember your password?</span>
            </div>
          </div>

          <Link
            to="/signin"
            className="btn-secondary w-full flex items-center justify-center"
          >
            <i className="ri-arrow-left-line mr-2"></i>
            Back to Sign In
          </Link>
        </div>

        <div className="text-center mt-8">
          <Link to="/" className="text-sm text-neutral-500 hover:text-cream-300 transition-colors cursor-pointer">
            <i className="ri-arrow-left-line mr-1"></i>
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
