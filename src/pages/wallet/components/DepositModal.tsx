import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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

type Step = 'method-selection' | 'card-details' | 'billing-address' | 'checkout' | 'processing' | 'success' | 'error';

interface CardDetails {
  nameOnCard: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
}

interface BillingAddress {
  streetAddress: string;
  city: string;
  postalCode: string;
  country: string;
  state: string;
}

const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 
  'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Ireland', 'New Zealand',
  'Singapore', 'Hong Kong', 'Japan', 'South Korea', 'Sweden', 'Norway', 'Denmark',
  'Finland', 'Italy', 'Spain', 'Portugal', 'Poland', 'Czech Republic', 'Other'
];

const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

const getYears = () => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 15 }, (_, i) => String(currentYear + i));
};

const detectCardType = (cardNumber: string): string => {
  const cleaned = cardNumber.replace(/\s/g, '');
  if (/^4/.test(cleaned)) return 'visa';
  if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) return 'mastercard';
  if (/^3[47]/.test(cleaned)) return 'amex';
  if (/^6(?:011|5)/.test(cleaned)) return 'discover';
  return 'unknown';
};

const formatCardNumber = (value: string): string => {
  const cleaned = value.replace(/\D/g, '').slice(0, 16);
  const groups = cleaned.match(/.{1,4}/g);
  return groups ? groups.join(' ') : cleaned;
};

