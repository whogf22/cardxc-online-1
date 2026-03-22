import { useState } from 'react';
import { userApi } from '../../../lib/api';
import { useCurrencyFormat } from '../../../hooks/useCurrencyFormat';
import { useCurrency } from '../../../contexts/CurrencyContext';
import { parseToUSD } from '../../../lib/currencyUtils';
import { trackWithdrawal } from '../../../lib/analytics';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  currentBalance: number;
}

export default function WithdrawModal({ isOpen, onClose, onSuccess, userId: _userId, currentBalance }: WithdrawModalProps) {
  const { currency, rates } = useCurrency();
  const format = useCurrencyFormat();
  
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [withdrawStatus, setWithdrawStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [referenceId, setReferenceId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleAmountSelect = (value: string) => {
    setAmount(value);
  };

  const handleAccountNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 10) {
      setAccountNumber(value);
    }
  };

  const handleWithdrawRequest = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setErrorMessage('Please enter a valid amount');
      return;
    }

    const withdrawAmount = parseFloat(amount);
    const withdrawAmountUSD = parseToUSD(withdrawAmount, currency, rates);
    
    if (withdrawAmountUSD > currentBalance) {
      setErrorMessage('Insufficient balance');
      return;
    }

    if (!bankName || !accountNumber || !accountName) {
      setErrorMessage('Please fill in all bank details');
      return;
    }

    if (accountNumber.length !== 10) {
      setErrorMessage('Account number must be 10 digits');
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');
    setWithdrawStatus('processing');

    try {
      trackWithdrawal(withdrawAmountUSD, currency);

      const result = await userApi.requestWithdrawal({
        amount: withdrawAmountUSD,
        currency: currency,
        bankName: bankName,
        accountNumber: accountNumber,
        accountName: accountName
      });

      if (!result.success) {
        throw new Error(result.error?.message || 'Withdrawal request failed');
      }

      const refId = result.data?.withdrawalId || `WR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      setReferenceId(refId);

      await new Promise(resolve => setTimeout(resolve, 2000));

      setWithdrawStatus('success');

      await new Promise(resolve => setTimeout(resolve, 1500));

      onSuccess();
      handleClose();
    } catch (error: any) {
      setWithdrawStatus('error');
      setErrorMessage(error.message || 'Withdrawal request failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    
    setAmount('');
    setBankName('');
    setAccountNumber('');
    setAccountName('');
    setWithdrawStatus('idle');
    setReferenceId('');
    setErrorMessage('');
    setIsProcessing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-8 py-6 flex items-center justify-between rounded-t-3xl">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Request Withdrawal</h2>
            <p className="text-sm text-slate-600 mt-1">Submit request for admin approval</p>
          </div>
          <button
            onClick={handleClose}
            className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            disabled={isProcessing}
          >
            <i className="ri-close-line text-xl text-slate-600"></i>
          </button>
        </div>

        <div className="p-8">
          {withdrawStatus === 'idle' && (
            <>
              {/* Available Balance */}
              <div className="mb-6 p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-emerald-700">Available Balance</span>
                    <p className="text-3xl font-bold text-emerald-900 mt-1">{format(currentBalance)}</p>
                  </div>
                  <div className="w-14 h-14 bg-emerald-200 rounded-xl flex items-center justify-center">
                    <i className="ri-wallet-3-fill text-2xl text-emerald-700"></i>
                  </div>
                </div>
              </div>

              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                <i className="ri-information-line text-blue-600 text-xl"></i>
                <div>
                  <p className="text-sm font-bold text-blue-900 mb-1">Admin Approval Required</p>
                  <p className="text-xs text-blue-700">Your withdrawal request will be reviewed by our admin team. Approved requests are processed within 24 hours.</p>
                </div>
              </div>

              {/* Amount Input */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-900 mb-3">Withdrawal Amount (NGN)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 font-bold text-lg">₦</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    max={currentBalance}
                    className="w-full pl-10 pr-4 py-4 text-lg font-bold border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                {amount && parseToUSD(parseFloat(amount), currency, rates) > currentBalance && (
                  <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                    <i className="ri-error-warning-line"></i>
                    Insufficient balance
                  </p>
                )}
              </div>

              {/* Quick Amount Buttons */}
              <div className="mb-8">
                <label className="block text-sm font-bold text-slate-900 mb-3">Quick Select</label>
                <div className="grid grid-cols-4 gap-3">
                  {['5000', '10000', '25000', '50000'].map((value) => (
                    <button
                      key={value}
                      onClick={() => handleAmountSelect(value)}
                      disabled={parseToUSD(parseFloat(value), currency, rates) > currentBalance}
                      className="py-3 px-4 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-700 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed text-slate-700 font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap"
                    >
                      ₦{parseInt(value).toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bank Details */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Bank Name</label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent cursor-pointer"
                  >
                    <option value="">Select your bank</option>
                    <option value="Access Bank">Access Bank</option>
                    <option value="GTBank">GTBank</option>
                    <option value="First Bank">First Bank</option>
                    <option value="UBA">UBA</option>
                    <option value="Zenith Bank">Zenith Bank</option>
                    <option value="Kuda Bank">Kuda Bank</option>
                    <option value="Opay">Opay</option>
                    <option value="Palmpay">Palmpay</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Account Number</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={handleAccountNumberChange}
                    placeholder="0123456789"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Account Name</label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="JOHN DOE"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent uppercase"
                  />
                </div>
              </div>

              {errorMessage && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <i className="ri-error-warning-line text-red-600 text-xl"></i>
                  <p className="text-sm text-red-700">{errorMessage}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleWithdrawRequest}
                disabled={isProcessing || !amount || parseFloat(amount) <= 0 || parseToUSD(parseFloat(amount), currency, rates) > currentBalance || !bankName || !accountNumber || !accountName}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>
                    Submitting Request...
                  </>
                ) : (
                  <>
                    <i className="ri-send-plane-fill"></i>
                    Submit Withdrawal Request
                  </>
                )}
              </button>
            </>
          )}

          {/* Processing State */}
          {withdrawStatus === 'processing' && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <i className="ri-loader-4-line text-4xl text-emerald-600 animate-spin"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Submitting Request</h3>
              <p className="text-slate-600 mb-6">Please wait while we process your withdrawal request...</p>
            </div>
          )}

          {/* Success State */}
          {withdrawStatus === 'success' && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="ri-check-line text-4xl text-emerald-600"></i>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Request Submitted!</h3>
              <p className="text-slate-600 mb-6">Your withdrawal request has been submitted for admin approval</p>
              
              <div className="max-w-md mx-auto mb-6 p-6 bg-slate-50 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Amount Requested</span>
                  <span className="text-lg font-bold text-slate-900">₦{parseFloat(amount || '0').toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Bank</span>
                  <span className="text-sm font-medium text-slate-900">{bankName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Account</span>
                  <span className="text-sm font-mono text-slate-900">{accountNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Reference ID</span>
                  <span className="text-sm font-mono text-slate-900">{referenceId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Status</span>
                  <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg">
                    PENDING APPROVAL
                  </span>
                </div>
              </div>

              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-900">
                  <i className="ri-time-line mr-2"></i>
                  Your request will be reviewed within 24 hours. You'll be notified once approved.
                </p>
              </div>

              <button
                onClick={handleClose}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                Done
              </button>
            </div>
          )}

          {/* Error State */}
          {withdrawStatus === 'error' && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="ri-close-line text-4xl text-red-600"></i>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Request Failed</h3>
              <p className="text-slate-600 mb-6">{errorMessage || 'An unexpected error occurred'}</p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setWithdrawStatus('idle');
                    setErrorMessage('');
                  }}
                  className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap"
                >
                  Try Again
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap"
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
