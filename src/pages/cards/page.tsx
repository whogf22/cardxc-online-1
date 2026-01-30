import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../../components/BottomNavigation';
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

interface MockTransaction {
  id: string;
  cardId: string;
  provider: 'VISA' | 'MASTERCARD' | 'AMEX';
  lastFour: string;
  amount: number;
  date: string;
  status: 'COMPLETED' | 'FAILED' | 'PENDING';
  merchant?: string;
}

const MOCK_PREPAID_CARDS: PrepaidCardData[] = [
  {
    id: 'prepaid_1',
    cardholderName: 'John Doe',
    cardNumber: '4111111111111234',
    expiryDate: '12/26',
    cvv: '123',
    provider: 'VISA',
    lastFour: '1234',
    billingAddress: { addressLine1: '123 Main St', city: 'New York', state: 'NY', postalCode: '10001', country: 'United States' },
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'prepaid_2',
    cardholderName: 'Jane Smith',
    cardNumber: '5500000000005678',
    expiryDate: '08/27',
    cvv: '456',
    provider: 'MASTERCARD',
    lastFour: '5678',
    billingAddress: { addressLine1: '456 Oak Ave', city: 'Los Angeles', state: 'CA', postalCode: '90001', country: 'United States' },
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'prepaid_3',
    cardholderName: 'Bob Wilson',
    cardNumber: '378282246310005',
    expiryDate: '03/25',
    cvv: '7890',
    provider: 'AMEX',
    lastFour: '0005',
    billingAddress: { addressLine1: '789 Pine Rd', city: 'Chicago', state: 'IL', postalCode: '60601', country: 'United States' },
    status: 'EXPIRED',
    createdAt: new Date(Date.now() - 604800000).toISOString(),
  },
];

const MOCK_TRANSACTIONS: MockTransaction[] = [
  { id: 'tx_1', cardId: 'prepaid_1', provider: 'VISA', lastFour: '1234', amount: 150.00, date: new Date(Date.now() - 3600000).toISOString(), status: 'COMPLETED', merchant: 'Amazon' },
  { id: 'tx_2', cardId: 'prepaid_2', provider: 'MASTERCARD', lastFour: '5678', amount: 45.99, date: new Date(Date.now() - 86400000).toISOString(), status: 'COMPLETED', merchant: 'Netflix' },
  { id: 'tx_3', cardId: 'prepaid_1', provider: 'VISA', lastFour: '1234', amount: 250.00, date: new Date(Date.now() - 172800000).toISOString(), status: 'PENDING', merchant: 'Apple Store' },
  { id: 'tx_4', cardId: 'prepaid_3', provider: 'AMEX', lastFour: '0005', amount: 89.50, date: new Date(Date.now() - 259200000).toISOString(), status: 'FAILED', merchant: 'Uber' },
  { id: 'tx_5', cardId: 'prepaid_2', provider: 'MASTERCARD', lastFour: '5678', amount: 32.00, date: new Date(Date.now() - 345600000).toISOString(), status: 'COMPLETED', merchant: 'Spotify' },
];

