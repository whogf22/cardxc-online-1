import { useState, useEffect, useCallback, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { checkoutApi, userApi } from '../../../lib/api';

interface DepositModalProps {
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
  onOpenCryptoDeposit?: () => void;
}

const currencyConfig: Record<string, { symbol: string; name: string }> = {
  NGN: { symbol: '₦', name: 'Nigerian Naira' },
  USD: { symbol: '$', name: 'US Dollar' },
  BDT: { symbol: '৳', name: 'Bangladeshi Taka' },
  EUR: { symbol: '€', name: 'Euro' },
  GBP: { symbol: '£', name: 'British Pound' },
};

const SUPPORTED_CHECKOUT_CURRENCIES = ['USD', 'EUR', 'GBP'];

type Step = 'method-selection' | 'stripe-checkout' | 'otp-verify' | 'processing' | 'success' | 'error';

// API helper for deposit OTP endpoints
const depositOtpApi = {
  async initiate(amount: number, currency: string) {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    const res = await fetch('/api/deposit-otp/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount, currency }),
    });
    return res.json();
  },
  async verify(orderId: string, otpCode: string) {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    const res = await fetch('/api/deposit-otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orderId, otpCode }),
    });
    return res.json();
  },
  async resend(orderId: string) {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    const res = await fetch('/api/deposit-otp/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orderId }),
    });
    return res.json();
  },
};

