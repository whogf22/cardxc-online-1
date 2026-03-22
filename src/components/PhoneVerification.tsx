import { useState, useRef, useEffect } from 'react';
import { userApi } from '../lib/api';

interface PhoneVerificationProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
  currentPhone?: string | null;
  userId?: string;
}

type Step = 'phone' | 'otp' | 'success';

export default function PhoneVerification({ 
  isOpen, 
  onClose, 
  onVerified, 
  currentPhone,
}: PhoneVerificationProps) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState(currentPhone || '');
  const [countryCode, setCountryCode] = useState('+234');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleSendOTP = async () => {
    if (!phone || phone.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const fullPhone = `${countryCode}${phone.replace(/^0+/, '')}`;
      
      const result = await userApi.updateProfile({ 
        phone: fullPhone,
      } as any);

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to update phone number');
      }

      setStep('otp');
      setResendTimer(60);
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: `${countryCode}${phone.replace(/^0+/, '')}`, code }),
      });
      const verifyResult = await response.json();
      
      if (!response.ok || !verifyResult.success) {
        throw new Error(verifyResult.message || 'Verification failed. Please check your code and try again.');
      }

      // Fetch existing profile to get current metadata
      const profileResult = await userApi.getProfile();
      const existingMetadata = (profileResult.data?.user as any)?.metadata || {};

      const result = await userApi.updateProfile({ 
        metadata: {
          ...existingMetadata,
          phone_verified: true,
          phone_verified_at: new Date().toISOString()
        }
      } as any);

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to verify phone');
      }

      setStep('success');
      setTimeout(() => {
        onVerified();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendTimer > 0) return;
    await handleSendOTP();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <i className="ri-phone-line text-2xl"></i>
              </div>
              <div>
                <h2 className="text-xl font-bold">Phone Verification</h2>
                <p className="text-emerald-100 text-sm">Secure your account with SMS</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <i className="ri-close-line text-lg"></i>
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
              <i className="ri-error-warning-line"></i>
              {error}
            </div>
          )}

          {step === 'phone' && (
            <div className="space-y-4">
              <p className="text-slate-600 text-sm">
                Enter your phone number to receive a verification code via SMS.
              </p>

              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-28 px-3 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="+234">+234 NG</option>
                  <option value="+880">+880 BD</option>
                  <option value="+1">+1 US</option>
                  <option value="+44">+44 UK</option>
                  <option value="+91">+91 IN</option>
                </select>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="8012345678"
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  maxLength={11}
                />
              </div>

              <button
                onClick={handleSendOTP}
                disabled={loading || !phone}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <i className="ri-loader-4-line animate-spin"></i>
                    Sending...
                  </span>
                ) : (
                  'Send Verification Code'
                )}
              </button>
            </div>
          )}

          {step === 'otp' && (
            <div className="space-y-4">
              <p className="text-slate-600 text-sm text-center">
                Enter the 6-digit code sent to<br />
                <span className="font-semibold text-slate-900">{countryCode}{phone}</span>
              </p>

              <div className="flex justify-center gap-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { otpRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    maxLength={1}
                  />
                ))}
              </div>

              <div className="text-center text-sm text-slate-500">
                <p className="mb-1">Demo code: <span className="font-mono font-bold text-emerald-600">123456</span></p>
                {resendTimer > 0 ? (
                  <p>Resend code in {resendTimer}s</p>
                ) : (
                  <button
                    onClick={handleResendOTP}
                    className="text-emerald-600 font-medium hover:underline"
                  >
                    Resend Code
                  </button>
                )}
              </div>

              <button
                onClick={handleVerifyOTP}
                disabled={loading || otp.join('').length !== 6}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <i className="ri-loader-4-line animate-spin"></i>
                    Verifying...
                  </span>
                ) : (
                  'Verify Code'
                )}
              </button>

              <button
                onClick={() => { setStep('phone'); setOtp(['', '', '', '', '', '']); setError(''); }}
                className="w-full py-2 text-slate-600 hover:text-slate-900 text-sm font-medium"
              >
                Change Phone Number
              </button>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-check-line text-4xl text-emerald-600"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Phone Verified!</h3>
              <p className="text-slate-600">Your phone number has been successfully verified.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