export default function DepositModal({ currency, onClose, onSuccess, onOpenCryptoDeposit }: DepositModalProps) {
  const navigate = useNavigate();
  const checkoutCurrency = SUPPORTED_CHECKOUT_CURRENCIES.includes(currency) ? currency : 'USD';
  const config = currencyConfig[checkoutCurrency] || currencyConfig.USD;

  const [step, setStep] = useState<Step>('method-selection');
  const [amount, setAmount] = useState('');
  const [depositAmount, setDepositAmount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [checkoutErrorCode, setCheckoutErrorCode] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [initialBalance, setInitialBalance] = useState<number | null>(null);
  const [newBalance, setNewBalance] = useState<number | null>(null);

  const [cardDetails, setCardDetails] = useState<CardDetails>({
    nameOnCard: '',
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: ''
  });

  const [billingAddress, setBillingAddress] = useState<BillingAddress>({
    streetAddress: '',
    city: '',
    postalCode: '',
    country: 'United States',
    state: ''
  });

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const successHandledRef = useRef(false);

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

  const stopBalancePolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startBalancePolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    
    pollingRef.current = setInterval(async () => {
      const currentBalance = await fetchWalletBalance();
      if (initialBalance !== null && currentBalance > initialBalance) {
        setNewBalance(currentBalance);
        setStep('success');
        stopBalancePolling();
        successHandledRef.current = true;
        localStorage.removeItem('pendingDeposit');
        localStorage.removeItem('depositInProgress');
      }
    }, 3000);
  }, [fetchWalletBalance, initialBalance, stopBalancePolling]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'payment_success' || 
          event.data?.status === 'success' ||
          event.data?.event === 'checkout.completed') {
        setStep('processing');
      }
      
      if (event.data?.type === 'payment_error' || 
          event.data?.status === 'error' ||
          event.data?.event === 'checkout.failed') {
        setStep('error');
        setErrorMessage(event.data?.message || 'Payment failed. Please try again.');
        stopBalancePolling();
      }
      
      if (event.data?.type === 'payment_cancelled' ||
          event.data?.event === 'checkout.cancelled') {
        setStep('card-details');
        setCheckoutUrl('');
        stopBalancePolling();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [stopBalancePolling]);

  useEffect(() => {
    if (step === 'checkout' && initialBalance !== null) {
      startBalancePolling();
    } else if (step !== 'processing') {
      stopBalancePolling();
    }
    
    return () => {
      if (step === 'success') {
        stopBalancePolling();
      }
    };
  }, [step, initialBalance, startBalancePolling, stopBalancePolling]);

  const resetForm = useCallback(() => {
    setStep('method-selection');
    setAmount('');
    setDepositAmount(0);
    setErrorMessage('');
    setCheckoutUrl('');
    setInitialBalance(null);
    setNewBalance(null);
    setIsProcessing(false);
    setCardDetails({
      nameOnCard: '',
      cardNumber: '',
      expiryMonth: '',
      expiryYear: '',
      cvv: ''
    });
    setBillingAddress({
      streetAddress: '',
      city: '',
      postalCode: '',
      country: 'United States',
      state: ''
    });
    successHandledRef.current = false;
    stopBalancePolling();
    localStorage.removeItem('pendingDeposit');
    localStorage.removeItem('depositInProgress');
  }, [stopBalancePolling]);

  const getAmountError = (val: string): string | null => {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) return 'Please enter a valid amount';
    if (num < 100) return `Minimum deposit is ${config.symbol}100`;
    if (num > 2500) return `Maximum deposit is ${config.symbol}2,500`;
    return null;
  };

  const handleClose = () => {
    stopBalancePolling();
    resetForm();
    onClose();
  };

  const handleBackToWallet = () => {
    stopBalancePolling();
    onSuccess();
    resetForm();
    onClose();
  };

  const handleDepositAgain = () => {
    resetForm();
  };

  const handleSelectCard = () => {
    setStep('card-details');
  };

  const handleSelectCrypto = () => {
    handleClose();
    if (onOpenCryptoDeposit) {
      onOpenCryptoDeposit();
    }
  };

  const isCardFormValid = (): boolean => {
    const cleanedCard = cardDetails.cardNumber.replace(/\s/g, '');
    return (
      cardDetails.nameOnCard.trim().length >= 2 &&
      cleanedCard.length >= 15 &&
      cleanedCard.length <= 16 &&
      cardDetails.expiryMonth !== '' &&
      cardDetails.expiryYear !== '' &&
      cardDetails.cvv.length >= 3 &&
      cardDetails.cvv.length <= 4 &&
      billingAddress.streetAddress.trim() !== '' &&
      billingAddress.city.trim() !== '' &&
      billingAddress.postalCode.trim() !== '' &&
      billingAddress.country !== '' &&
      billingAddress.state.trim() !== ''
    );
  };

  const isAmountValid = (): boolean => {
    const amountValue = parseFloat(amount);
    return !isNaN(amountValue) && amountValue >= 100 && amountValue <= 2500;
  };

  const handleProceedToCheckout = async () => {
    const numAmount = parseFloat(amount);
    const roundedAmount = Math.round(numAmount * 100) / 100;

    if (roundedAmount < 100 || roundedAmount > 2500) {
      setStep('error');
      setErrorMessage('Amount must be between $100 and $2,500 (USD).');
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');
    setDepositAmount(roundedAmount);

    try {
      const currentBalance = await fetchWalletBalance();
      setInitialBalance(currentBalance);

      const response = await checkoutApi.createCardCheckout({
        amount: roundedAmount,
        currency: checkoutCurrency,
        merchantName: 'Card Deposit'
      });

      if (response.success && response.data?.checkoutUrl) {
        setCheckoutUrl(response.data.checkoutUrl);
        setStep('checkout');
      } else {
        setCheckoutErrorCode(response.error?.code ?? null);
        setErrorMessage(response.error?.message || 'Failed to create checkout session');
        setStep('error');
      }
    } catch (error: any) {
      console.error('[DepositModal] Checkout error:', error);
      setCheckoutErrorCode(null);
      setStep('error');
      setErrorMessage(error?.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelCheckout = () => {
    stopBalancePolling();
    setStep('card-details');
    setCheckoutUrl('');
  };

  const handleSaveAddress = () => {
    setStep('card-details');
  };

  const cardType = detectCardType(cardDetails.cardNumber);

  const getCardIcon = () => {
    switch (cardType) {
      case 'visa':
        return <span className="text-blue-600 font-bold text-sm">VISA</span>;
      case 'mastercard':
        return <span className="text-orange-600 font-bold text-sm">MC</span>;
      case 'amex':
        return <span className="text-blue-800 font-bold text-sm">AMEX</span>;
      case 'discover':
        return <span className="text-orange-500 font-bold text-sm">DISC</span>;
      default:
        return <i className="ri-bank-card-line text-slate-400"></i>;
    }
  };

  const getBillingAddressSummary = () => {
    const parts = [billingAddress.streetAddress, billingAddress.city, billingAddress.state, billingAddress.postalCode, billingAddress.country]
      .filter(p => p.trim() !== '');
    return parts.length > 0 ? parts.join(', ') : 'No address entered';
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-3xl shadow-2xl w-full max-h-[90vh] overflow-hidden flex flex-col ${step === 'checkout' ? 'max-w-4xl' : 'max-w-md'}`}>
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {(step === 'card-details' || step === 'billing-address') && (
                <button
                  onClick={() => setStep(step === 'billing-address' ? 'card-details' : 'method-selection')}
                  className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <i className="ri-arrow-left-line text-slate-600"></i>
                </button>
              )}
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {step === 'method-selection' && 'Deposit Funds'}
                  {step === 'card-details' && 'Add Card Details'}
                  {step === 'billing-address' && 'Billing Address'}
                  {step === 'checkout' && 'Complete Payment'}
                  {step === 'processing' && 'Processing Payment'}
                  {step === 'success' && 'Deposit Successful'}
                  {step === 'error' && 'Payment Failed'}
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  {step === 'method-selection' && `Add money to your ${currency} account`}
                  {step === 'checkout' && <span className="text-emerald-600 font-semibold">Amount: {config.symbol}{depositAmount.toFixed(2)}</span>}
                </p>
              </div>
            </div>
            <button
              onClick={step === 'checkout' ? handleCancelCheckout : handleClose}
              className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              disabled={isProcessing}
            >
              <i className="ri-close-line text-2xl text-slate-600"></i>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {step === 'method-selection' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Amount to Deposit</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">
                    {config.symbol}
                  </span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-12 pr-4 py-4 text-2xl font-bold border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors bg-white text-slate-900"
                    style={{ color: '#0f172a', WebkitTextFillColor: '#0f172a' }}
                  />
                </div>
                <p className="text-sm text-slate-500 mt-2">{config.name} (Card deposits processed in {checkoutCurrency})</p>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {['100', '250', '500', '1000'].map((value) => (
                  <button
                    key={value}
                    onClick={() => setAmount(value)}
                    className="py-2 px-2 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-700 text-slate-700 font-bold rounded-xl transition-all cursor-pointer text-sm"
                  >
                    {config.symbol}{parseInt(value).toLocaleString()}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Deposit Method</label>
                <div className="space-y-3">
                  <button
                    onClick={handleSelectCard}
                    disabled={!isAmountValid()}
                    className="w-full flex items-center space-x-4 p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50 hover:bg-emerald-100 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
                      <i className="ri-bank-card-line text-white text-xl"></i>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-slate-900">Card Deposit</p>
                      <p className="text-sm text-slate-500">Visa, Mastercard, Amex - Instant</p>
                    </div>
                    <i className="ri-arrow-right-s-line text-2xl text-emerald-600"></i>
                  </button>

                  <button
                    onClick={handleSelectCrypto}
                    className="w-full flex items-center space-x-4 p-4 rounded-xl border-2 border-slate-200 hover:border-slate-300 transition-all cursor-pointer"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                      <i className="ri-bit-coin-line text-white text-xl"></i>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-slate-900">Crypto Deposit</p>
                      <p className="text-sm text-slate-500">BTC, ETH, USDT, TRX</p>
                    </div>
                    <i className="ri-arrow-right-s-line text-2xl text-slate-400"></i>
                  </button>

                  <div className="w-full flex items-center space-x-4 p-4 rounded-xl border-2 border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed">
                    <div className="w-12 h-12 bg-gradient-to-br from-slate-400 to-slate-500 rounded-xl flex items-center justify-center">
                      <i className="ri-bank-line text-white text-xl"></i>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-slate-900">Fiat Deposit</p>
                      <p className="text-sm text-slate-500">Bank Transfer</p>
                    </div>
                    <span className="text-xs font-semibold bg-slate-200 text-slate-600 px-2 py-1 rounded-full">Coming Soon</span>
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-600">{errorMessage}</p>
                </div>
              )}

              {amount && getAmountError(amount) && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm text-amber-600">{getAmountError(amount)}</p>
                </div>
              )}

              <p className="text-xs text-slate-500 text-center">
                Deposit range: {config.symbol}100 - {config.symbol}2,500
              </p>
            </div>
          )}

          {step === 'card-details' && (
            <div className="space-y-5">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Deposit Amount</span>
                  <span className="text-lg font-bold text-emerald-600">{config.symbol}{parseFloat(amount).toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Name on Card</label>
                <input
                  type="text"
                  value={cardDetails.nameOnCard}
                  onChange={(e) => setCardDetails({ ...cardDetails, nameOnCard: e.target.value })}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Card Number</label>
                <div className="relative">
                  <input
                    type="text"
                    value={cardDetails.cardNumber}
                    onChange={(e) => setCardDetails({ ...cardDetails, cardNumber: formatCardNumber(e.target.value) })}
                    placeholder="1234 5678 9012 3456"
                    maxLength={19}
                    className="w-full px-4 py-3 pr-16 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white text-slate-900"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {getCardIcon()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Expiry Date</label>
                  <div className="flex gap-2">
                    <select
                      value={cardDetails.expiryMonth}
                      onChange={(e) => setCardDetails({ ...cardDetails, expiryMonth: e.target.value })}
                      className="flex-1 px-3 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
                    >
                      <option value="">MM</option>
                      {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select
                      value={cardDetails.expiryYear}
                      onChange={(e) => setCardDetails({ ...cardDetails, expiryYear: e.target.value })}
                      className="flex-1 px-3 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
                    >
                      <option value="">YYYY</option>
                      {getYears().map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">CVV</label>
                  <input
                    type="text"
                    value={cardDetails.cvv}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setCardDetails({ ...cardDetails, cvv: value });
                    }}
                    placeholder="123"
                    maxLength={4}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Billing Address</label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-sm text-slate-600 truncate">{getBillingAddressSummary()}</p>
                </div>
                <button
                  onClick={() => setStep('billing-address')}
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-semibold mt-2 cursor-pointer"
                >
                  Enter Address Manually
                </button>
              </div>

              {errorMessage && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <i className="ri-error-warning-line text-red-600 text-xl shrink-0"></i>
                  <p className="text-sm text-red-700">{errorMessage}</p>
                </div>
              )}

              <button
                onClick={handleProceedToCheckout}
                disabled={!isCardFormValid() || isProcessing}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-slate-300 disabled:to-slate-400 text-white px-6 py-4 rounded-xl font-bold transition-all cursor-pointer shadow-lg shadow-emerald-500/30 disabled:shadow-none flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>
                    Creating Checkout...
                  </>
                ) : (
                  <>
                    <i className="ri-secure-payment-line"></i>
                    Proceed to Checkout
                  </>
                )}
              </button>

              <p className="text-xs text-slate-500 text-center">
                Your card details are used for validation. Payment is processed securely.
              </p>
            </div>
          )}

          {step === 'billing-address' && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Street Address</label>
                <input
                  type="text"
                  value={billingAddress.streetAddress}
                  onChange={(e) => setBillingAddress({ ...billingAddress, streetAddress: e.target.value })}
                  placeholder="123 Main Street, Apt 4B"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">City</label>
                  <input
                    type="text"
                    value={billingAddress.city}
                    onChange={(e) => setBillingAddress({ ...billingAddress, city: e.target.value })}
                    placeholder="New York"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">State / Province</label>
                  <input
                    type="text"
                    value={billingAddress.state}
                    onChange={(e) => setBillingAddress({ ...billingAddress, state: e.target.value })}
                    placeholder="NY"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Postal Code</label>
                  <input
                    type="text"
                    value={billingAddress.postalCode}
                    onChange={(e) => setBillingAddress({ ...billingAddress, postalCode: e.target.value })}
                    placeholder="10001"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Country</label>
                  <select
                    value={billingAddress.country}
                    onChange={(e) => setBillingAddress({ ...billingAddress, country: e.target.value })}
                    className="w-full px-3 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
                  >
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <button
                onClick={handleSaveAddress}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-6 py-4 rounded-xl font-bold transition-all cursor-pointer shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
              >
                <i className="ri-save-line"></i>
                Save Address
              </button>
            </div>
          )}

          {step === 'checkout' && checkoutUrl && (
            <div className="flex flex-col h-full">
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                      <i className="ri-bank-card-line text-emerald-600"></i>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">Deposit Amount</p>
                      <p className="text-xl font-bold text-emerald-600">{config.symbol}{depositAmount.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-amber-600">
                    <i className="ri-time-line animate-pulse"></i>
                    <span className="text-xs font-medium">Awaiting payment...</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-100 rounded-2xl overflow-hidden flex-1 min-h-[400px]">
                <iframe
                  ref={iframeRef}
                  src={checkoutUrl}
                  className="w-full h-full min-h-[400px] border-0"
                  title="Secure Checkout"
                  allow="payment"
                  sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-top-navigation"
                />
              </div>
              
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  <i className="ri-lock-line text-emerald-600"></i>
                  Your payment is processed securely
                </p>
                <button
                  onClick={handleCancelCheckout}
                  className="text-sm text-slate-600 hover:text-slate-900 underline cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

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
                    <p className="text-xl font-bold text-slate-900">${newBalance.toFixed(2)} USD</p>
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
              <h3 className="text-2xl font-bold text-slate-900 mb-2">
                {checkoutErrorCode === 'EMAIL_VERIFICATION_REQUIRED' ? 'Email verification required' :
                  checkoutErrorCode === 'KYC_REQUIRED' ? 'Verification required' : 'Payment Failed'}
              </h3>
              <p className="text-slate-600 mb-6">{errorMessage}</p>
              {checkoutErrorCode === 'EMAIL_VERIFICATION_REQUIRED' && (
                <p className="text-sm text-slate-500 mb-4">Check your inbox for a verification link, or update your email in Settings.</p>
              )}
              {checkoutErrorCode === 'KYC_REQUIRED' && (
                <p className="text-sm text-slate-500 mb-4">Complete identity verification in Settings to add funds with a card.</p>
              )}
              <div className="flex flex-col gap-3 max-w-xs mx-auto">
                {(checkoutErrorCode === 'EMAIL_VERIFICATION_REQUIRED' || checkoutErrorCode === 'KYC_REQUIRED') && (
                  <button
                    onClick={() => { onClose(); navigate('/settings'); }}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-xl font-bold transition-all cursor-pointer"
                  >
                    {checkoutErrorCode === 'EMAIL_VERIFICATION_REQUIRED' ? 'Go to Settings' : 'Complete verification'}
                  </button>
                )}
                <button
                  onClick={() => {
                    setStep('card-details');
                    setErrorMessage('');
                    setCheckoutErrorCode(null);
                    setCheckoutUrl('');
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
