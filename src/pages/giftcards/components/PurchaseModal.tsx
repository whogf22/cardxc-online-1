import { useState } from 'react';
import { giftCardApi } from '../../../lib/api';
import { useToastContext } from '../../../contexts/ToastContext';
import type { GiftCardBrand } from './GiftCardItem';

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: GiftCardBrand | null;
}

export default function PurchaseModal({ isOpen, onClose, card }: PurchaseModalProps) {
  const [selectedDenom, setSelectedDenom] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [step, setStep] = useState<'select' | 'confirm' | 'success'>('select');
  const [isProcessing, setIsProcessing] = useState(false);
  const toast = useToastContext();

  if (!isOpen || !card) return null;

  const total = selectedDenom ? selectedDenom * quantity : 0;
  const paymentAmount = total * (card.rate / 100);

  const handlePurchase = async () => {
    if (!selectedDenom || !card) return;

    setIsProcessing(true);
    try {
      const result = await giftCardApi.createRequest({
        type: 'buy',
        brand: card.name,
        amount: total,
        currency: 'USD',
        rate: card.rate,
        metadata: {
          denomination: selectedDenom,
          quantity,
          paymentAmount
        }
      });

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to submit purchase request');
      }

      setStep('success');
    } catch (error: any) {
      console.error('Purchase failed:', error);
      toast.error(error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setStep('select');
    setSelectedDenom(null);
    setQuantity(1);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-dark-card rounded-3xl border border-dark-border w-full max-w-md max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: card.bgColor }}
            >
              <i className={`${card.icon} text-xl`} style={{ color: card.color }}></i>
            </div>
            <div>
              <h2 className="font-semibold text-white">{card.name}</h2>
              <p className="text-xs text-neutral-400">Gift Card</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-dark-elevated hover:bg-dark-hover transition-colors"
          >
            <i className="ri-close-line text-neutral-400"></i>
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
          {step === 'select' && (
            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium text-neutral-300 mb-2 block">Select Amount</label>
                <div className="grid grid-cols-3 gap-2">
                  {card.denominations.map((denom) => (
                    <button
                      key={denom}
                      onClick={() => setSelectedDenom(denom)}
                      className={`py-3 rounded-xl font-semibold text-sm transition-all ${selectedDenom === denom
                        ? 'bg-lime-500 text-black'
                        : 'bg-dark-elevated text-white hover:bg-dark-hover border border-dark-border'
                        }`}
                    >
                      ${denom}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-300 mb-2 block">Quantity</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-12 h-12 rounded-xl bg-dark-elevated border border-dark-border flex items-center justify-center text-white hover:bg-dark-hover transition-colors"
                  >
                    <i className="ri-subtract-line text-lg"></i>
                  </button>
                  <span className="w-12 text-center text-xl font-semibold text-white">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(10, quantity + 1))}
                    className="w-12 h-12 rounded-xl bg-dark-elevated border border-dark-border flex items-center justify-center text-white hover:bg-dark-hover transition-colors"
                  >
                    <i className="ri-add-line text-lg"></i>
                  </button>
                </div>
              </div>

              {selectedDenom && (
                <div className="bg-dark-elevated rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400">Card Value</span>
                    <span className="text-white">${selectedDenom} × {quantity}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400">Rate</span>
                    <span className="text-success-400">{card.rate}%</span>
                  </div>
                  <div className="h-px bg-dark-border" />
                  <div className="flex justify-between">
                    <span className="text-neutral-300 font-medium">You Pay</span>
                    <span className="text-lime-400 font-bold text-lg">${paymentAmount.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <button
                onClick={() => setStep('confirm')}
                disabled={!selectedDenom}
                className="w-full py-4 bg-lime-500 text-black font-semibold rounded-2xl hover:bg-lime-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-5">
              <div className="text-center py-4">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: card.bgColor }}
                >
                  <i className={`${card.icon} text-4xl`} style={{ color: card.color }}></i>
                </div>
                <h3 className="text-xl font-bold text-white mb-1">Confirm Purchase</h3>
                <p className="text-neutral-400">Review your order details</p>
              </div>

              <div className="bg-dark-elevated rounded-2xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Gift Card</span>
                  <span className="text-white">{card.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Amount</span>
                  <span className="text-white">${selectedDenom} × {quantity}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Total Value</span>
                  <span className="text-white">${total}</span>
                </div>
                <div className="h-px bg-dark-border" />
                <div className="flex justify-between">
                  <span className="text-neutral-300 font-medium">Payment Amount</span>
                  <span className="text-lime-400 font-bold text-lg">${paymentAmount.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('select')}
                  className="flex-1 py-4 bg-dark-elevated text-white font-semibold rounded-2xl border border-dark-border hover:bg-dark-hover transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handlePurchase}
                  disabled={isProcessing}
                  className="flex-1 py-4 bg-lime-500 text-black font-semibold rounded-2xl hover:bg-lime-400 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <i className="ri-loader-4-line animate-spin"></i>
                      Processing...
                    </>
                  ) : (
                    'Confirm Purchase'
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="space-y-5 text-center py-6">
              <div className="w-20 h-20 rounded-full bg-success-500/20 flex items-center justify-center mx-auto">
                <i className="ri-check-line text-4xl text-success-400"></i>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Purchase Successful!</h3>
                <p className="text-neutral-400">Your gift card has been added to your account</p>
              </div>

              <div className="bg-dark-elevated rounded-2xl p-4 text-left space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Order ID</span>
                  <span className="text-white font-mono">GC-{Date.now().toString(36).toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Gift Card</span>
                  <span className="text-white">{card.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Total Value</span>
                  <span className="text-white">${total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Amount Paid</span>
                  <span className="text-lime-400 font-semibold">${paymentAmount.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="w-full py-4 bg-lime-500 text-black font-semibold rounded-2xl hover:bg-lime-400 transition-all"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
