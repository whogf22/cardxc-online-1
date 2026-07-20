/**
 * My Gift Cards - the current user's own gift card purchases.
 *
 * SECURITY: This intentionally reads from the per-user /gift-cards/requests
 * endpoint (scoped by user_id), NOT the shared-account Fluz provider list.
 * The Fluz provider is a single shared platform account, so listing/revealing
 * provider gift cards would expose other users' redeemable codes. The owner's
 * card_code is returned inline for completed requests, so no separate reveal
 * call (which would burn a shared code) is needed.
 */
import { useState, useEffect, useCallback } from 'react';
import { giftCardApi } from '../../../lib/api';
import { useToastContext } from '../../../contexts/ToastContext';
import { formatDate } from '../../../lib/localeUtils';
import { Gift, Copy, Check, Loader2 } from 'lucide-react';

interface GiftCardRequest {
  id: string;
  type: 'buy' | 'sell';
  brand: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  card_code?: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'text-lime-400',
  processing: 'text-amber-400',
  pending: 'text-neutral-400',
  rejected: 'text-red-400',
};

export default function FluzGiftCardsTab() {
  const toast = useToastContext();
  const [giftCards, setGiftCards] = useState<GiftCardRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadGiftCards = useCallback(async () => {
    try {
      setLoading(true);
      const res = await giftCardApi.getRequests();
      if (res.success && res.data?.requests != null) {
        // Only "buy" requests represent gift cards the user holds.
        setGiftCards(res.data.requests.filter((r: GiftCardRequest) => r.type === 'buy'));
      } else {
        toast.error((res as any).error?.message || 'Could not load gift cards. Please try again.');
        setGiftCards([]);
      }
    } catch (e: any) {
      console.error('[MyGiftCards] Load failed:', e);
      toast.error(e?.message || 'Could not load gift cards. Please try again.');
      setGiftCards([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadGiftCards();
  }, [loadGiftCards]);

  const copyCode = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
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
          Purchase gift cards from the Buy tab and your cards will appear here.
        </p>
      </div>
    );
  }

  const filteredCards = searchQuery.trim()
    ? giftCards.filter(card =>
        (card.brand || 'Gift Card').toLowerCase().includes(searchQuery.trim().toLowerCase())
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
        {filteredCards.length} of {giftCards.length} gift card{giftCards.length !== 1 ? 's' : ''} purchased
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
              key={card.id}
              className="bg-dark-card rounded-2xl border border-dark-border p-5 hover:border-dark-hover transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white truncate">
                    {card.brand || 'Gift Card'}
                  </h4>
                  <p className="text-xs text-neutral-500 mt-1">
                    {card.currency} {card.amount?.toFixed(2)} •{' '}
                    <span className={STATUS_STYLES[card.status] || 'text-neutral-400'}>
                      {card.status}
                    </span>{' '}
                    • {card.created_at ? formatDate(card.created_at) : 'N/A'}
                  </p>
                  {card.status === 'completed' && card.card_code && (
                    <div className="mt-3 flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-dark-bg rounded-lg text-sm text-lime-400 font-mono break-all">
                        {card.card_code}
                      </code>
                      <button
                        onClick={() => copyCode(card.id, card.card_code!)}
                        className="p-2 rounded-lg bg-dark-elevated hover:bg-dark-hover"
                        aria-label="Copy code"
                      >
                        {copiedId === card.id ? (
                          <Check className="w-4 h-4 text-lime-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-neutral-400" />
                        )}
                      </button>
                    </div>
                  )}
                  {card.status !== 'completed' && (
                    <p className="mt-3 text-xs text-neutral-500">
                      {card.status === 'rejected'
                        ? 'This request was rejected.'
                        : 'Your code will appear here once the order is completed.'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
