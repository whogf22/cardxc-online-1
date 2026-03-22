/**
 * My Fluz Gift Cards - purchased via Fluz API
 * Ref: https://docs.fluz.app/docs/overview
 */
import { useState, useEffect, useCallback } from 'react';
import { userApi } from '../../../lib/api';
import { useToastContext } from '../../../contexts/ToastContext';
import { formatDate } from '../../../lib/localeUtils';
import { Gift, Eye, Copy, Check, Loader2 } from 'lucide-react';

interface FluzGiftCard {
  giftCardId: string;
  purchaserUserId: string;
  endDate: string;
  status: string;
  createdAt: string;
  merchant?: { merchantId: string; name: string; logoUrl?: string };
}

export default function FluzGiftCardsTab() {
  const toast = useToastContext();
  const [giftCards, setGiftCards] = useState<FluzGiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [revealedCodes, setRevealedCodes] = useState<Record<string, { code: string; pin?: string }>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadGiftCards = useCallback(async () => {
    try {
      setLoading(true);
      const res = await userApi.getFluzGiftCards({ limit: 50 });
      if (res.success && res.data?.giftCards != null) {
        setGiftCards(res.data.giftCards);
      } else {
        toast.error((res as any).error?.message || 'Could not load gift cards. Please try again.');
        setGiftCards([]);
      }
    } catch (e: any) {
      console.error('[FluzGiftCards] Load failed:', e);
      toast.error(e?.message || 'Could not load gift cards. Please try again.');
      setGiftCards([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadGiftCards();
  }, [loadGiftCards]);

  const handleReveal = async (giftCardId: string) => {
    if (revealedCodes[giftCardId]) return;
    try {
      setRevealingId(giftCardId);
      const res = await userApi.revealFluzGiftCard(giftCardId);
      if (res.success && res.data?.code) {
        setRevealedCodes(prev => ({ ...prev, [giftCardId]: { code: res.data!.code, pin: res.data!.pin } }));
      } else {
        toast.error((res as any).error?.message || 'Could not reveal gift card code. Please try again.');
      }
    } catch (e: any) {
      console.error('[FluzGiftCards] Reveal failed:', e);
      toast.error(e?.message || 'Could not reveal gift card code. Please try again.');
    } finally {
      setRevealingId(null);
    }
  };

  const copyCode = (giftCardId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(giftCardId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-10 h-10 text-lime-400 animate-spin mb-4" />
        <p className="text-neutral-400">Loading your gift cards...</p>
      </div>
    );
  }

  if (giftCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-dark-elevated border border-dark-border flex items-center justify-center mb-4">
          <Gift className="w-8 h-8 text-neutral-500" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No Gift Cards Yet</h3>
        <p className="text-neutral-400 max-w-sm">
          Purchase gift cards from the Buy tab to see them here. Your Fluz gift cards will appear after purchase.
        </p>
      </div>
    );
  }

  const filteredCards = searchQuery.trim()
    ? giftCards.filter(card =>
        (card.merchant?.name || 'Gift Card').toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : giftCards;

  return (
    <div className="space-y-4">
      <div className="relative">
        <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 text-lg"></i>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by card name..."
          className="w-full pl-11 pr-4 py-3 bg-dark-elevated border border-dark-border rounded-xl text-white placeholder:text-neutral-500 focus:border-lime-400/50 focus:ring-2 focus:ring-lime-400/20 transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-dark-hover transition-colors"
            aria-label="Clear search"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        )}
      </div>

      <p className="text-sm text-neutral-400 mb-4">
        {filteredCards.length} of {giftCards.length} gift card{giftCards.length !== 1 ? 's' : ''} purchased via Fluz
      </p>
      <div className="grid gap-4">
        {filteredCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-dark-elevated flex items-center justify-center mb-4">
              <i className="ri-search-line text-2xl text-neutral-500"></i>
            </div>
            <p className="text-neutral-400">
              {searchQuery ? `No cards match "${searchQuery}"` : 'No gift cards yet'}
            </p>
          </div>
        ) : (
        filteredCards.map((card) => (
          <div
            key={card.giftCardId}
            className="bg-dark-card rounded-2xl border border-dark-border p-5 hover:border-dark-hover transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-white truncate">
                  {card.merchant?.name || 'Gift Card'}
                </h4>
                <p className="text-xs text-neutral-500 mt-1">
                  Status: {card.status} • Expires: {card.endDate ? formatDate(card.endDate) : 'N/A'}
                </p>
                {revealedCodes[card.giftCardId] && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-dark-bg rounded-lg text-sm text-lime-400 font-mono break-all">
                        {revealedCodes[card.giftCardId].code}
                      </code>
                      <button
                        onClick={() => copyCode(card.giftCardId, revealedCodes[card.giftCardId].code)}
                        className="p-2 rounded-lg bg-dark-elevated hover:bg-dark-hover"
                      >
                        {copiedId === card.giftCardId ? (
                          <Check className="w-4 h-4 text-lime-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-neutral-400" />
                        )}
                      </button>
                    </div>
                    {revealedCodes[card.giftCardId].pin && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-500">PIN:</span>
                        <code className="px-2 py-1 bg-dark-bg rounded text-sm text-white font-mono">
                          {revealedCodes[card.giftCardId].pin}
                        </code>
                        <button
                          onClick={() => copyCode(card.giftCardId, revealedCodes[card.giftCardId].pin!)}
                          className="p-1.5 rounded bg-dark-elevated hover:bg-dark-hover"
                        >
                          <Copy className="w-3.5 h-3.5 text-neutral-400" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {!revealedCodes[card.giftCardId] && (
                <button
                  onClick={() => handleReveal(card.giftCardId)}
                  disabled={revealingId === card.giftCardId || card.status !== 'ACTIVE'}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-lime-500/20 text-lime-400 hover:bg-lime-500/30 disabled:opacity-50 text-sm font-medium"
                >
                  {revealingId === card.giftCardId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  Reveal
                </button>
              )}
            </div>
          </div>
        ))
        )}
      </div>
    </div>
  );
}
