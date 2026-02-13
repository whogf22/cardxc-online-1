import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cardService } from '../../lib/cardService';
import { useToastContext } from '../../contexts/ToastContext';
import VirtualCardDisplay from './components/VirtualCardDisplay';
import CardTransactionList from './components/CardTransactionList';
import CreateCardModal from './components/CreateCardModal';
import SpendingLimitsModal from './components/SpendingLimitsModal';
import TopUpModal from './components/TopUpModal';
import AddCardModal, { type PrepaidCardData } from './components/AddCardModal';
import type { VirtualCard, CardTransaction } from '../../types/card';

type TabType = 'cards' | 'history';

export default function CardsPage() {
  const navigate = useNavigate();
  const toast = useToastContext();
  const [cards, setCards] = useState<VirtualCard[]>([]);
  const [prepaidCards, setPrepaidCards] = useState<PrepaidCardData[]>(() => {
    try {
      const saved = localStorage.getItem('cardxc_prepaid_cards');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedCard, setSelectedCard] = useState<VirtualCard | null>(null);
  const [selectedPrepaidCard, setSelectedPrepaidCard] = useState<PrepaidCardData | null>(null);
  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<CardTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTx, setIsLoadingTx] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [showLimitsModal, setShowLimitsModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [editingCard, setEditingCard] = useState<PrepaidCardData | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFullDetails, setShowFullDetails] = useState<Record<string, boolean>>({});

  const toggleReveal = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowFullDetails(prev => ({ ...prev, [id]: !prev[id] }));
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
    } catch (error) {
      console.error('Failed to load cards:', error);
      // Fail safely
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
    try {
      localStorage.setItem('cardxc_prepaid_cards', JSON.stringify(prepaidCards));
    } catch {}
  }, [prepaidCards]);

  useEffect(() => {
    loadCards();
  }, []);

  useEffect(() => {
    if (selectedCard) {
      loadTransactions(selectedCard.id);
    }
  }, [selectedCard?.id]);

  useEffect(() => {
    if (activeTab === 'history' && cards.length > 0) {
      loadAllTransactions();
    }
  }, [activeTab, cards.length]);

  const handleCreateCard = async (data: { card_brand: 'VISA' | 'MASTERCARD'; card_name: string; initial_balance: number }) => {
    const newCard = await cardService.createCard(data);
    setCards(prev => [newCard, ...prev]);
    setSelectedCard(newCard);
  };

  const handleAddPrepaidCard = (card: PrepaidCardData) => {
    setPrepaidCards(prev => [card, ...prev]);
    toast.success('Card added successfully!');
  };

  const handleEditPrepaidCard = (card: PrepaidCardData) => {
    setEditingCard(card);
    setShowAddCardModal(true);
  };

  const handleDeletePrepaidCard = (cardId: string) => {
    setPrepaidCards(prev => prev.filter(c => c.id !== cardId));
    toast.success('Card deleted successfully!');
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

  const cardVariants: ('lime' | 'orange' | 'blue')[] = ['lime', 'orange', 'blue'];

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'COMPLETED' || s === 'SUCCESS' || s === 'ACTIVE') {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/20 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
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
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const filteredCards = cards.filter(card =>
    card.card_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.last_four?.includes(searchQuery)
  ).map(c => ({
    ...c,
    provider: c.card_brand as 'VISA' | 'MASTERCARD' | 'AMEX',
    lastFour: c.last_four,
    cardholderName: c.card_name || 'Virtual Card',
    expiryDate: `${String(c.expiry_month).padStart(2, '0')}/${String(c.expiry_year).slice(-2)}`,
    isVirtual: true
  }));

  const filteredPrepaidCards = prepaidCards.filter(card =>
    card.cardholderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.lastFour.includes(searchQuery)
  ).map(c => ({ ...c, isVirtual: false }));

  const allCards = [...filteredCards, ...filteredPrepaidCards];

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 pb-24 font-['Inter']">
      {/* Ambient background effect */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full"></div>
      </div>

      <header className="relative z-10 border-b border-slate-800/50 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-6 pt-12 pb-6">
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all group"
            >
              <i className="ri-arrow-left-s-line text-2xl text-slate-400 group-hover:text-emerald-400"></i>
            </button>
            <div className="text-center">
              <h1 className="text-2xl font-black tracking-tight text-white uppercase">Card Management</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Secure Virtual & Prepaid Assets</p>
            </div>
            <button className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all group">
              <i className="ri-notification-3-line text-2xl text-slate-400 group-hover:text-emerald-400"></i>
            </button>
          </div>

          <div className="flex bg-slate-900/50 p-1 rounded-2xl border border-slate-800/50">
            <button
              onClick={() => setActiveTab('cards')}
              className={`flex-1 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'cards'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'text-slate-500 hover:text-slate-300'
                }`}
            >
              My Cards
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'history'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'text-slate-500 hover:text-slate-300'
                }`}
            >
              Transactions
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Fetching Account Data...</p>
          </div>
        ) : activeTab === 'cards' ? (
          <div className="space-y-12">
            {prepaidCards.length === 0 && cards.length === 0 ? (
              <div className="text-center py-24 bg-slate-900/40 rounded-[3rem] border border-slate-800/50 backdrop-blur-xl">
                <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-emerald-500/20">
                  <i className="ri-bank-card-line text-4xl text-emerald-400"></i>
                </div>
                <h2 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">No Cards Active</h2>
                <p className="text-slate-500 mb-10 max-w-sm mx-auto text-sm leading-relaxed">
                  Start your digital spending journey by creating our signature virtual cards.
                </p>
                <button
                  onClick={() => setShowAddCardModal(true)}
                  className="px-10 py-5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black rounded-3xl transition-all shadow-2xl shadow-emerald-500/40 uppercase text-xs tracking-widest"
                >
                  Create New Card
                </button>
              </div>
            ) : (
              <>
                <section>
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Featured Assets</h3>
                    <div className="h-[1px] flex-1 bg-slate-800/50 mx-6"></div>
                  </div>

                  <div className="flex gap-6 overflow-x-auto pb-8 -mx-6 px-6 scrollbar-hide">
                    <button
                      onClick={() => setShowAddCardModal(true)}
                      className="flex-shrink-0 w-80 h-48 bg-slate-900/30 rounded-[2.5rem] border-2 border-dashed border-slate-800 flex flex-col items-center justify-center gap-4 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group"
                    >
                      <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500/10 group-hover:scale-110 transition-all">
                        <i className="ri-add-line text-2xl text-emerald-400"></i>
                      </div>
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Issue New Card</span>
                    </button>

                    {allCards.map((card, index) => (
                      <div
                        key={card.id}
                        onClick={() => card.isVirtual ? setSelectedCard(card as any) : setSelectedPrepaidCard(card as any)}
                        className={`group flex-shrink-0 w-80 h-48 rounded-[2.5rem] p-8 cursor-pointer transition-all duration-500 relative overflow-hidden border ${(selectedCard?.id === card.id || selectedPrepaidCard?.id === card.id)
                          ? 'border-emerald-500/50 scale-105 shadow-2xl shadow-emerald-500/20'
                          : 'border-slate-800/50 hover:border-slate-700'
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
                                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[7px] font-black rounded-full border border-emerald-500/20 uppercase">VIRTUAL</span>
                              )}
                              <div className={`px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[8px] font-black uppercase tracking-widest border border-white/10 ${card.status === 'ACTIVE' ? 'text-emerald-400' : 'text-rose-400'
                                }`}>
                                {card.status}
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <div className="text-sm font-mono tracking-[0.2em] text-white/90">
                                {showFullDetails[card.id] ? (
                                  (card as any).cardNumber || `•••• •••• •••• ${card.lastFour}`
                                ) : (
                                  `•••• •••• •••• ${card.lastFour}`
                                )}
                              </div>
                              <button
                                onClick={(e) => toggleReveal(card.id, e)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                              >
                                <i className={`ri-${showFullDetails[card.id] ? 'eye-off' : 'eye'}-line text-white/60`}></i>
                              </button>
                            </div>
                            <div className="flex items-end justify-between">
                              <div>
                                <p className="text-[7px] font-black text-white/40 uppercase tracking-widest mb-1">Card Holder</p>
                                <p className="text-[10px] font-bold text-white uppercase truncate w-32 tracking-wider">{card.cardholderName}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[7px] font-black text-white/40 uppercase tracking-widest mb-1">Expires</p>
                                <p className="text-[10px] font-bold text-white tracking-widest">
                                  {showFullDetails[card.id] ? (card.expiryDate) : 'XX/XX'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="bg-slate-900/30 rounded-[3rem] border border-slate-800/50 backdrop-blur-xl p-8 mb-12 shadow-3d">
                  <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Asset Directory</h3>

                    <div className="relative w-full sm:w-80">
                      <i className="ri-search-line absolute left-5 top-1/2 -translate-y-1/2 text-slate-500"></i>
                      <input
                        type="text"
                        placeholder="SEARCH CARD..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-6 py-4 bg-slate-950/50 border border-slate-800 rounded-2xl text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all text-white"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-separate border-spacing-y-3">
                      <thead>
                        <tr className="text-slate-500 text-[9px] font-black uppercase tracking-[0.2em]">
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
                              className="group bg-slate-900/20 hover:bg-slate-800/30 transition-all rounded-3xl"
                            >
                              <td className="py-5 pl-6 rounded-l-3xl border-y border-l border-slate-800/50 group-hover:border-emerald-500/20">
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-8 bg-slate-950 border border-slate-800 rounded flex items-center justify-center">
                                    {getProviderIcon(card.provider)}
                                  </div>
                                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{card.provider}</span>
                                </div>
                              </td>
                              <td className="py-5 border-y border-slate-800/50 group-hover:border-emerald-500/20">
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-mono text-white tracking-[0.2em]">
                                    {showFullDetails[card.id] ? (
                                      (card as any).cardNumber || `•••• ${card.lastFour}`
                                    ) : (
                                      `•••• ${card.lastFour}`
                                    )}
                                  </span>
                                  <button
                                    onClick={(e) => toggleReveal(card.id, e)}
                                    className="text-slate-500 hover:text-emerald-400 transition-colors"
                                  >
                                    <i className={`ri-${showFullDetails[card.id] ? 'eye-off' : 'eye'}-line`}></i>
                                  </button>
                                </div>
                              </td>
                              <td className="py-5 border-y border-slate-800/50 group-hover:border-emerald-500/20">
                                <span className="text-[10px] font-bold text-slate-400 tracking-widest">
                                  {card.expiryDate}
                                </span>
                              </td>
                              <td className="py-5 border-y border-slate-800/50 group-hover:border-emerald-500/20">
                                {getStatusBadge(card.status)}
                              </td>
                              <td className="py-5 pr-6 rounded-r-3xl border-y border-r border-slate-800/50 group-hover:border-emerald-500/20 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {!(card as any).isVirtual && (
                                    <>
                                      <button
                                        onClick={() => handleEditPrepaidCard(card as PrepaidCardData)}
                                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all"
                                      >
                                        <i className="ri-pencil-line text-slate-400 group-hover:text-emerald-400 transition-colors"></i>
                                      </button>
                                      <button
                                        onClick={() => handleDeletePrepaidCard(card.id)}
                                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-950 border border-slate-800 hover:border-rose-500/50 hover:bg-rose-500/10 transition-all"
                                      >
                                        <i className="ri-delete-bin-line text-slate-400 group-hover:text-rose-400 transition-colors"></i>
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
                  <div className="bg-slate-900 p-8 rounded-[3rem] border border-slate-800/50 backdrop-blur-xl">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] mb-8">Asset Control Center</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <button
                        onClick={() => setShowTopUpModal(true)}
                        className="flex flex-col items-center gap-4 p-8 bg-slate-950 border border-slate-800 rounded-[2rem] hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group"
                      >
                        <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <i className="ri-add-circle-line text-2xl text-emerald-400"></i>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 group-hover:text-emerald-400 uppercase tracking-widest">Top Up</span>
                      </button>
                      <button
                        onClick={handleFreezeToggle}
                        className="flex flex-col items-center gap-4 p-8 bg-slate-950 border border-slate-800 rounded-[2rem] hover:border-amber-500/50 hover:bg-amber-500/5 transition-all group"
                      >
                        <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <i className={`text-2xl ${selectedCard.status === 'FROZEN' ? 'ri-lock-unlock-line text-emerald-400' : 'ri-lock-line text-amber-500'}`}></i>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 group-hover:text-amber-400 uppercase tracking-widest">
                          {selectedCard.status === 'FROZEN' ? 'Unfreeze' : 'Freeze'}
                        </span>
                      </button>
                      <button
                        onClick={() => setShowLimitsModal(true)}
                        className="flex flex-col items-center gap-4 p-8 bg-slate-950 border border-slate-800 rounded-[2rem] hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group"
                      >
                        <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <i className="ri-settings-3-line text-2xl text-blue-400"></i>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 group-hover:text-blue-400 uppercase tracking-widest">Limits</span>
                      </button>
                      <button
                        onClick={handleDeleteCard}
                        className="flex flex-col items-center gap-4 p-8 bg-slate-950 border border-slate-800 rounded-[2rem] hover:border-rose-500/50 hover:bg-rose-500/5 transition-all group"
                      >
                        <div className="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <i className="ri-delete-bin-line text-2xl text-rose-400"></i>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 group-hover:text-rose-400 uppercase tracking-widest">Delete</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="bg-slate-900/40 rounded-[3rem] border border-slate-800/50 backdrop-blur-xl overflow-hidden mb-12 shadow-3d">
            <div className="p-8 border-b border-slate-800/50">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Temporal Ledger</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-950/30 text-slate-500 text-[9px] font-black uppercase tracking-[0.2em]">
                  <tr>
                    <th className="py-5 px-8 uppercase">Entity</th>
                    <th className="py-5 px-8 uppercase">Reference</th>
                    <th className="py-5 px-8 uppercase">Volume</th>
                    <th className="py-5 px-8 uppercase">Timestamp</th>
                    <th className="py-5 px-8 text-right uppercase">Verdict</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30">
                  {isLoadingTx ? (
                    <tr>
                      <td colSpan={5} className="py-24 text-center">
                        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto"></div>
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
                        <tr key={tx.id} className="hover:bg-slate-800/20 transition-all border-b border-slate-800/30">
                          <td className="py-6 px-8">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-8 bg-slate-950 border border-slate-800 rounded flex items-center justify-center">
                                {getProviderIcon((tx as any).card_brand || 'MASTERCARD')}
                              </div>
                              <span className="text-xs font-black text-white/80 uppercase tracking-widest">{tx.merchant_name || 'Transaction'}</span>
                            </div>
                          </td>
                          <td className="py-6 px-8">
                            <span className="text-[10px] font-mono text-slate-400 tracking-[0.2em]">
                              •••• {(tx as any).card_last_four || '****'}
                            </span>
                          </td>
                          <td className="py-6 px-8">
                            <span className="text-sm font-black text-white">
                              ${(tx.amount / 100).toFixed(2)}
                            </span>
                          </td>
                          <td className="py-6 px-8 text-[10px] font-bold text-slate-500 tracking-widest uppercase">
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

      <CreateCardModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onCreate={handleCreateCard} />
      <AddCardModal isOpen={showAddCardModal} onClose={() => { setShowAddCardModal(false); setEditingCard(null); }} onAdd={handleAddPrepaidCard} />
      <SpendingLimitsModal isOpen={showLimitsModal} onClose={() => setShowLimitsModal(false)} card={selectedCard} onSave={handleUpdateLimits} />
      <TopUpModal isOpen={showTopUpModal} onClose={() => setShowTopUpModal(false)} card={selectedCard} onTopUp={handleTopUp} />
    </div>
  );
}
