import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cardService } from '../../lib/cardService';
import { useToastContext } from '../../contexts/ToastContext';
import SpendingLimitsModal from './components/SpendingLimitsModal';
import TopUpModal from './components/TopUpModal';
import AddCardModal, { type PrepaidCardData } from './components/AddCardModal';
import type { VirtualCard, CardTransaction } from '../../types/card';

type TabType = 'cards' | 'history';

export default function CardsPage() {
  const navigate = useNavigate();
  const toast = useToastContext();
  const [cards, setCards] = useState<VirtualCard[]>([]);
  // SECURITY: Card metadata (even last-four digits or card IDs) must not be
  // persisted to localStorage — any XSS would exfiltrate it. Cards are
  // reloaded from /api/cards on mount; a caching layer (React Query / SWR)
  // should be used if memoisation is needed later.
  // TODO: clear any legacy cached value once on first mount (best-effort
  //       cleanup for users upgrading from an older build).
  const [prepaidCards, setPrepaidCards] = useState<PrepaidCardData[]>([]);
  const [selectedCard, setSelectedCard] = useState<VirtualCard | null>(null);
  const [selectedPrepaidCard, setSelectedPrepaidCard] = useState<PrepaidCardData | null>(null);
  const [, setTransactions] = useState<CardTransaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<CardTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTx, setIsLoadingTx] = useState(false);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [showLimitsModal, setShowLimitsModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [editingCard, setEditingCard] = useState<PrepaidCardData | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFullDetails, setShowFullDetails] = useState<Record<string, boolean>>({});
  const [revealedDetails, setRevealedDetails] = useState<Record<string, { cardNumber: string; expiryMMYY: string; cvv: string; cardHolderName: string }>>({});
  const [revealLoading, setRevealLoading] = useState<Record<string, boolean>>({});

  const toggleReveal = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const card = cards.find(c => c.id === id);
    const isVirtualWithProvider = card?.hasProviderCard;
    if (isVirtualWithProvider) {
      if (showFullDetails[id]) {
        setShowFullDetails(prev => ({ ...prev, [id]: false }));
      } else if (revealedDetails[id]) {
        setShowFullDetails(prev => ({ ...prev, [id]: true }));
      } else if (!revealLoading[id]) {
        try {
          setRevealLoading(prev => ({ ...prev, [id]: true }));
          const data = await cardService.revealCard(id);
          setRevealedDetails(prev => ({ ...prev, [id]: data }));
          setShowFullDetails(prev => ({ ...prev, [id]: true }));
        } catch (err: any) {
          toast.error(err?.message || 'Failed to reveal card details');
        } finally {
          setRevealLoading(prev => ({ ...prev, [id]: false }));
        }
      }
    } else {
      setShowFullDetails(prev => ({ ...prev, [id]: !prev[id] }));
    }
  };

  const loadCards = async () => {
    try {
      setIsLoading(true);
      const cardsData = await cardService.getCards();

      if (cardsData && cardsData.length > 0) {
        setCards(cardsData);
        if (!selectedCard) {
          setSelectedCard(cardsData[0]);
        }
      } else {
        setCards([]);
      }
    } catch (error: any) {
      console.error('Failed to load cards:', error);
      toast.error(error?.message || 'Could not load cards. Please try again.');
      setCards([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTransactions = async (cardId: string) => {
    try {
      setIsLoadingTx(true);
      const data = await cardService.getTransactions(cardId);
      setTransactions(data);
    } catch (error) {
      console.error('[CardsPage] Failed to load transactions:', error);
    } finally {
      setIsLoadingTx(false);
    }
  };

  const loadAllTransactions = async () => {
    try {
      setIsLoadingTx(true);
      const allTx: CardTransaction[] = [];
      for (const card of cards) {
        const data = await cardService.getTransactions(card.id);
        allTx.push(...data.map(tx => ({ ...tx, card_last_four: card.last_four || '****' })));
      }
      allTx.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setAllTransactions(allTx);
    } catch (error) {
      console.error('[CardsPage] Failed to load all transactions:', error);
    } finally {
      setIsLoadingTx(false);
    }
  };

  useEffect(() => {
    // SECURITY: best-effort cleanup of the legacy localStorage cache so
    // previously-persisted card metadata does not linger on upgrade.
    try {
      localStorage.removeItem('cardxc_prepaid_cards');
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedCard) {
      loadTransactions(selectedCard.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCard?.id]);

  useEffect(() => {
    if (activeTab === 'history' && cards.length > 0) {
      loadAllTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, cards.length]);

  const handleAddPrepaidCard = (card: PrepaidCardData) => {
    setPrepaidCards(prev => [card, ...prev]);
    toast.success('Card added successfully!');
  };

  const handleEditPrepaidCard = (card: PrepaidCardData) => {
    setEditingCard(card);
    setShowAddCardModal(true);
  };

  const handleUpdatePrepaidCard = (card: PrepaidCardData) => {
    setPrepaidCards(prev => prev.map(c => c.id === card.id ? card : c));
    setEditingCard(null);
    toast.success('Card updated successfully!');
  };

  const handleDeletePrepaidCard = (cardId: string) => {
    if (!window.confirm('Are you sure you want to remove this card? This cannot be undone.')) return;
    setPrepaidCards(prev => prev.filter(c => c.id !== cardId));
    setSelectedPrepaidCard(prev => prev?.id === cardId ? null : prev);
    toast.success('Card removed');
  };

  const handleFreezeToggle = async () => {
    if (!selectedCard) return;
    try {
      if (selectedCard.is_frozen || selectedCard.status === 'FROZEN') {
        await cardService.unfreezeCard(selectedCard.id);
        toast.success('Card unfrozen successfully!');
      } else {
        await cardService.freezeCard(selectedCard.id);
        toast.success('Card frozen successfully!');
      }
      loadCards(); // Refresh the list
    } catch (error: any) {
      toast.error(error.message || 'Action failed');
    }
  };

  const handleDeleteCard = async () => {
    if (!selectedCard) return;
    if (!confirm('Are you sure you want to cancel this card? This action cannot be undone.')) return;
    try {
      await cardService.deleteCard(selectedCard.id);
      toast.success('Card cancelled successfully!');
      setSelectedCard(null);
      loadCards();
    } catch (error: any) {
      toast.error(error.message || 'Deletion failed');
    }
  };

  const handleUpdateLimits = async (limits: { daily_limit: number; monthly_limit: number; per_transaction_limit: number }) => {
    if (!selectedCard) return;
    try {
      await cardService.updateLimits(selectedCard.id, { daily_limit: limits.daily_limit });
      toast.success('Limits updated successfully!');
      setShowLimitsModal(false);
      loadCards();
    } catch (error: any) {
      toast.error(error.message || 'Update failed');
    }
  };

  const handleTopUp = async (amount: number) => {
    if (!selectedCard) return;
    try {
      await cardService.topUpCard(selectedCard.id, amount);
      toast.success(`Successfully topped up $${amount.toLocaleString()}`);
      setShowTopUpModal(false);
      loadCards();
    } catch (error: any) {
      toast.error(error.message || 'Top-up failed');
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'COMPLETED' || s === 'SUCCESS' || s === 'ACTIVE') {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 bg-lime-500/10 text-lime-400 text-[10px] font-bold rounded-full border border-lime-500/20 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-lime-500 animate-pulse"></span>
          {status}
        </span>
      );
    }
    if (s === 'FAILED' || s === 'DECLINED' || s === 'EXPIRED') {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 text-rose-400 text-[10px] font-bold rounded-full border border-rose-500/20 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          {status}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-400 text-[10px] font-bold rounded-full border border-amber-500/20 uppercase">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
        {status}
      </span>
    );
  };

  const getProviderIcon = (provider: 'VISA' | 'MASTERCARD' | 'AMEX') => {
    switch (provider) {
      case 'VISA':
        return <div className="text-white text-sm font-black italic tracking-tighter">VISA</div>;
      case 'MASTERCARD':
        return (
          <div className="flex -space-x-1.5">
            <div className="w-4 h-4 bg-red-500 rounded-full opacity-90 backdrop-blur-sm"></div>
            <div className="w-4 h-4 bg-amber-500 rounded-full opacity-90 backdrop-blur-sm"></div>
          </div>
        );
      case 'AMEX':
        return <div className="text-sky-400 text-[10px] font-black italic border border-sky-400/30 px-1 rounded">AMEX</div>;
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatCardNumber = (num: string) => num?.replace(/(.{4})/g, '$1 ').trim() || '';

  const filteredCards = cards.filter(card =>
    card.card_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.last_four?.includes(searchQuery)
  ).map(c => ({
    ...c,
    provider: c.card_brand as 'VISA' | 'MASTERCARD' | 'AMEX',
    lastFour: c.last_four,
    cardholderName: c.card_name || 'Virtual Card',
    expiryDate: `${String(c.expiry_month).padStart(2, '0')}/${String(c.expiry_year).slice(-2)}`,
    isVirtual: true,
    revealed: revealedDetails[c.id],
  }));

  const filteredPrepaidCards = prepaidCards.filter(card =>
    card.cardholderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.lastFour.includes(searchQuery)
  ).map(c => ({ ...c, isVirtual: false }));

  const allCards = [...filteredCards, ...filteredPrepaidCards];

  return (
    <div className="min-h-screen bg-dark-bg text-white pb-24 font-['Inter']">
      {/* Ambient background effect */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-lime-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-lime-500/5 blur-[120px] rounded-full"></div>
      </div>

      <header className="relative z-10 border-b border-dark-border backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-6 pt-12 pb-6">
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-12 h-12 flex items-center justify-center rounded-2xl bg-dark-card border border-dark-border hover:border-lime-500/30 transition-all group"
            >
              <i className="ri-arrow-left-s-line text-2xl text-neutral-400 group-hover:text-lime-400"></i>
            </button>
            <div className="text-center">
              <h1 className="text-2xl font-black tracking-tight text-white uppercase">Card Management</h1>
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em]">Secure Virtual & Prepaid Assets</p>
            </div>
            <button className="w-12 h-12 flex items-center justify-center rounded-2xl bg-dark-card border border-dark-border hover:border-lime-500/30 transition-all group">
              <i className="ri-notification-3-line text-2xl text-neutral-400 group-hover:text-lime-400"></i>
            </button>
          </div>

          <div className="flex bg-dark-elevated p-1 rounded-2xl border border-dark-border">
            <button
              onClick={() => setActiveTab('cards')}
              className={`flex-1 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'cards'
                ? 'bg-lime-500 text-black shadow-lg shadow-lime-500/20'
                : 'text-neutral-500 hover:text-white'
                }`}
            >
              My Cards
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'history'
                ? 'bg-lime-500 text-black shadow-lg shadow-lime-500/20'
                : 'text-neutral-500 hover:text-white'
                }`}
            >
              Transactions
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="relative z-10 max-w-7xl mx-auto px-6 pt-8" tabIndex={-1}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-16 h-16 border-4 border-lime-500/20 border-t-lime-500 rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Fetching Account Data...</p>
          </div>
        ) : activeTab === 'cards' ? (
          <div className="space-y-12">
            {prepaidCards.length === 0 && cards.length === 0 ? (
              <div className="text-center py-24 bg-dark-card rounded-[3rem] border border-dark-border backdrop-blur-xl">
                <div className="w-24 h-24 bg-lime-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-lime-500/20">
                  <i className="ri-bank-card-line text-4xl text-lime-400"></i>
                </div>
                <h2 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">No Cards Active</h2>
                <p className="text-neutral-500 mb-10 max-w-sm mx-auto text-sm leading-relaxed">
                  Add your debit/credit card to start spending.
                </p>
                <button
                  onClick={() => setShowAddCardModal(true)}
                  className="px-10 py-5 bg-lime-500 hover:bg-lime-400 text-black font-black rounded-3xl transition-all shadow-2xl shadow-lime-500/20 uppercase text-xs tracking-widest flex items-center justify-center gap-2 mx-auto"
                >
                  <i className="ri-bank-card-2-line text-lg"></i>
                  Add Your Card
                </button>
              </div>
            ) : (
              <>
                <section>
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xs font-black text-neutral-500 uppercase tracking-[0.3em]">Featured Assets</h3>
                    <div className="h-[1px] flex-1 bg-dark-border mx-6"></div>
                  </div>

                  <div className="flex gap-6 overflow-x-auto pb-8 -mx-6 px-6 scrollbar-hide">
                    <button
                      onClick={() => setShowAddCardModal(true)}
                      className="flex-shrink-0 w-80 h-48 bg-dark-elevated rounded-[2.5rem] border-2 border-dashed border-dark-border flex flex-col items-center justify-center gap-4 hover:border-lime-500/50 hover:bg-lime-500/5 transition-all group"
                    >
                      <div className="w-12 h-12 bg-dark-card rounded-2xl flex items-center justify-center group-hover:bg-lime-500/10 group-hover:scale-110 transition-all">
                        <i className="ri-bank-card-2-line text-2xl text-lime-400"></i>
                      </div>
                      <span className="text-xs font-black text-neutral-400 group-hover:text-lime-400 uppercase tracking-widest">Add Your Card</span>
                    </button>
                    {allCards.map((card) => (
                      <div
                        key={card.id}
                        onClick={() => card.isVirtual ? setSelectedCard(card as any) : setSelectedPrepaidCard(card as any)}
                        className={`group flex-shrink-0 w-80 h-48 rounded-[2.5rem] p-8 cursor-pointer transition-all duration-500 relative overflow-hidden border ${(selectedCard?.id === card.id || selectedPrepaidCard?.id === card.id)
                          ? 'border-lime-500/50 scale-105 shadow-2xl shadow-lime-500/20'
                          : 'border-dark-border hover:border-dark-hover'
                          } ${card.provider === 'VISA'
                            ? 'bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900'
                            : card.provider === 'MASTERCARD'
                              ? 'bg-gradient-to-br from-orange-500 via-rose-600 to-slate-900'
                              : 'bg-gradient-to-br from-slate-800 via-slate-900 to-black'
                          }`}
                      >
                        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-white/10 transition-all"></div>

                        <div className="relative z-10 flex flex-col h-full justify-between">
                          <div className="flex justify-between items-center">
                            {getProviderIcon(card.provider)}
                            <div className="flex items-center gap-2">
                              {card.isVirtual && (
                                <span className="px-2 py-0.5 bg-lime-500/20 text-lime-400 text-[7px] font-black rounded-full border border-lime-500/20 uppercase">VIRTUAL</span>
                              )}
                              <div className={`px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[8px] font-black uppercase tracking-widest border border-white/10 ${card.status === 'ACTIVE' ? 'text-lime-400' : 'text-rose-400'
                                }`}>
                                {card.status}
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <div className="text-sm font-mono tracking-[0.2em] text-white/90">
                                {showFullDetails[card.id] ? (
                                  (card as any).revealed?.cardNumber ? formatCardNumber((card as any).revealed.cardNumber) : (card as any).cardNumber || `•••• •••• •••• ${card.lastFour}`
                                ) : (
                                  `•••• •••• •••• ${card.lastFour}`
                                )}
                              </div>
                              <button
                                onClick={(e) => toggleReveal(card.id, e)}
                                disabled={revealLoading[card.id]}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
                              >
                                {revealLoading[card.id] ? (
                                  <i className="ri-loader-4-line animate-spin text-white/60"></i>
                                ) : (
                                  <i className={`ri-${showFullDetails[card.id] ? 'eye-off' : 'eye'}-line text-white/60`}></i>
                                )}
                              </button>
                            </div>
                            <div className="flex items-end justify-between">
                              <div>
                                <p className="text-[7px] font-black text-white/40 uppercase tracking-widest mb-1">Card Holder</p>
                                <p className="text-[10px] font-bold text-white uppercase truncate w-32 tracking-wider">
                                  {(card as any).revealed?.cardHolderName || card.cardholderName}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-[7px] font-black text-white/40 uppercase tracking-widest mb-1">Expires</p>
                                <p className="text-[10px] font-bold text-white tracking-widest">
                                  {showFullDetails[card.id] ? ((card as any).revealed?.expiryMMYY || card.expiryDate) : 'XX/XX'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="bg-dark-card rounded-[3rem] border border-dark-border p-8 mb-12">
                  <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
                    <h3 className="text-xs font-black text-neutral-500 uppercase tracking-[0.3em]">Asset Directory</h3>

                    <div className="relative w-full sm:w-80">
                      <i className="ri-search-line absolute left-5 top-1/2 -translate-y-1/2 text-neutral-500"></i>
                      <input
                        type="text"
                        placeholder="SEARCH CARD..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-6 py-4 bg-dark-elevated border border-dark-border rounded-2xl text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500/50 transition-all text-white"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0" style={{ scrollbarWidth: 'thin' }}>
                    <table className="w-full min-w-[500px] border-separate border-spacing-y-3">
                      <thead>
                        <tr className="text-neutral-500 text-[9px] font-black uppercase tracking-[0.2em]">
                          <th className="text-left pb-4 pl-6 uppercase">Provider</th>
                          <th className="text-left pb-4 uppercase">Reference</th>
                          <th className="text-left pb-4 uppercase">Validity</th>
                          <th className="text-left pb-4 uppercase">Status</th>
                          <th className="text-right pb-4 pr-6 uppercase">Operations</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allCards.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-20 text-center">
                              <div className="flex flex-col items-center opacity-30">
                                <i className="ri-search-eye-line text-4xl mb-4"></i>
                                <p className="text-[10px] font-bold tracking-widest uppercase">No Records Found</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          allCards.map((card) => (
                            <tr
                              key={card.id}
                              className="group bg-dark-elevated hover:bg-dark-hover transition-all rounded-3xl"
                            >
                              <td className="py-5 pl-6 rounded-l-3xl border-y border-l border-dark-border group-hover:border-lime-500/20">
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-8 bg-dark-bg border border-dark-border rounded flex items-center justify-center">
                                    {getProviderIcon(card.provider)}
                                  </div>
                                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{card.provider}</span>
                                </div>
                              </td>
                              <td className="py-5 border-y border-dark-border group-hover:border-lime-500/20">
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-mono text-white tracking-[0.2em]">
                                    {showFullDetails[card.id] ? (
                                      (card as any).revealed?.cardNumber ? formatCardNumber((card as any).revealed.cardNumber) : (card as any).cardNumber || `•••• ${card.lastFour}`
                                    ) : (
                                      `•••• ${card.lastFour}`
                                    )}
                                  </span>
                                  <button
                                    onClick={(e) => toggleReveal(card.id, e)}
                                    disabled={revealLoading[card.id]}
                                    className="text-neutral-500 hover:text-lime-400 transition-colors disabled:opacity-50"
                                  >
                                    {revealLoading[card.id] ? <i className="ri-loader-4-line animate-spin"></i> : <i className={`ri-${showFullDetails[card.id] ? 'eye-off' : 'eye'}-line`}></i>}
                                  </button>
                                </div>
                              </td>
                              <td className="py-5 border-y border-dark-border group-hover:border-lime-500/20">
                                <span className="text-[10px] font-bold text-neutral-400 tracking-widest">
                                  {card.expiryDate}
                                </span>
                              </td>
                              <td className="py-5 border-y border-dark-border group-hover:border-lime-500/20">
                                {getStatusBadge(card.status)}
                              </td>
                              <td className="py-5 pr-6 rounded-r-3xl border-y border-r border-dark-border group-hover:border-lime-500/20 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {!(card as any).isVirtual && (
                                    <>
                                      <button
                                        onClick={() => handleEditPrepaidCard(card as PrepaidCardData)}
                                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-dark-bg border border-dark-border hover:border-lime-500/50 hover:bg-lime-500/10 transition-all"
                                      >
                                        <i className="ri-pencil-line text-neutral-400 group-hover:text-lime-400 transition-colors"></i>
                                      </button>
                                      <button
                                        onClick={() => handleDeletePrepaidCard(card.id)}
                                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-dark-bg border border-dark-border hover:border-rose-500/50 hover:bg-rose-500/10 transition-all"
                                      >
                                        <i className="ri-delete-bin-line text-neutral-400 group-hover:text-rose-400 transition-colors"></i>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selectedCard && (
                  <div className="bg-dark-card p-8 rounded-[3rem] border border-dark-border">
                    <h3 className="text-xs font-black text-neutral-500 uppercase tracking-[0.3em] mb-8">Asset Control Center</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <button
                        onClick={() => setShowTopUpModal(true)}
                        className="flex flex-col items-center gap-4 p-8 bg-dark-elevated border border-dark-border rounded-[2rem] hover:border-lime-500/50 hover:bg-lime-500/5 transition-all group"
                      >
                        <div className="w-12 h-12 bg-lime-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <i className="ri-add-circle-line text-2xl text-lime-400"></i>
                        </div>
                        <span className="text-[10px] font-black text-neutral-400 group-hover:text-lime-400 uppercase tracking-widest">Top Up</span>
                      </button>
                      <button
                        onClick={handleFreezeToggle}
                        className="flex flex-col items-center gap-4 p-8 bg-dark-elevated border border-dark-border rounded-[2rem] hover:border-amber-500/50 hover:bg-amber-500/5 transition-all group"
                      >
                        <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <i className={`text-2xl ${selectedCard.status === 'FROZEN' ? 'ri-lock-unlock-line text-lime-400' : 'ri-lock-line text-amber-500'}`}></i>
                        </div>
                        <span className="text-[10px] font-black text-neutral-400 group-hover:text-amber-400 uppercase tracking-widest">
                          {selectedCard.status === 'FROZEN' ? 'Unfreeze' : 'Freeze'}
                        </span>
                      </button>
                      <button
                        onClick={() => setShowLimitsModal(true)}
                        className="flex flex-col items-center gap-4 p-8 bg-dark-elevated border border-dark-border rounded-[2rem] hover:border-lime-500/50 hover:bg-lime-500/5 transition-all group"
                      >
                        <div className="w-12 h-12 bg-lime-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <i className="ri-settings-3-line text-2xl text-lime-400"></i>
                        </div>
                        <span className="text-[10px] font-black text-neutral-400 group-hover:text-lime-400 uppercase tracking-widest">Limits</span>
                      </button>
                      <button
                        onClick={handleDeleteCard}
                        className="flex flex-col items-center gap-4 p-8 bg-dark-elevated border border-dark-border rounded-[2rem] hover:border-rose-500/50 hover:bg-rose-500/5 transition-all group"
                      >
                        <div className="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <i className="ri-delete-bin-line text-2xl text-rose-400"></i>
                        </div>
                        <span className="text-[10px] font-black text-neutral-400 group-hover:text-rose-400 uppercase tracking-widest">Delete</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="bg-dark-card rounded-[3rem] border border-dark-border overflow-hidden mb-12">
            <div className="p-8 border-b border-dark-border">
              <h3 className="text-xs font-black text-neutral-500 uppercase tracking-[0.3em]">Temporal Ledger</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-dark-elevated text-neutral-500 text-[9px] font-black uppercase tracking-[0.2em]">
                  <tr>
                    <th className="py-5 px-8 uppercase">Entity</th>
                    <th className="py-5 px-8 uppercase">Reference</th>
                    <th className="py-5 px-8 uppercase">Volume</th>
                    <th className="py-5 px-8 uppercase">Timestamp</th>
                    <th className="py-5 px-8 text-right uppercase">Verdict</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {isLoadingTx ? (
                    <tr>
                      <td colSpan={5} className="py-24 text-center">
                        <div className="w-12 h-12 border-4 border-lime-500/20 border-t-lime-500 rounded-full animate-spin mx-auto"></div>
                      </td>
                    </tr>
                  ) : allTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-24 text-center">
                        <div className="flex flex-col items-center opacity-30">
                          <i className="ri-history-line text-5xl mb-6"></i>
                          <p className="text-[10px] font-bold tracking-widest uppercase">No Temporal Data Found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {allTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-dark-elevated transition-all border-b border-dark-border">
                          <td className="py-6 px-8">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-8 bg-dark-bg border border-dark-border rounded flex items-center justify-center">
                                {getProviderIcon((tx as any).card_brand || 'MASTERCARD')}
                              </div>
                              <span className="text-xs font-black text-white/80 uppercase tracking-widest">{tx.merchant_name || 'Transaction'}</span>
                            </div>
                          </td>
                          <td className="py-6 px-8">
                            <span className="text-[10px] font-mono text-neutral-400 tracking-[0.2em]">
                              •••• {(tx as any).card_last_four || '****'}
                            </span>
                          </td>
                          <td className="py-6 px-8">
                            <span className="text-sm font-black text-white">
                              ${(tx.amount / 100).toFixed(2)}
                            </span>
                          </td>
                          <td className="py-6 px-8 text-[10px] font-bold text-neutral-500 tracking-widest uppercase">
                            {formatDate(tx.created_at)}
                          </td>
                          <td className="py-6 px-8 text-right">
                            {getStatusBadge(tx.status)}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <AddCardModal
        isOpen={showAddCardModal}
        onClose={() => { setShowAddCardModal(false); setEditingCard(null); }}
        onAdd={handleAddPrepaidCard}
        editingCard={editingCard}
        onEdit={handleUpdatePrepaidCard}
      />
      <SpendingLimitsModal isOpen={showLimitsModal} onClose={() => setShowLimitsModal(false)} card={selectedCard} onSave={handleUpdateLimits} />
      <TopUpModal isOpen={showTopUpModal} onClose={() => setShowTopUpModal(false)} card={selectedCard} onTopUp={handleTopUp} />
    </div>
  );
}
