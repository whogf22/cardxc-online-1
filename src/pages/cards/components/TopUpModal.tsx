import { useState } from 'react';
import type { VirtualCard } from '../../../types/card';

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: VirtualCard | null;
  onTopUp: (amount: number) => Promise<void>;
}

export default function TopUpModal({ isOpen, onClose, card, onTopUp }: TopUpModalProps) {
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen || !card) return null;

  const quickAmounts = [50, 100, 250, 500];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;
    
    setIsLoading(true);
    try {
      await onTopUp(numAmount);
      setAmount('');
      onClose();
    } catch (error) {
      console.error('[TopUpModal] Failed to top up:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="dark-card w-full max-w-md p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Top Up Card</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-dark-elevated hover:bg-dark-hover transition-colors"
          >
            <i className="ri-close-line text-xl text-neutral-400"></i>
          </button>
        </div>

        <div className="mb-6 p-4 bg-dark-elevated rounded-xl border border-dark-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-neutral-400">Current Balance</div>
              <div className="text-2xl font-bold text-white">${card.balance.toFixed(2)}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-neutral-400">{card.card_name || 'Virtual Card'}</div>
              <div className="text-sm text-neutral-500">{card.card_number_masked}</div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Amount (USD)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-neutral-500">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="1"
                step="0.01"
                className="input-dark pl-10 text-2xl font-bold"
              />
            </div>
          </div>

          <div>
            <div className="text-sm text-neutral-400 mb-2">Quick Select</div>
            <div className="grid grid-cols-4 gap-2">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(String(amt))}
                  className={`py-3 rounded-xl font-semibold transition-all ${
                    amount === String(amt)
                      ? 'bg-[#9AF941] text-black'
                      : 'bg-dark-elevated hover:bg-dark-hover text-neutral-300 border border-dark-border'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
          </div>

          {amount && parseFloat(amount) > 0 && (
            <div className="p-4 bg-success-500/10 border border-success-500/30 rounded-xl">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">New Balance</span>
                <span className="text-success-400 font-bold">
                  ${(card.balance + parseFloat(amount)).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !amount || parseFloat(amount) <= 0}
              className="flex-1 py-4 px-6 rounded-xl font-semibold transition-all bg-[#9AF941] hover:bg-[#8AE931] text-black disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <i className="ri-loader-4-line animate-spin"></i>
                  Processing...
                </>
              ) : (
                <>
                  <i className="ri-add-circle-line"></i>
                  Top Up
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
