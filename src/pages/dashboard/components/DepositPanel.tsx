import { useState, useEffect, useRef, useCallback, type ReactElement } from 'react';
import { useCurrency } from '../../../contexts/CurrencyContext';
import { parseToUSD } from '../../../lib/currencyUtils';
import { trackDeposit } from '../../../lib/analytics';
import { checkoutApi, userApi } from '../../../lib/api';

interface DepositPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  onOpenCryptoDeposit?: () => void;
}

type Step = 'method-selection' | 'card-details' | 'checkout' | 'processing' | 'success' | 'error';

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

export default function DepositPanel({ isOpen, onClose, onSuccess, onOpenCryptoDeposit }: DepositPanelProps) {
  const { currency, rates } = useCurrency();
  
  const [step, setStep] = useState<Step>('method-selection');
  const [amount, setAmount] = useState('');
  const [depositAmountUSD, setDepositAmountUSD] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [initialBalance, setInitialBalance] = useState<number | null>(null);
  const [newBalance, setNewBalance] = useState<number | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  
  const [cardDetails, setCardDetails] = useState<CardDetails>({
    nameOnCard: '', cardNumber: '', expiryMonth: '', expiryYear: '', cvv: ''
  });
  
  const [billingAddress, setBillingAddress] = useState<BillingAddress>({
    streetAddress: '', city: '', postalCode: '', country: 'United States', state: ''
  });
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fetchWalletBalance = useCallback(async (): Promise<number> => {
    try {
      const walletsResult = await userApi.getWallets();
      if (walletsResult.success && walletsResult.data?.wallets) {
        const usdWallet = walletsResult.data.wallets.find((w: any) => w.currency === 'USD');
        return usdWallet?.balance || (usdWallet?.balanceCents ? usdWallet.balanceCents / 100 : 0);
      }
    } catch (error) {
      console.error('[DepositPanel] Error fetching balance:', error);
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
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      const currentBalance = await fetchWalletBalance();
      if (initialBalance !== null && currentBalance > initialBalance) {
        setNewBalance(currentBalance);
        setStep('success');
        stopBalancePolling();
      }
    }, 3000);
  }, [fetchWalletBalance, initialBalance, stopBalancePolling]);

  useEffect(() => {
    if (step === 'checkout' && initialBalance !== null) {
      startBalancePolling();
    } else if (step !== 'processing') {
      stopBalancePolling();
    }
    return () => { if (step === 'success') stopBalancePolling(); };
  }, [step, initialBalance, startBalancePolling, stopBalancePolling]);

  const resetForm = useCallback(() => {
    setStep('method-selection');
    setAmount('');
    setDepositAmountUSD(0);
    setErrorMessage('');
    setCheckoutUrl('');
    setInitialBalance(null);
    setNewBalance(null);
    setIsProcessing(false);
    setShowAddressForm(false);
    setCardDetails({ nameOnCard: '', cardNumber: '', expiryMonth: '', expiryYear: '', cvv: '' });
    setBillingAddress({ streetAddress: '', city: '', postalCode: '', country: 'United States', state: '' });
    stopBalancePolling();
  }, [stopBalancePolling]);

  useEffect(() => { if (!isOpen) resetForm(); }, [isOpen, resetForm]);

  if (!isOpen) return null;

  const handleClose = () => { stopBalancePolling(); resetForm(); onClose(); };
  const handleBackToWallet = () => { stopBalancePolling(); onSuccess(); resetForm(); onClose(); };

  const handleSelectCard = () => setStep('card-details');
  
  const handleSelectCrypto = () => {
    handleClose();
    if (onOpenCryptoDeposit) onOpenCryptoDeposit();
  };

  const isCardFormValid = (): boolean => {
    const cleanedCard = cardDetails.cardNumber.replace(/\s/g, '');
    return (
      cardDetails.nameOnCard.trim().length >= 2 &&
      cleanedCard.length >= 15 && cleanedCard.length <= 16 &&
      cardDetails.expiryMonth !== '' && cardDetails.expiryYear !== '' &&
      cardDetails.cvv.length >= 3 && cardDetails.cvv.length <= 4 &&
      billingAddress.streetAddress.trim() !== '' &&
      billingAddress.city.trim() !== '' &&
      billingAddress.postalCode.trim() !== ''
    );
  };

  const handleProceedToCheckout = async () => {
    const amountValue = parseFloat(amount) || 100;
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
      const currentBalance = await fetchWalletBalance();
      setInitialBalance(currentBalance);

      const response = await checkoutApi.createCardCheckout({
        amount: roundedAmountUSD,
        currency: 'USD',
        merchantName: 'Card Deposit'
      });

      if (response.success && response.data?.checkoutUrl) {
        trackDeposit(amountUSD, currency, 'card');
        setCheckoutUrl(response.data.checkoutUrl);
        setStep('checkout');
      } else {
        throw new Error(response.error?.message || 'Failed to create checkout session');
      }
    } catch (error: any) {
      setStep('error');
      setErrorMessage(error?.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const cardType = detectCardType(cardDetails.cardNumber);
  const getCardIcon = () => {
    const icons: Record<string, ReactElement> = {
      visa: <span className="text-blue-600 font-bold text-xs">VISA</span>,
      mastercard: <span className="text-orange-600 font-bold text-xs">MC</span>,
      amex: <span className="text-blue-800 font-bold text-xs">AMEX</span>,
      discover: <span className="text-orange-500 font-bold text-xs">DISC</span>,
    };
    return icons[cardType] || <i className="ri-bank-card-line text-slate-400"></i>;
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={handleClose}
      />
      
      {/* Slide-in Panel from Right */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            {step !== 'method-selection' && step !== 'success' && step !== 'error' && (
              <button
                onClick={() => setStep(step === 'checkout' ? 'card-details' : 'method-selection')}
                className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <i className="ri-arrow-left-line text-slate-600"></i>
              </button>
            )}
            <h2 className="text-lg font-bold text-slate-900">
              {step === 'method-selection' && 'Deposit'}
              {step === 'card-details' && 'Add Prepaid Card'}
              {step === 'checkout' && 'Complete Payment'}
              {step === 'processing' && 'Processing'}
              {step === 'success' && 'Deposit Successful'}
              {step === 'error' && 'Payment Failed'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-xl text-slate-600"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto h-[calc(100%-60px)]">
          
          {/* Step 1: Method Selection (CardXC Style) */}
          {step === 'method-selection' && (
            <div className="space-y-4">
              {/* Animated coin icons like CardXC */}
              <div className="flex items-center justify-center gap-3 py-6">
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                  <i className="ri-money-dollar-circle-line text-white text-2xl"></i>
                </div>
                <div className="flex gap-1">
                  <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center">
                    <i className="ri-bit-coin-line text-white text-sm"></i>
                  </div>
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">T</span>
                  </div>
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">E</span>
                  </div>
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">$</span>
                  </div>
                </div>
              </div>

              <h3 className="text-center text-xl font-bold text-slate-900">Deposit</h3>
              
              {/* Deposit Methods - CardXC Colorful Style */}
              <div className="space-y-3 mt-6">
                {/* Crypto Deposit - Purple */}
                <button
                  onClick={handleSelectCrypto}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 transition-all cursor-pointer shadow-md"
                >
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <i className="ri-bit-coin-line text-white text-xl"></i>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-white">Crypto Deposit</p>
                    <p className="text-xs text-white/80">Fund your wallet by deposit from external wallet</p>
                  </div>
                </button>

                {/* Fiat Deposit - Orange (Coming Soon) */}
                <div className="w-full flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 opacity-60 cursor-not-allowed shadow-md">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <i className="ri-bank-line text-white text-xl"></i>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-white">Fiat Deposit</p>
                    <p className="text-xs text-white/80">Deposit from bank account</p>
                  </div>
                  <span className="text-xs bg-white/30 px-2 py-1 rounded-full text-white font-medium">Soon</span>
                </div>

                {/* Card Deposit - Green */}
                <button
                  onClick={handleSelectCard}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 transition-all cursor-pointer shadow-md"
                >
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <i className="ri-bank-card-line text-white text-xl"></i>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-white">Card Deposit</p>
                    <p className="text-xs text-white/80">Deposit from your credit/debit card</p>
                  </div>
                </button>

                {/* Online Wallet - Blue (Coming Soon) */}
                <div className="w-full flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-400 to-cyan-500 opacity-60 cursor-not-allowed shadow-md">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <i className="ri-wallet-3-line text-white text-xl"></i>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-white">Online Wallet</p>
                    <p className="text-xs text-white/80">Deposit from your digital wallets</p>
                  </div>
                  <span className="text-xs bg-white/30 px-2 py-1 rounded-full text-white font-medium">Soon</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Card Details (CardXC Style) */}
          {step === 'card-details' && (
            <div className="space-y-5">
              <p className="text-sm text-slate-600 text-center mb-6">
                Spend your debit / credit card by adding the card details below.
              </p>

              {/* Name on Card */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Name on Card</label>
                <input
                  type="text"
                  value={cardDetails.nameOnCard}
                  onChange={(e) => setCardDetails({ ...cardDetails, nameOnCard: e.target.value })}
                  placeholder="Enter name as it appears on card"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              {/* Card Number */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Card Number</label>
                <div className="relative">
                  <input
                    type="text"
                    value={cardDetails.cardNumber}
                    onChange={(e) => setCardDetails({ ...cardDetails, cardNumber: formatCardNumber(e.target.value) })}
                    placeholder="4100 4000 2200 1000"
                    maxLength={19}
                    className="w-full px-4 py-3 pr-14 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {getCardIcon()}
                  </div>
                </div>
              </div>

              {/* Expiry & CVV - CardXC uses separate text inputs */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Expiry Date</label>
                  <input
                    type="text"
                    value={cardDetails.expiryMonth}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                      setCardDetails({ ...cardDetails, expiryMonth: val });
                    }}
                    placeholder="MM"
                    maxLength={2}
                    className="w-full px-3 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">&nbsp;</label>
                  <input
                    type="text"
                    value={cardDetails.expiryYear}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setCardDetails({ ...cardDetails, expiryYear: val });
                    }}
                    placeholder="YYYY"
                    maxLength={4}
                    className="w-full px-3 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">CVV</label>
                  <input
                    type="text"
                    value={cardDetails.cvv}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setCardDetails({ ...cardDetails, cvv: val });
                    }}
                    placeholder="CVC/CVV"
                    maxLength={4}
                    className="w-full px-3 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center"
                  />
                </div>
              </div>

              {/* Billing Address */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Billing Address</label>
                {!showAddressForm ? (
                  <>
                    <input
                      type="text"
                      value={billingAddress.streetAddress}
                      onChange={(e) => setBillingAddress({ ...billingAddress, streetAddress: e.target.value })}
                      placeholder="Enter Address"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      onClick={() => setShowAddressForm(true)}
                      className="text-sm text-emerald-600 hover:text-emerald-700 font-medium mt-2 cursor-pointer underline"
                    >
                      Enter Address Manually
                    </button>
                  </>
                ) : (
                  <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <input
                      type="text"
                      value={billingAddress.streetAddress}
                      onChange={(e) => setBillingAddress({ ...billingAddress, streetAddress: e.target.value })}
                      placeholder="Street Address"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={billingAddress.city}
                        onChange={(e) => setBillingAddress({ ...billingAddress, city: e.target.value })}
                        placeholder="City"
                        className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <input
                        type="text"
                        value={billingAddress.state}
                        onChange={(e) => setBillingAddress({ ...billingAddress, state: e.target.value })}
                        placeholder="State"
                        className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={billingAddress.postalCode}
                        onChange={(e) => setBillingAddress({ ...billingAddress, postalCode: e.target.value })}
                        placeholder="Postal Code"
                        className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <input
                        type="text"
                        value={billingAddress.country}
                        onChange={(e) => setBillingAddress({ ...billingAddress, country: e.target.value })}
                        placeholder="Country"
                        className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Amount (Optional - can be added after card) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Deposit Amount (USD)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="100.00"
                  min="100"
                  max="2500"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-slate-500 mt-1">Min: $100 | Max: $2,500</p>
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              <button
                onClick={handleProceedToCheckout}
                disabled={!isCardFormValid() || isProcessing || !amount || parseFloat(amount) < 100}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <><i className="ri-loader-4-line animate-spin"></i> Processing...</>
                ) : (
                  'Proceed'
                )}
              </button>
            </div>
          )}

          {/* Step 3: Checkout */}
          {step === 'checkout' && checkoutUrl && (
            <div className="flex flex-col h-full">
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">Deposit Amount</span>
                  <span className="text-lg font-bold text-emerald-600">${depositAmountUSD.toFixed(2)}</span>
                </div>
              </div>
              <div className="bg-slate-100 rounded-xl overflow-hidden flex-1 min-h-[350px]">
                <iframe
                  ref={iframeRef}
                  src={checkoutUrl}
                  className="w-full h-full min-h-[350px] border-0"
                  title="Secure Checkout"
                  allow="payment"
                  sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-top-navigation"
                />
              </div>
              <button
                onClick={() => { setStep('card-details'); setCheckoutUrl(''); }}
                className="mt-4 text-sm text-slate-600 hover:text-slate-900 underline cursor-pointer text-center"
              >
                Cancel Payment
              </button>
            </div>
          )}

          {/* Processing */}
          {step === 'processing' && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <i className="ri-loader-4-line text-4xl text-amber-600 animate-spin"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Processing Payment</h3>
              <p className="text-slate-600">Please wait...</p>
            </div>
          )}

          {/* Success */}
          {step === 'success' && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="ri-check-line text-4xl text-emerald-600"></i>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Deposit Successful!</h3>
              <div className="my-6 p-6 bg-emerald-50 border border-emerald-200 rounded-xl max-w-xs mx-auto">
                <p className="text-sm text-slate-600 mb-2">Amount Deposited</p>
                <p className="text-3xl font-bold text-emerald-600">${depositAmountUSD.toFixed(2)}</p>
                {newBalance !== null && (
                  <div className="border-t border-emerald-200 pt-3 mt-3">
                    <p className="text-sm text-slate-600">New Balance</p>
                    <p className="text-xl font-bold text-slate-900">${newBalance.toFixed(2)}</p>
                  </div>
                )}
              </div>
              <button
                onClick={handleBackToWallet}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all cursor-pointer"
              >
                Back to Dashboard
              </button>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="ri-close-line text-4xl text-red-600"></i>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Payment Failed</h3>
              <p className="text-slate-600 mb-6">{errorMessage}</p>
              <button
                onClick={() => { setStep('card-details'); setErrorMessage(''); }}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
