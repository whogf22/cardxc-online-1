import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cardService } from '../../lib/cardService';
import { useToastContext } from '../../contexts/ToastContext';
import { userApi } from '../../lib/api';

interface VirtualCardOffer {
  offerId: string;
  bankName: string;
  programName: string;
  rewardValue: string;
  programLimits?: { dailyLimit?: string; weeklyLimit?: string; monthlyLimit?: string };
}

export default function CreateVirtualCardPage() {
  const navigate = useNavigate();
  const toast = useToastContext();
  const [offers, setOffers] = useState<VirtualCardOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [selectedOfferId, setSelectedOfferId] = useState<string>('');
  const [cardName, setCardName] = useState('');
  const [spendLimit, setSpendLimit] = useState('100');
  const [spendLimitDuration, setSpendLimitDuration] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL' | 'LIFETIME'>('MONTHLY');
  const [isSingleUse, setIsSingleUse] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadOffers = async () => {
      try {
        setOffersLoading(true);
        const res = await userApi.getFluzVirtualCardOffers();
        const list = (res as any)?.data?.offers ?? (res as any)?.offers ?? [];
        setOffers(Array.isArray(list) ? list : []);
        if (list.length > 0) {
          setSelectedOfferId(prev => prev || list[0].offerId);
        }
      } catch (err) {
        console.error('[CreateVirtualCard] Failed to load offers:', err);
        toast.error('Could not load card offers. Using default.');
        setOffers([]);
      } finally {
        setOffersLoading(false);
      }
    };
    loadOffers();
  }, [toast]);

  useEffect(() => {
    if (offers.length > 0 && !selectedOfferId) {
      setSelectedOfferId(offers[0].offerId);
    }
  }, [offers, selectedOfferId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const limit = parseFloat(spendLimit);
    if (isNaN(limit) || limit < 1) {
      toast.error('Spend limit must be at least $1');
      return;
    }
    setIsLoading(true);
    try {
      await cardService.createCard({
        card_name: cardName || 'My Card',
        spending_limit: limit,
        spend_limit_duration: isSingleUse ? 'LIFETIME' : spendLimitDuration,
        is_single_use: isSingleUse,
        offer_id: selectedOfferId || undefined,
      });
      toast.success('Virtual card created successfully!');
      navigate('/cards');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create virtual card');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg text-white pb-24 font-['Inter']">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-lime-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-lime-500/5 blur-[120px] rounded-full"></div>
      </div>

      <header className="relative z-10 border-b border-dark-border backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-6 pt-12 pb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/cards')}
              className="w-12 h-12 flex items-center justify-center rounded-2xl bg-dark-card border border-dark-border hover:border-lime-500/30 transition-all group"
            >
              <i className="ri-arrow-left-s-line text-2xl text-neutral-400 group-hover:text-lime-400"></i>
            </button>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white uppercase">Create Virtual Card</h1>
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em]">Issue a new virtual card</p>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        <div className="max-w-md mx-auto bg-dark-card rounded-2xl sm:rounded-[3rem] border border-dark-border p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {offersLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-2 border-lime-500/30 border-t-lime-500 rounded-full animate-spin"></div>
              </div>
            ) : offers.length > 0 ? (
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-3">Card Program</label>
                <div className="space-y-2">
                  {offers.map((offer) => (
                    <button
                      key={offer.offerId}
                      type="button"
                      onClick={() => setSelectedOfferId(offer.offerId)}
                      className={`w-full p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between ${
                        selectedOfferId === offer.offerId
                          ? 'border-lime-500 bg-lime-500/10'
                          : 'border-dark-border bg-dark-elevated hover:border-dark-hover'
                      }`}
                    >
                      <div>
                        <p className={`font-semibold ${selectedOfferId === offer.offerId ? 'text-lime-400' : 'text-white'}`}>
                          {offer.programName || offer.bankName || 'Virtual Card'}
                        </p>
                        <p className="text-xs text-neutral-500">{offer.rewardValue ? `${offer.rewardValue} reward` : ''}</p>
                      </div>
                      {selectedOfferId === offer.offerId && (
                        <i className="ri-check-line text-lime-400 text-xl"></i>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">Card Name (Optional)</label>
              <input
                type="text"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="e.g., Shopping Card"
                className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-2xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">Spend Limit (USD)</label>
              <p className="text-xs text-neutral-500 mb-2">Max amount this card can be charged. You are only charged for actual usage.</p>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
                <input
                  type="number"
                  value={spendLimit}
                  onChange={(e) => setSpendLimit(e.target.value)}
                  placeholder="100"
                  min="1"
                  step="1"
                  className="w-full pl-10 pr-4 py-3 bg-dark-elevated border border-dark-border rounded-2xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">Limit Duration</label>
              <select
                value={spendLimitDuration}
                onChange={(e) => setSpendLimitDuration(e.target.value as any)}
                disabled={isSingleUse}
                className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-lime-500/50"
              >
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="ANNUAL">Annual</option>
                <option value="LIFETIME">Lifetime</option>
              </select>
              {isSingleUse && <p className="text-xs text-neutral-500 mt-1">Single-use cards use lifetime limit</p>}
            </div>

            <div className="flex items-center gap-3">
              <input
                id="singleUse"
                type="checkbox"
                checked={isSingleUse}
                onChange={(e) => setIsSingleUse(e.target.checked)}
                className="w-5 h-5 rounded border-dark-border text-lime-500 focus:ring-lime-500/50"
              />
              <label htmlFor="singleUse" className="text-sm text-neutral-400">
                Single-use card (locks after first transaction)
              </label>
            </div>

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/cards')}
                className="flex-1 py-4 px-6 rounded-2xl font-semibold border border-dark-border text-neutral-400 hover:bg-dark-elevated transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || offersLoading}
                className="flex-1 py-4 px-6 rounded-2xl font-semibold bg-lime-500 hover:bg-lime-400 text-black disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
              >
                {isLoading ? (
                  <>
                    <i className="ri-loader-4-line animate-spin text-lg"></i>
                    Creating...
                  </>
                ) : (
                  <>
                    <i className="ri-add-line text-lg"></i>
                    Create Card
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
