import { useState, useEffect, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { useCurrencyFormat } from '../../../hooks/useCurrencyFormat';
import { useCurrency } from '../../../contexts/CurrencyContext';
import { parseToUSD } from '../../../lib/currencyUtils';
import { getCurrencySymbol } from '../../../lib/currencyUtils';
import { trackDeposit } from '../../../lib/analytics';
import { checkoutApi, userApi } from '../../../lib/api';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  onOpenCryptoDeposit?: () => void;
}

type Step = 'method-selection' | 'stripe-checkout' | 'processing' | 'success' | 'error';

export default function DepositModal({ isOpen, onClose, onSuccess, userId: _userId, onOpenCryptoDeposit }: DepositModalProps) {
  const { currency, rates } = useCurrency();
  const format = useCurrencyFormat();
  const currencySymbol = getCurrencySymbol(currency);

  const [step, setStep] = useState<Step>('method-selection');
  const [amount, setAmount] = useState('');
  const [depositAmountUSD, setDepositAmountUSD] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [newBalance, setNewBalance] = useState<number | null>(null);

  const [stripePromise, setStripePromise] = useState<Promise<any> | null>(null);
  const [clientSecret, setClientSecret] = useState<string>('');
  const [_sessionId, setSessionId] = useState<string>('');

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
  }, [fetchWalletBalance]);

  const resetForm = useCallback(() => {
    setStep('method-selection');
    setAmount('');
    setDepositAmountUSD(0);
    setErrorMessage('');
    setNewBalance(null);
    setIsProcessing(false);
    setClientSecret('');
    setSessionId('');
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  if (!isOpen) return null;

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
    if (isNaN(amountValue) || amountValue <= 0) return false;
    const amountUSD = parseToUSD(amountValue, currency, rates);
    return amountUSD >= 100 && amountUSD <= 2500;
  };

  const handleSelectCard = async () => {
    if (!isAmountValid()) return;

    const amountValue = parseFloat(amount);
    const amountUSD = parseToUSD(amountValue, currency, rates);
    const roundedAmountUSD = Math.round(amountUSD * 100) / 100;

    if (roundedAmountUSD < 100 || roundedAmountUSD > 2500) {
      setStep('error');
      setErrorMessage('Amount must be between $100 and $2,500 (USD).');
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');
    setDepositAmountUSD(roundedAmountUSD);

    try {
      const response = await checkoutApi.createStripeSession({
        amount: roundedAmountUSD,
        currency: 'USD',
        returnUrl: window.location.origin + '/dashboard?deposit=return&session_id={CHECKOUT_SESSION_ID}',
      });

      if (response.success && response.data?.clientSecret) {
        trackDeposit(amountUSD, currency, 'card');
        setClientSecret(response.data.clientSecret);
        setSessionId(response.data.sessionId);
        setStep('stripe-checkout');
      } else {
        setErrorMessage(response.error?.message || 'Failed to create checkout session');
        setStep('error');
      }
    } catch (error: any) {
      console.error('[DepositModal] Checkout error:', error);
      setStep('error');
      setErrorMessage(error?.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-3xl shadow-2xl w-full max-h-[95vh] overflow-hidden flex flex-col ${step === 'stripe-checkout' ? 'max-w-4xl' : 'max-w-lg'}`}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-3xl shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {step === 'method-selection' && 'Deposit Funds'}
                {step === 'stripe-checkout' && 'Complete Payment'}
                {step === 'processing' && 'Processing Payment'}
                {step === 'success' && 'Deposit Successful'}
                {step === 'error' && 'Payment Failed'}
              </h2>
              {step === 'stripe-checkout' && depositAmountUSD > 0 && (
                <p className="text-sm text-emerald-600 font-semibold">Amount: ${depositAmountUSD.toFixed(2)} USD</p>
              )}
            </div>
          </div>
          <button
            onClick={step === 'stripe-checkout' ? handleCancelCheckout : handleClose}
            className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer shrink-0"
            disabled={isProcessing}
          >
            <i className="ri-close-line text-xl text-slate-600"></i>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {step === 'method-selection' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-3">Enter Amount ({currency})</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 font-bold text-lg">{currencySymbol}</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-4 text-lg font-bold border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">Minimum: $100 | Maximum: $2,500</p>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {['100', '250', '500', '1000'].map((value) => (
                  <button
                    key={value}
                    onClick={() => setAmount(value)}
                    className="py-2 px-3 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-700 text-slate-700 font-bold rounded-xl transition-all cursor-pointer text-sm"
                  >
                    {currencySymbol}{parseInt(value).toLocaleString()}
                  </button>
                ))}
              </div>

              {amount && parseFloat(amount) > 0 && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Amount to Deposit</span>
                    <span className="text-xl font-bold text-emerald-600">{format(parseToUSD(parseFloat(amount), currency, rates))}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-3">Select Deposit Method</label>
                <div className="space-y-3">
                  <button
                    onClick={handleSelectCard}
                    disabled={!isAmountValid() || isProcessing}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50 hover:bg-emerald-100 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
                      <i className="ri-bank-card-line text-white text-xl"></i>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-slate-900">Card Deposit</p>
                      <p className="text-xs text-slate-500">Credit & Debit Cards - Instant</p>
                    </div>
                    {isProcessing ? (
                      <i className="ri-loader-4-line text-2xl text-emerald-600 animate-spin"></i>
                    ) : (
                      <i className="ri-arrow-right-s-line text-2xl text-emerald-600"></i>
                    )}
                  </button>

                  <button
                    onClick={handleSelectCrypto}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-slate-300 transition-all cursor-pointer"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                      <i className="ri-bit-coin-line text-white text-xl"></i>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-slate-900">Crypto Deposit</p>
                      <p className="text-xs text-slate-500">BTC, ETH, USDT, TRX</p>
                    </div>
                    <i className="ri-arrow-right-s-line text-2xl text-slate-400"></i>
                  </button>

                  <div className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed">
                    <div className="w-12 h-12 bg-gradient-to-br from-slate-400 to-slate-500 rounded-xl flex items-center justify-center">
                      <i className="ri-bank-line text-white text-xl"></i>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-slate-900">Fiat Deposit</p>
                      <p className="text-xs text-slate-500">Bank Transfer</p>
                    </div>
                    <span className="text-xs font-semibold bg-slate-200 text-slate-600 px-2 py-1 rounded-full">Coming Soon</span>
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <i className="ri-error-warning-line text-red-600 text-xl shrink-0"></i>
                  <p className="text-sm text-red-700">{errorMessage}</p>
                </div>
              )}
            </div>
          )}

          {step === 'stripe-checkout' && clientSecret && stripePromise && (
            <div className="flex flex-col h-full">
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                      <i className="ri-bank-card-line text-emerald-600"></i>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">Deposit Amount</p>
                      <p className="text-xl font-bold text-emerald-600">${depositAmountUSD.toFixed(2)} USD</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden flex-1 min-h-[400px]">
                <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  <i className="ri-lock-line text-emerald-600"></i>
                  Secure payment processing
                </p>
                <button onClick={handleCancelCheckout} className="text-sm text-slate-600 hover:text-slate-900 underline cursor-pointer">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="text-center py-8">
              <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl inline-block mx-auto">
                <p className="text-lg font-bold text-emerald-600">${depositAmountUSD.toFixed(2)} USD</p>
              </div>
              <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <i className="ri-loader-4-line text-4xl text-amber-600 animate-spin"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Processing Your Payment</h3>
              <p className="text-slate-600 mb-4">Please wait while we confirm your deposit...</p>
              <p className="text-sm text-slate-500">This may take a few moments. Do not close this window.</p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="ri-check-line text-4xl text-emerald-600"></i>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Deposit Successful!</h3>
              
              <div className="my-6 p-6 bg-emerald-50 border border-emerald-200 rounded-xl max-w-sm mx-auto">
                <p className="text-sm text-slate-600 mb-2">Amount Deposited</p>
                <p className="text-3xl font-bold text-emerald-600 mb-4">${depositAmountUSD.toFixed(2)} USD</p>
                
                {newBalance !== null && (
                  <div className="border-t border-emerald-200 pt-4">
                    <p className="text-sm text-slate-600 mb-1">New Balance</p>
                    <p className="text-xl font-bold text-slate-900">${newBalance.toFixed(2)} USD</p>
                  </div>
                )}
              </div>
              
              <p className="text-slate-600 mb-6">Your funds have been added to your account.</p>
              
              <div className="flex flex-col gap-3 max-w-xs mx-auto">
                <button
                  onClick={handleBackToWallet}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all cursor-pointer"
                >
                  Back to Wallet
                </button>
                <button
                  onClick={handleDepositAgain}
                  className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all cursor-pointer"
                >
                  Deposit Again
                </button>
              </div>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-8">
              {depositAmountUSD > 0 && (
                <div className="mb-4 p-4 bg-slate-100 border border-slate-200 rounded-xl inline-block mx-auto">
                  <p className="text-sm text-slate-600">Attempted Amount</p>
                  <p className="text-lg font-bold text-slate-700">${depositAmountUSD.toFixed(2)} USD</p>
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
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all cursor-pointer"
                >
                  Try Again
                </button>
                <button
                  onClick={handleClose}
                  className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all cursor-pointer"
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