export default function CardsPage() {
  const navigate = useNavigate();
  const toast = useToastContext();
  const [cards, setCards] = useState<VirtualCard[]>([]);
  const [prepaidCards, setPrepaidCards] = useState<PrepaidCardData[]>(MOCK_PREPAID_CARDS);
  const [mockTransactions, setMockTransactions] = useState<MockTransaction[]>(MOCK_TRANSACTIONS);
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

  const loadCards = async () => {
    try {
      setIsLoading(true);
      const data = await cardService.getCards();
      setCards(data);
      if (data.length > 0 && !selectedCard) {
        setSelectedCard(data[0]);
      }
    } catch (error) {
      console.error('[CardsPage] Failed to load cards:', error);
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
    setMockTransactions(prev => prev.filter(tx => tx.cardId !== cardId));
    toast.success('Card deleted successfully!');
  };

  const handleFreezeToggle = async () => {
    if (!selectedCard) return;
    toast.info('Card freeze/unfreeze coming soon!');
  };

  const handleDeleteCard = async () => {
    if (!selectedCard) return;
    toast.info('Card deletion coming soon!');
  };

  const handleUpdateLimits = async (limits: { daily_limit: number; monthly_limit: number; per_transaction_limit: number }) => {
    if (!selectedCard) return;
    toast.info('Spending limits management coming soon!');
    setShowLimitsModal(false);
  };

  const handleTopUp = async (amount: number) => {
    if (!selectedCard) return;
    toast.info('Card top-up coming soon!');
    setShowTopUpModal(false);
  };

  const cardVariants: ('lime' | 'orange' | 'blue')[] = ['lime', 'orange', 'blue'];

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'COMPLETED':
      case 'SUCCESS':
      case 'ACTIVE':
        return <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
          {status === 'ACTIVE' ? 'ACTIVE' : 'COMPLETED'}
        </span>;
      case 'FAILED':
      case 'DECLINED':
      case 'EXPIRED':
        return <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
          {status === 'EXPIRED' ? 'EXPIRED' : 'FAILED'}
        </span>;
      case 'PENDING':
      case 'SUSPENDED':
        return <span className="px-2.5 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
          {status === 'SUSPENDED' ? 'SUSPENDED' : 'PENDING'}
        </span>;
      default:
        return <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">{status}</span>;
    }
  };

  const getProviderIcon = (provider: 'VISA' | 'MASTERCARD' | 'AMEX') => {
    switch (provider) {
      case 'VISA':
        return (
          <div className="w-10 h-6 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold italic">VISA</span>
          </div>
        );
      case 'MASTERCARD':
        return (
          <div className="w-10 h-6 flex items-center justify-center">
            <div className="flex -space-x-1">
              <div className="w-4 h-4 bg-red-500 rounded-full"></div>
              <div className="w-4 h-4 bg-yellow-400 rounded-full"></div>
            </div>
          </div>
        );
      case 'AMEX':
        return (
          <div className="w-10 h-6 bg-blue-800 rounded flex items-center justify-center">
            <span className="text-white text-[8px] font-bold">AMEX</span>
          </div>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const filteredCards = cards.filter(card => 
    card.card_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.last_four?.includes(searchQuery)
  );

  const filteredPrepaidCards = prepaidCards.filter(card =>
    card.cardholderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.lastFour.includes(searchQuery)
  );

  const allCards = [...filteredPrepaidCards];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-6 pt-12 pb-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100"
          >
            <i className="ri-arrow-left-s-line text-xl text-gray-600"></i>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Prepaid Card</h1>
          <button className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100">
            <i className="ri-notification-3-line text-xl text-gray-600"></i>
          </button>
        </div>

        <div className="px-6 pb-4">
          <div className="flex bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('cards')}
              className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'cards'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600'
              }`}
            >
              My Cards
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'history'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600'
              }`}
            >
              Transaction History
            </button>
          </div>
        </div>
      </div>

      <main className="px-4 pt-4">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <i className="ri-loader-4-line animate-spin text-4xl text-gray-400"></i>
          </div>
        ) : activeTab === 'cards' ? (
          <>
            {prepaidCards.length === 0 && cards.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="ri-bank-card-line text-4xl text-gray-400"></i>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">No Cards Yet</h2>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  Add your first prepaid card to start making secure online payments
                </p>
                <button
                  onClick={() => setShowAddCardModal(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/25"
                >
                  <i className="ri-add-line"></i>
                  Add Prepaid Card
                </button>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-500 mb-3">Recently Added</h3>
                  <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
                    <button
                      onClick={() => setShowAddCardModal(true)}
                      className="flex-shrink-0 w-48 h-32 bg-white rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2 hover:border-blue-500 hover:bg-blue-50 transition-all shadow-sm"
                    >
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <i className="ri-add-line text-xl text-blue-600"></i>
                      </div>
                      <span className="text-sm font-medium text-gray-600">Add New Card</span>
                    </button>

                    {prepaidCards.slice(0, 3).map((card, index) => (
                      <div
                        key={card.id}
                        onClick={() => setSelectedPrepaidCard(card)}
                        className={`flex-shrink-0 w-48 h-32 rounded-2xl p-4 cursor-pointer transition-all shadow-lg ${
                          card.provider === 'VISA' 
                            ? 'bg-gradient-to-br from-blue-600 to-blue-800' 
                            : card.provider === 'MASTERCARD'
                            ? 'bg-gradient-to-br from-orange-500 to-red-600'
                            : 'bg-gradient-to-br from-blue-800 to-indigo-900'
                        } ${selectedPrepaidCard?.id === card.id ? 'scale-105 ring-2 ring-blue-400' : ''}`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          {getProviderIcon(card.provider)}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            card.status === 'ACTIVE' ? 'bg-green-400/20 text-green-100' : 'bg-red-400/20 text-red-100'
                          }`}>
                            {card.status}
                          </span>
                        </div>
                        <div className="text-white/80 text-xs font-mono mb-1">•••• {card.lastFour}</div>
                        <div className="text-white text-xs truncate">{card.cardholderName}</div>
                        <div className="text-white/60 text-[10px] mt-1">Exp. {card.expiryDate}</div>
                      </div>
                    ))}

                    {cards.slice(0, 3 - prepaidCards.slice(0, 3).length).map((card, index) => (
                      <div
                        key={card.id}
                        onClick={() => setSelectedCard(card)}
                        className={`flex-shrink-0 cursor-pointer transition-transform ${
                          selectedCard?.id === card.id ? 'scale-105' : ''
                        }`}
                      >
                        <VirtualCardDisplay
                          card={card}
                          variant={cardVariants[index % cardVariants.length]}
                          size="sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">All Cards</h3>
                    <button className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors">
                      <i className="ri-filter-3-line text-gray-600"></i>
                    </button>
                  </div>

                  <div className="relative mb-4">
                    <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <input
                      type="text"
                      placeholder="Search card name, number..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="overflow-x-auto -mx-4 px-4">
                    <table className="w-full min-w-[600px]">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Provider</th>
                          <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Card Number</th>
                          <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Expiry</th>
                          <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="text-right py-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allCards.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-gray-500 text-sm">
                              No cards found
                            </td>
                          </tr>
                        ) : (
                          allCards.map((card) => (
                            <tr 
                              key={card.id} 
                              className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                            >
                              <td className="py-4 px-2">
                                <div className="flex items-center gap-3">
                                  {getProviderIcon(card.provider)}
                                  <span className="text-sm font-medium text-gray-700 hidden sm:inline">{card.provider}</span>
                                </div>
                              </td>
                              <td className="py-4 px-2">
                                <span className="text-sm text-gray-900 font-mono">
                                  •••• •••• •••• {card.lastFour}
                                </span>
                              </td>
                              <td className="py-4 px-2">
                                <span className="text-sm text-gray-600">
                                  {card.expiryDate}
                                </span>
                              </td>
                              <td className="py-4 px-2">
                                {getStatusBadge(card.status)}
                              </td>
                              <td className="py-4 px-2">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditPrepaidCard(card);
                                    }}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                                    title="Edit"
                                  >
                                    <i className="ri-pencil-line text-gray-500 hover:text-blue-600"></i>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeletePrepaidCard(card.id);
                                    }}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors"
                                    title="Delete"
                                  >
                                    <i className="ri-delete-bin-line text-gray-500 hover:text-red-600"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                        {filteredCards.map((card) => (
                          <tr 
                            key={card.id} 
                            onClick={() => setSelectedCard(card)}
                            className={`border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${
                              selectedCard?.id === card.id ? 'bg-blue-50' : ''
                            }`}
                          >
                            <td className="py-4 px-2">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-6 rounded flex items-center justify-center ${
                                  card.card_brand === 'VISA' ? 'bg-blue-600' : 'bg-orange-500'
                                }`}>
                                  {card.card_brand === 'VISA' ? (
                                    <span className="text-white text-xs font-bold">VISA</span>
                                  ) : (
                                    <div className="flex">
                                      <div className="w-3 h-3 bg-red-500 rounded-full -mr-1"></div>
                                      <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-2">
                              <span className="text-sm text-gray-900 font-mono">
                                •••• •••• •••• {card.last_four || '****'}
                              </span>
                            </td>
                            <td className="py-4 px-2">
                              <span className="text-sm text-gray-600">
                                {card.expiry_month?.toString().padStart(2, '0')}/{card.expiry_year?.toString().slice(-2) || '30'}
                              </span>
                            </td>
                            <td className="py-4 px-2">
                              {getStatusBadge(card.status)}
                            </td>
                            <td className="py-4 px-2">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowLimitsModal(true);
                                    setSelectedCard(card);
                                  }}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                                  title="Settings"
                                >
                                  <i className="ri-settings-3-line text-gray-500 hover:text-blue-600"></i>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCard();
                                  }}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors"
                                  title="Delete"
                                >
                                  <i className="ri-delete-bin-line text-gray-500 hover:text-red-600"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selectedCard && (
                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-4">Card Actions</h3>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={() => setShowTopUpModal(true)}
                        className="flex flex-col items-center gap-2 p-3 bg-gray-50 hover:bg-blue-50 rounded-xl transition-colors"
                      >
                        <i className="ri-add-circle-line text-xl text-blue-500"></i>
                        <span className="text-xs font-medium text-gray-700">Top Up</span>
                      </button>
                      <button
                        onClick={handleFreezeToggle}
                        disabled={actionLoading === 'freeze'}
                        className="flex flex-col items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
                      >
                        {actionLoading === 'freeze' ? (
                          <i className="ri-loader-4-line animate-spin text-xl text-gray-500"></i>
                        ) : (
                          <i className={`text-xl ${selectedCard.status === 'FROZEN' ? 'ri-lock-unlock-line text-green-500' : 'ri-lock-line text-orange-500'}`}></i>
                        )}
                        <span className="text-xs font-medium text-gray-700">
                          {selectedCard.status === 'FROZEN' ? 'Unfreeze' : 'Freeze'}
                        </span>
                      </button>
                      <button
                        onClick={() => setShowLimitsModal(true)}
                        className="flex flex-col items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                      >
                        <i className="ri-settings-3-line text-xl text-gray-500"></i>
                        <span className="text-xs font-medium text-gray-700">Limits</span>
                      </button>
                      <button
                        onClick={handleDeleteCard}
                        disabled={actionLoading === 'delete'}
                        className="flex flex-col items-center gap-2 p-3 bg-gray-50 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
                      >
                        {actionLoading === 'delete' ? (
                          <i className="ri-loader-4-line animate-spin text-xl text-gray-500"></i>
                        ) : (
                          <i className="ri-delete-bin-line text-xl text-red-500"></i>
                        )}
                        <span className="text-xs font-medium text-gray-700">Delete</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Provider</th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Card Number</th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="text-right py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingTx ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center">
                        <i className="ri-loader-4-line animate-spin text-2xl text-gray-400"></i>
                      </td>
                    </tr>
                  ) : mockTransactions.length === 0 && allTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center">
                        <div className="flex flex-col items-center">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                            <i className="ri-exchange-line text-2xl text-gray-400"></i>
                          </div>
                          <span className="text-gray-500 text-sm">No transactions yet</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {mockTransactions.map((tx) => (
                        <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              {getProviderIcon(tx.provider)}
                              {tx.merchant && (
                                <span className="text-xs text-gray-500 hidden sm:inline">{tx.merchant}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-sm text-gray-900 font-mono">
                              •••• •••• •••• {tx.lastFour}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-sm font-semibold text-gray-900">
                              ${tx.amount.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-sm text-gray-600">
                              {formatDate(tx.date)}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            {getStatusBadge(tx.status)}
                          </td>
                        </tr>
                      ))}
                      {allTransactions.map((tx, index) => (
                        <tr key={tx.id || index} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-6 bg-orange-500 rounded flex items-center justify-center">
                                <div className="flex">
                                  <div className="w-3 h-3 bg-red-500 rounded-full -mr-1"></div>
                                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-sm text-gray-900 font-mono">
                              •••• •••• •••• {(tx as any).card_last_four || '****'}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-sm font-semibold text-gray-900">
                              ${Math.abs(tx.amount).toFixed(2)}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-sm text-gray-600">
                              {formatDate(tx.created_at)}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
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

      <BottomNavigation />

      <CreateCardModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateCard}
      />

      <AddCardModal
        isOpen={showAddCardModal}
        onClose={() => {
          setShowAddCardModal(false);
          setEditingCard(null);
        }}
        onAdd={handleAddPrepaidCard}
      />

      <SpendingLimitsModal
        isOpen={showLimitsModal}
        onClose={() => setShowLimitsModal(false)}
        card={selectedCard}
        onSave={handleUpdateLimits}
      />

      <TopUpModal
        isOpen={showTopUpModal}
        onClose={() => setShowTopUpModal(false)}
        card={selectedCard}
        onTopUp={handleTopUp}
      />
    </div>
  );
}
