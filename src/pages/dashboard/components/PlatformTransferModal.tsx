/**
 * Send to Spender - P2P transfer to another platform user
 */

import { useState } from 'react';
import { userApi } from '../../../lib/api';

interface PlatformTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  totalBalance: number;
}

export default function PlatformTransferModal({
  isOpen,
  onClose,
  onSuccess,
  totalBalance,
}: PlatformTransferModalProps) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [walletType, setWalletType] = useState<'fiat' | 'usdt'>('fiat');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (numAmount > totalBalance) {
      setError('Insufficient balance');
      return;
    }
    if (!recipientEmail.trim()) {
      setError('Please enter recipient email');
      return;
    }
    setLoading(true);
    try {
      const result = await userApi.requestPlatformTransfer({
        amount: numAmount,
        recipientEmail: recipientEmail.trim(),
        walletType,
        message: message.trim() || undefined,
      });
      if (!result.success) {
        throw new Error((result as any).error?.message || 'Transfer failed');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-3xl border border-white/10 shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Send to Spender</h2>
            <p className="text-sm text-neutral-400 mt-0.5">Send funds using email</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-xs text-neutral-400">Available</p>
            <p className="text-xl font-bold text-lime-400">${totalBalance.toFixed(2)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Recipient Email</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="friend@example.com"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-lime-500/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-lime-500/50"
              />
              <button
                type="button"
                onClick={() => setAmount(totalBalance.toString())}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-lime-400 hover:text-lime-300"
              >
                Max
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Send from</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWalletType('fiat')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  walletType === 'fiat'
                    ? 'bg-lime-500 text-black'
                    : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                }`}
              >
                USD
              </button>
              <button
                type="button"
                onClick={() => setWalletType('usdt')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  walletType === 'usdt'
                    ? 'bg-lime-500 text-black'
                    : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                }`}
              >
                USDT
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Message (optional)</label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a note..."
              maxLength={500}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-lime-500/50"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !amount || !recipientEmail}
            className="w-full py-4 bg-lime-500 hover:bg-lime-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <i className="ri-loader-4-line animate-spin text-lg"></i>
                Sending...
              </>
            ) : (
              'Send'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