export default function DepositModal({ currency, onClose, onSuccess, onOpenCryptoDeposit }: DepositModalProps) {
  const checkoutCurrency = SUPPORTED_CHECKOUT_CURRENCIES.includes(currency) ? currency : 'USD';
  const config = currencyConfig[checkoutCurrency] || currencyConfig.USD;

  const [step, setStep] = useState<Step>('method-selection');
  const [amount, setAmount] = useState('');
  const [depositAmount, setDepositAmount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [newBalance, setNewBalance] = useState<number | null>(null);

  // Stripe state
  const [stripePromise, setStripePromise] = useState<Promise<any> | null>(null);
  const [clientSecret, setClientSecret] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');

  // OTP state
  const [orderId, setOrderId] = useState<string>('');
  const [maskedEmail, setMaskedEmail] = useState<string>('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpExpiry, setOtpExpiry] = useState<Date | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const fetchWalletBalance = useCallback(async (): Promise<number> => {
    try {
      const walletsResult = await userApi.getWallets();
      if (walletsResult.success && walletsResult.data?.wallets) {
        const usdWallet = walletsResult.data.wallets.find((w: any) => w.currency === 'USD');
        return usdWallet?.balance || (usdWallet?.balanceCents ? usdWallet.balanceCents / 100 : 0);
      }
    } catch (error) {
      console.error('[DepositModal] Error fetching balance:', error);
    }
    return 0;
  }, []);

  useEffect(() => {
    checkoutApi.getStripeConfig().then(res => {
      if (res.success && res.data?.publishableKey) {
        setStripePromise(loadStripe(res.data.publishableKey));
      }
    });
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Handle Stripe return URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const depositReturn = params.get('deposit');
    const returnSessionId = params.get('session_id');

    if (depositReturn === 'return' && returnSessionId) {
      setStep('processing');
      const checkStatus = async () => {
        try {
          const res = await checkoutApi.getStripeSessionStatus(returnSessionId);
          if (res.success && res.data) {
            if (res.data.status === 'complete' && res.data.paymentStatus === 'paid') {
              const balance = await fetchWalletBalance();
              setNewBalance(balance);
              setStep('success');
            } else if (res.data.status === 'expired') {
              setStep('error');
              setErrorMessage('Payment session expired. Please try again.');
            } else {
              setTimeout(checkStatus, 2000);
            }
          }
        } catch {
          setStep('error');
          setErrorMessage('Failed to verify payment status.');
        }
      };
      checkStatus();
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const resetForm = useCallback(() => {
    setStep('method-selection');
    setAmount('');
    setDepositAmount(0);
    setErrorMessage('');
    setNewBalance(null);
    setIsProcessing(false);
    setClientSecret('');
    setSessionId('');
    setOrderId('');
    setMaskedEmail('');
    setOtpCode(['', '', '', '', '', '']);
    setOtpError('');
    setOtpExpiry(null);
    setResendCooldown(0);
  }, []);

  const getAmountError = (val: string): string | null => {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) return 'Please enter a valid amount';
    if (num < 1) return `Minimum deposit is ${config.symbol}1`;
    if (num > 2500) return `Maximum deposit is ${config.symbol}2,500`;
    return null;
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleBackToWallet = () => {
    onSuccess();
    resetForm();
    onClose();
  };

  const handleDepositAgain = () => {
    resetForm();
  };

  const isAmountValid = (): boolean => {
    const amountValue = parseFloat(amount);
    return !isNaN(amountValue) && amountValue >= 1 && amountValue <= 2500;
  };

  // Step 1: Initiate deposit — creates Stripe session + sends OTP
  const handleSelectCard = async () => {
    if (!isAmountValid()) return;
    const numAmount = parseFloat(amount);
    setIsProcessing(true);
    setErrorMessage('');
    setDepositAmount(numAmount);

    try {
      const response = await depositOtpApi.initiate(numAmount, checkoutCurrency);
      if (response.success && response.data) {
        const { orderId: newOrderId, clientSecret: cs, sessionId: sid, email, expiresAt } = response.data;
        setOrderId(newOrderId);
        setMaskedEmail(email);
        setClientSecret(cs);
        setSessionId(sid);
        setOtpExpiry(expiresAt ? new Date(expiresAt) : null);
        setOtpCode(['', '', '', '', '', '']);
        setOtpError('');
        setStep('stripe-checkout');
      } else {
        setErrorMessage(response.error?.message || response.message || 'Failed to initiate deposit');
        setStep('error');
      }
    } catch (error: any) {
      console.error('[DepositModal] Initiate error:', error);
      setStep('error');
      setErrorMessage(error?.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // After Stripe checkout completes — move to OTP step
  const handleStripeComplete = () => {
    setStep('otp-verify');
    setTimeout(() => {
      otpInputRefs.current[0]?.focus();
    }, 300);
  };

  // OTP input handling
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpCode];
    newOtp[index] = value.slice(-1);
    setOtpCode(newOtp);
    setOtpError('');
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtpCode(pasted.split(''));
      otpInputRefs.current[5]?.focus();
    }
  };

  // Step 2: Verify OTP + credit wallet
  const handleVerifyOtp = async () => {
    const code = otpCode.join('');
    if (code.length !== 6) {
      setOtpError('Please enter the 6-digit code');
      return;
    }
    setIsProcessing(true);
    setOtpError('');
    try {
      const response = await depositOtpApi.verify(orderId, code);
      if (response.success && response.data) {
        setNewBalance(response.data.newBalance);
        setDepositAmount(response.data.amount);
        setStep('success');
      } else {
        setOtpError(response.error?.message || response.message || 'Invalid code. Please try again.');
      }
    } catch (error: any) {
      setOtpError(error?.message || 'Verification failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setResendCooldown(60);
    setOtpError('');
    try {
      const response = await depositOtpApi.resend(orderId);
      if (response.success) {
        if (response.data?.expiresAt) setOtpExpiry(new Date(response.data.expiresAt));
        setOtpCode(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      } else {
        setOtpError(response.error?.message || 'Failed to resend code');
        setResendCooldown(0);
      }
    } catch {
      setOtpError('Failed to resend code. Please try again.');
      setResendCooldown(0);
    }
  };

  const handleSelectCrypto = () => {
    handleClose();
    if (onOpenCryptoDeposit) {
      onOpenCryptoDeposit();
    }
  };

  const handleCancelCheckout = () => {
    setClientSecret('');
    setSessionId('');
    setStep('method-selection');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-3xl shadow-2xl w-full max-h-[90vh] overflow-hidden flex flex-col ${step === 'stripe-checkout' ? 'max-w-4xl' : 'max-w-md'}`}>
        {/* Header */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {step === 'method-selection' && 'Deposit Funds'}
                  {step === 'stripe-checkout' && 'Complete Payment'}
                  {step === 'otp-verify' && 'Verify Deposit'}
                  {step === 'processing' && 'Processing Payment'}
                  {step === 'success' && 'Deposit Successful'}
                  {step === 'error' && 'Payment Failed'}
                </h2>
                {depositAmount > 0 && step !== 'method-selection' && (
                  <p className="text-sm text-slate-500 mt-0.5">
                    {config.symbol}{depositAmount.toFixed(2)} {checkoutCurrency}
                  </p>
                )}
              </div>
            </div>
            {step !== 'processing' && (
              <button
                onClick={handleClose}
                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-xl text-slate-600"></i>
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── STEP 1: Method Selection ── */}
          {step === 'method-selection' && (
            <div>
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Amount ({checkoutCurrency})</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">{config.symbol}</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    min="1"
                    max="2500"
                    step="0.01"
                    className="w-full pl-10 pr-4 py-4 text-2xl font-bold border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors"
                  />
                </div>
                {amount && getAmountError(amount) && (
                  <p className="text-red-500 text-sm mt-1">{getAmountError(amount)}</p>
                )}
                <div className="flex gap-2 mt-3">
                  {[10, 50, 100, 500].map(v => (
                    <button
                      key={v}
                      onClick={() => setAmount(String(v))}
                      className="flex-1 py-2 text-sm font-semibold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors cursor-pointer"
                    >
                      {config.symbol}{v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleSelectCard}
                  disabled={!isAmountValid() || isProcessing}
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl font-bold transition-all cursor-pointer shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-3"
                >
                  {isProcessing ? (
                    <><i className="ri-loader-4-line animate-spin text-xl"></i> Processing...</>
                  ) : (
                    <><i className="ri-bank-card-line text-xl"></i> Pay with Card</>
                  )}
                </button>
                {onOpenCryptoDeposit && (
                  <button
                    onClick={handleSelectCrypto}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-4 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center gap-3"
                  >
                    <i className="ri-bit-coin-line text-xl"></i> Pay with Crypto (USDT)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 2: Stripe Checkout ── */}
          {step === 'stripe-checkout' && clientSecret && stripePromise && (
            <div>
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                <i className="ri-information-line mr-1"></i>
                Complete payment below. After payment, you'll verify with a code sent to your email.
              </div>
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{
                  clientSecret,
                  onComplete: handleStripeComplete,
                }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
              <div className="mt-4 text-center">
                <button onClick={handleCancelCheckout} className="text-sm text-slate-600 hover:text-slate-900 underline cursor-pointer">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: OTP Verification ── */}
          {step === 'otp-verify' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-mail-check-line text-3xl text-emerald-600"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Check Your Email</h3>
              <p className="text-slate-600 mb-1">
                We sent a 6-digit verification code to
              </p>
              <p className="font-semibold text-slate-800 mb-6">{maskedEmail}</p>

              {/* OTP Input Boxes */}
              <div className="flex gap-2 justify-center mb-4" onPaste={handleOtpPaste}>
                {otpCode.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { otpInputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    className={`w-12 h-14 text-center text-2xl font-bold border-2 rounded-xl focus:outline-none transition-colors ${
                      otpError ? 'border-red-400 bg-red-50' : digit ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 focus:border-emerald-500'
                    }`}
                  />
                ))}
              </div>

              {otpError && (
                <p className="text-red-500 text-sm mb-4">{otpError}</p>
              )}

              {otpExpiry && (
                <p className="text-slate-500 text-xs mb-4">
                  Code expires at {otpExpiry.toLocaleTimeString()}
                </p>
              )}

              <button
                onClick={handleVerifyOtp}
                disabled={otpCode.join('').length !== 6 || isProcessing}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl font-bold transition-all cursor-pointer shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 mb-4"
              >
                {isProcessing ? (
                  <><i className="ri-loader-4-line animate-spin"></i> Verifying...</>
                ) : (
                  <><i className="ri-shield-check-line"></i> Verify & Complete Deposit</>
                )}
              </button>

              <div className="text-sm text-slate-600">
                Didn't receive the code?{' '}
                <button
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0}
                  className="text-emerald-600 hover:text-emerald-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>

              <div className="mt-4">
                <button onClick={() => setStep('method-selection')} className="text-sm text-slate-500 hover:text-slate-700 underline cursor-pointer">
                  Cancel deposit
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Processing ── */}
          {step === 'processing' && (
            <div className="text-center py-8">
              <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl inline-block mx-auto">
                <p className="text-lg font-bold text-emerald-600">{config.symbol}{depositAmount.toFixed(2)}</p>
              </div>
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <i className="ri-loader-4-line text-4xl text-emerald-600 animate-spin"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Processing Your Payment</h3>
              <p className="text-slate-600 mb-4">Please wait while we confirm your deposit...</p>
              <p className="text-sm text-slate-500">This may take a few moments. Do not close this window.</p>
            </div>
          )}

          {/* ── STEP 5: Success ── */}
          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="ri-check-line text-4xl text-emerald-600"></i>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Deposit Successful!</h3>

              <div className="my-6 p-6 bg-emerald-50 border border-emerald-200 rounded-xl max-w-sm mx-auto">
                <p className="text-sm text-slate-600 mb-2">Amount Deposited</p>
                <p className="text-3xl font-bold text-emerald-600 mb-4">{config.symbol}{depositAmount.toFixed(2)}</p>

                {newBalance !== null && (
                  <div className="border-t border-emerald-200 pt-4">
                    <p className="text-sm text-slate-600 mb-1">New Balance</p>
                    <p className="text-xl font-bold text-slate-900">{config.symbol}{newBalance.toFixed(2)} {checkoutCurrency}</p>
                  </div>
                )}
              </div>

              <p className="text-slate-600 mb-6">Your funds have been added to your account.</p>

              <div className="flex flex-col gap-3 max-w-xs mx-auto">
                <button
                  onClick={handleBackToWallet}
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-6 py-4 rounded-xl font-bold transition-all cursor-pointer shadow-lg shadow-emerald-500/30"
                >
                  Back to Wallet
                </button>
                <button
                  onClick={handleDepositAgain}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-4 rounded-xl font-bold transition-all cursor-pointer"
                >
                  Deposit Again
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 6: Error ── */}
          {step === 'error' && (
            <div className="text-center py-8">
              {depositAmount > 0 && (
                <div className="mb-4 p-4 bg-slate-100 border border-slate-200 rounded-xl inline-block mx-auto">
                  <p className="text-sm text-slate-600">Attempted Amount</p>
                  <p className="text-lg font-bold text-slate-700">{config.symbol}{depositAmount.toFixed(2)}</p>
                </div>
              )}
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="ri-close-line text-4xl text-red-600"></i>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Payment Failed</h3>
              <p className="text-slate-600 mb-6">{errorMessage}</p>
              <div className="flex flex-col gap-3 max-w-xs mx-auto">
                <button
                  onClick={() => {
                    setStep('method-selection');
                    setErrorMessage('');
                    setClientSecret('');
                    setSessionId('');
                  }}
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-6 py-4 rounded-xl font-bold transition-all cursor-pointer shadow-lg shadow-emerald-500/30"
                >
                  Try Again
                </button>
                <button
                  onClick={handleClose}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-4 rounded-xl font-bold transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
