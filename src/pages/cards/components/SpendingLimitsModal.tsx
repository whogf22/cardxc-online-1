import { useState, useEffect } from 'react';
import type { VirtualCard } from '../../../types/card';

interface SpendingLimitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: VirtualCard | null;
  onSave: (limits: { daily_limit: number; monthly_limit: number; per_transaction_limit: number }) => Promise<void>;
}

export default function SpendingLimitsModal({ isOpen, onClose, card, onSave }: SpendingLimitsModalProps) {
  const [dailyLimit, setDailyLimit] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [perTransactionLimit, setPerTransactionLimit] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (card) {
      setDailyLimit(String(card.daily_limit));
      setMonthlyLimit(String(card.monthly_limit));
      setPerTransactionLimit(String(card.per_transaction_limit));
    }
  }, [card]);

  if (!isOpen || !card) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onSave({
        daily_limit: parseFloat(dailyLimit) || 0,
        monthly_limit: parseFloat(monthlyLimit) || 0,
        per_transaction_limit: parseFloat(perTransactionLimit) || 0,
      });
      onClose();
    } catch (error) {
      console.error('[SpendingLimitsModal] Failed to update limits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateUsage = (spent: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.min((spent / limit) * 100, 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="dark-card w-full max-w-md p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Spending Limits</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-dark-elevated hover:bg-dark-hover transition-colors"
          >
            <i className="ri-close-line text-xl text-neutral-400"></i>
          </button>
        </div>

        <div className="mb-6 p-4 bg-dark-elevated rounded-xl border border-dark-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-[#9AF941]/20 rounded-lg flex items-center justify-center">
              <i className="ri-bank-card-line text-[#9AF941]"></i>
            </div>
            <div>
              <div className="font-semibold text-white">{card.card_name || 'Virtual Card'}</div>
              <div className="text-sm text-neutral-500">{card.card_number_masked}</div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-neutral-400">Daily Spent</span>
                <span className="text-white">${card.daily_spent.toFixed(2)} / ${card.daily_limit.toFixed(2)}</span>
              </div>
              <div className="h-2 bg-dark-border rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#9AF941] rounded-full transition-all"
                  style={{ width: `${calculateUsage(card.daily_spent, card.daily_limit)}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-neutral-400">Monthly Spent</span>
                <span className="text-white">${card.monthly_spent.toFixed(2)} / ${card.monthly_limit.toFixed(2)}</span>
              </div>
              <div className="h-2 bg-dark-border rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#F9AC41] rounded-full transition-all"
                  style={{ width: `${calculateUsage(card.monthly_spent, card.monthly_limit)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Daily Limit ($)
            </label>
            <input
              type="number"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              min="0"
              step="100"
              className="input-dark"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Monthly Limit ($)
            </label>
            <input
              type="number"
              value={monthlyLimit}
              onChange={(e) => setMonthlyLimit(e.target.value)}
              min="0"
              step="100"
              className="input-dark"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Per Transaction Limit ($)
            </label>
            <input
              type="number"
              value={perTransactionLimit}
              onChange={(e) => setPerTransactionLimit(e.target.value)}
              min="0"
              step="50"
              className="input-dark"
            />
          </div>

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
              disabled={isLoading}
              className="flex-1 py-4 px-6 rounded-xl font-semibold transition-all bg-[#9AF941] hover:bg-[#8AE931] text-black disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <i className="ri-loader-4-line animate-spin"></i>
                  Saving...
                </>
              ) : (
                'Save Limits'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
