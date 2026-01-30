import { useState } from 'react';

interface CreateCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { card_brand: 'VISA' | 'MASTERCARD'; card_name: string; initial_balance: number }) => Promise<void>;
}

export default function CreateCardModal({ isOpen, onClose, onCreate }: CreateCardModalProps) {
  const [cardBrand, setCardBrand] = useState<'VISA' | 'MASTERCARD'>('VISA');
  const [cardName, setCardName] = useState('');
  const [initialBalance, setInitialBalance] = useState('0');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onCreate({
        card_brand: cardBrand,
        card_name: cardName,
        initial_balance: parseFloat(initialBalance) || 0,
      });
      onClose();
    } catch (error) {
      console.error('[CreateCardModal] Failed to create card:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="dark-card w-full max-w-md p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Create Virtual Card</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-dark-elevated hover:bg-dark-hover transition-colors"
          >
            <i className="ri-close-line text-xl text-neutral-400"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-3">
              Card Brand
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCardBrand('VISA')}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                  cardBrand === 'VISA'
                    ? 'border-[#9AF941] bg-[#9AF941]/10'
                    : 'border-dark-border bg-dark-elevated hover:border-neutral-600'
                }`}
              >
                <span className={`font-bold text-lg ${cardBrand === 'VISA' ? 'text-[#9AF941]' : 'text-neutral-300'}`}>
                  VISA
                </span>
              </button>
              <button
                type="button"
                onClick={() => setCardBrand('MASTERCARD')}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                  cardBrand === 'MASTERCARD'
                    ? 'border-[#F9AC41] bg-[#F9AC41]/10'
                    : 'border-dark-border bg-dark-elevated hover:border-neutral-600'
                }`}
              >
                <div className="flex -space-x-1">
                  <div className={`w-5 h-5 rounded-full ${cardBrand === 'MASTERCARD' ? 'bg-red-500' : 'bg-red-500/50'}`}></div>
                  <div className={`w-5 h-5 rounded-full ${cardBrand === 'MASTERCARD' ? 'bg-yellow-500' : 'bg-yellow-500/50'}`}></div>
                </div>
                <span className={`font-bold text-sm ${cardBrand === 'MASTERCARD' ? 'text-[#F9AC41]' : 'text-neutral-300'}`}>
                  MASTERCARD
                </span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Card Name (Optional)
            </label>
            <input
              type="text"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="e.g., Shopping Card"
              className="input-dark"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Initial Balance (USD)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
              <input
                type="number"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="input-dark pl-8"
              />
            </div>
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
                  Creating...
                </>
              ) : (
                <>
                  <i className="ri-add-line"></i>
                  Create Card
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
