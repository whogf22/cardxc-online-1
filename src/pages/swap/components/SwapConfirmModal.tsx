import { useState } from 'react';
import { Asset } from './AssetSelector';

interface SwapConfirmModalProps {
  fromAsset: Asset;
  toAsset: Asset;
  fromAmount: string;
  toAmount: string;
  rate: string;
  fee: string;
  priceImpact: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function SwapConfirmModal({
  fromAsset,
  toAsset,
  fromAmount,
  toAmount,
  rate,
  fee,
  priceImpact,
  onClose,
  onConfirm,
}: SwapConfirmModalProps) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'confirm' | 'processing' | 'success'>('confirm');

  const handleConfirm = async () => {
    setLoading(true);
    setStep('processing');
    try {
      await onConfirm();
      setStep('success');
      setTimeout(() => {
        onClose();
      }, 2500);
    } catch (error) {
      setStep('confirm');
      console.error('Swap failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">
              {step === 'confirm' && 'Confirm Swap'}
              {step === 'processing' && 'Processing...'}
              {step === 'success' && 'Swap Complete'}
            </h2>
            {step === 'confirm' && (
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-2xl text-slate-600"></i>
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {step === 'confirm' && (
            <div className="space-y-6">
              <div className="flex items-center justify-center">
                <div className="flex items-center space-x-4">
                  <div className="text-center">
                    <div className={`w-16 h-16 bg-gradient-to-br ${fromAsset.color} rounded-2xl flex items-center justify-center shadow-xl mx-auto mb-2`}>
                      <i className={`${fromAsset.icon} text-white text-2xl`}></i>
                    </div>
                    <p className="font-bold text-slate-900">{fromAmount}</p>
                    <p className="text-sm text-slate-500">{fromAsset.symbol}</p>
                  </div>

                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                    <i className="ri-arrow-right-line text-emerald-600 text-2xl"></i>
                  </div>

                  <div className="text-center">
                    <div className={`w-16 h-16 bg-gradient-to-br ${toAsset.color} rounded-2xl flex items-center justify-center shadow-xl mx-auto mb-2`}>
                      <i className={`${toAsset.icon} text-white text-2xl`}></i>
                    </div>
                    <p className="font-bold text-slate-900">{toAmount}</p>
                    <p className="text-sm text-slate-500">{toAsset.symbol}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Exchange Rate</span>
                  <span className="text-sm font-semibold text-slate-900">{rate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Price Impact</span>
                  <span className={`text-sm font-semibold ${parseFloat(priceImpact) > 1 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {priceImpact}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Network Fee</span>
                  <span className="text-sm font-semibold text-slate-900">{fee}</span>
                </div>
                <div className="border-t border-slate-200 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">You Receive</span>
                    <span className="text-lg font-bold text-emerald-600">{toAmount} {toAsset.symbol}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start space-x-2">
                  <i className="ri-error-warning-line text-amber-600 mt-0.5"></i>
                  <p className="text-xs text-amber-800">
                    Final exchange rate may vary slightly due to market conditions. Your swap will be executed at the best available rate.
                  </p>
                </div>
              </div>

              <button
                onClick={handleConfirm}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/30"
              >
                Confirm Swap
              </button>
            </div>
          )}

          {step === 'processing' && (
            <div className="text-center py-12">
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 border-4 border-emerald-200 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-4 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center">
                  <i className="ri-exchange-line text-white text-2xl"></i>
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Swapping Assets</h3>
              <p className="text-slate-600">Please wait while we process your swap...</p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                <i className="ri-check-line text-5xl text-emerald-600"></i>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Swap Successful!</h3>
              <p className="text-slate-600 mb-6">
                You've successfully swapped {fromAmount} {fromAsset.symbol} for {toAmount} {toAsset.symbol}
              </p>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 inline-block">
                <p className="text-xs text-slate-500 mb-1">Transaction ID</p>
                <p className="text-sm font-mono text-slate-900">TXN-{Date.now().toString(36).toUpperCase()}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
