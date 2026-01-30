import { useState } from 'react';
import { userApi } from '../../../lib/api';

interface WithdrawModalProps {
  currency: string;
  availableBalance: number;
  onClose: () => void;
  onSuccess: () => void;
}

const currencyConfig: Record<string, { symbol: string; name: string }> = {
  NGN: { symbol: '₦', name: 'Nigerian Naira' },
  USD: { symbol: '$', name: 'US Dollar' },
  BDT: { symbol: '৳', name: 'Bangladeshi Taka' },
};

export default function WithdrawModal({ currency, availableBalance, onClose, onSuccess }: WithdrawModalProps) {
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'amount' | 'details' | 'confirmation'>('amount');

  const config = currencyConfig[currency] || currencyConfig.NGN;

  const handleAmountSubmit = () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (numAmount > availableBalance) {
      setError('Insufficient balance');
      return;
    }
    setError('');
    setStep('details');
  };

  const handleWithdraw = async () => {
    try {
      setLoading(true);
      setError('');

      if (!bankName || !accountNumber || !accountName) {
        setError('Please fill in all bank details');
        return;
      }

      const result = await userApi.requestWithdrawal({
        amount: parseFloat(amount),
        currency: currency,
        bankName: bankName,
        accountNumber: accountNumber,
        accountName: accountName
      });

      if (!result.success) {
        throw new Error(result.error?.message || 'Withdrawal request failed');
      }

      setStep('confirmation');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Withdraw Funds</h2>
              <p className="text-sm text-slate-600 mt-1">Send money to your bank account</p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-close-line text-2xl text-slate-600"></i>
            </button>
          </div>
        </div>

        <div className="p-6">
          {step === 'amount' && (
            <div className="space-y-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Available Balance</span>
                  <span className="text-lg font-bold text-slate-900">
                    {config.symbol}{availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Amount to Withdraw
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">
                    {config.symbol}
                  </span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    max={availableBalance}
                    className="w-full pl-12 pr-4 py-4 text-2xl font-bold border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors"
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm text-slate-500">{config.name}</p>
                  <button
                    onClick={() => setAmount(availableBalance.toString())}
                    className="text-sm font-medium text-emerald-600 hover:text-emerald-700 cursor-pointer whitespace-nowrap"
                  >
                    Max
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button
                onClick={handleAmountSubmit}
                disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > availableBalance}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-slate-300 disabled:to-slate-400 text-white px-6 py-4 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap shadow-lg shadow-emerald-500/30 disabled:shadow-none"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-6">
              <div className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Withdrawal Amount</span>
                  <span className="text-2xl font-bold text-slate-900">
                    {config.symbol}{parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Enter bank name"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Enter account number"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Account Name
                  </label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Enter account name"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start space-x-3">
                  <i className="ri-information-line text-amber-600 text-xl flex-shrink-0 mt-0.5"></i>
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold mb-1">Processing Time</p>
                    <p>Withdrawals are processed within 24 hours on business days.</p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('amount')}
                  className="flex-1 bg-white hover:bg-slate-50 text-slate-700 px-6 py-4 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap border-2 border-slate-200"
                >
                  Back
                </button>
                <button
                  onClick={handleWithdraw}
                  disabled={loading || !bankName || !accountNumber || !accountName}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-slate-300 disabled:to-slate-400 text-white px-6 py-4 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap shadow-lg shadow-emerald-500/30"
                >
                  {loading ? 'Processing...' : 'Confirm Withdrawal'}
                </button>
              </div>
            </div>
          )}

          {step === 'confirmation' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="ri-checkbox-circle-fill text-5xl text-emerald-600"></i>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Withdrawal Requested!</h3>
              <p className="text-slate-600 mb-6">
                Your withdrawal of {config.symbol}{parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} has been submitted.
              </p>
              <p className="text-sm text-slate-500">
                Funds will be sent to your bank account within 24 hours.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
