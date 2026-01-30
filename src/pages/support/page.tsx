import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../lib/api';
import { useToastContext } from '../../contexts/ToastContext';
import BottomNavigation from '../../components/BottomNavigation';

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  category: 'account' | 'payment' | 'card' | 'kyc' | 'technical' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  is_internal_note: boolean;
  created_at: string;
  is_from_user: boolean;
}

type ViewType = 'list' | 'detail' | 'create';

const CATEGORY_OPTIONS = [
  { value: 'account', label: 'Account Issues', icon: 'ri-user-settings-line' },
  { value: 'payment', label: 'Payment Problems', icon: 'ri-money-dollar-circle-line' },
  { value: 'card', label: 'Card Issues', icon: 'ri-bank-card-line' },
  { value: 'kyc', label: 'KYC / Verification', icon: 'ri-shield-check-line' },
  { value: 'technical', label: 'Technical Support', icon: 'ri-settings-3-line' },
  { value: 'other', label: 'Other', icon: 'ri-question-line' },
];

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  waiting_customer: { label: 'Awaiting Your Reply', color: 'bg-purple-100 text-purple-700' },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700' },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-700' },
};

const STORAGE_KEY = 'cardxc_support_tickets';

function getStoredTickets(): SupportTicket[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function storeTickets(tickets: SupportTicket[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  } catch (err) {
    console.warn('[SupportPage] Failed to store tickets:', err);
  }
}

export default function SupportPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToastContext();
  
  const [userId, setUserId] = useState<string | null>(null);
  const [view, setView] = useState<ViewType>('list');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  
  const [newTicket, setNewTicket] = useState<{
    subject: string;
    message: string;
    category: 'account' | 'payment' | 'card' | 'kyc' | 'technical' | 'other';
    priority: 'low' | 'medium' | 'high';
  }>({
    subject: '',
    message: '',
    category: 'other',
    priority: 'medium',
  });
  const [submitting, setSubmitting] = useState(false);
  
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const result = await authApi.getSession();
      if (!result.success || !result.data?.user) {
        navigate('/signin');
        return;
      }
      setUserId(result.data.user.id);
      loadTickets(result.data.user.id);
    } catch (err) {
      console.error('[SupportPage] Auth check failed:', err);
      navigate('/signin');
    }
  };

  const loadTickets = useCallback(async (uid: string) => {
    try {
      setLoading(true);
      // TODO: Replace with supportApi.getTickets() when backend API is available
      // For now, use local storage to persist tickets across sessions
      const storedTickets = getStoredTickets().filter(t => t.id.startsWith(uid.slice(0, 8)));
      setTickets(storedTickets);
    } catch (err) {
      console.error('[SupportPage] Error loading tickets:', err);
      showError('Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const loadMessages = useCallback(async (ticketId: string) => {
    if (!userId) return;
    try {
      setMessagesLoading(true);
      // TODO: Replace with supportApi.getMessages(ticketId) when backend API is available
      // For now, return an initial message from the ticket itself
      const ticket = tickets.find(t => t.id === ticketId);
      if (ticket) {
        const initialMessage: TicketMessage = {
          id: `msg_${ticketId}_0`,
          ticket_id: ticketId,
          sender_id: userId,
          message: ticket.message,
          is_internal_note: false,
          created_at: ticket.created_at,
          is_from_user: true,
        };
        setMessages([initialMessage]);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error('[SupportPage] Error loading messages:', err);
      showError('Failed to load messages');
    } finally {
      setMessagesLoading(false);
    }
  }, [userId, tickets, showError]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    if (!newTicket.subject.trim() || !newTicket.message.trim()) {
      showError('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      
      // TODO: Replace with supportApi.createTicket() when backend API is available
      const now = new Date().toISOString();
      const ticketId = `${userId.slice(0, 8)}_${Date.now()}`;
      
      const createdTicket: SupportTicket = {
        id: ticketId,
        subject: newTicket.subject.trim(),
        message: newTicket.message.trim(),
        category: newTicket.category,
        priority: newTicket.priority,
        status: 'open',
        created_at: now,
        updated_at: now,
      };
      
      const updatedTickets = [createdTicket, ...tickets];
      setTickets(updatedTickets);
      storeTickets(updatedTickets);

      success('Support ticket created successfully');
      setNewTicket({ subject: '', message: '', category: 'other', priority: 'medium' });
      setView('list');
    } catch (err) {
      console.error('[SupportPage] Error creating ticket:', err);
      showError('Failed to create support ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!userId || !selectedTicket || !replyMessage.trim()) return;

    try {
      setSendingReply(true);
      
      // TODO: Replace with supportApi.sendReply() when backend API is available
      const now = new Date().toISOString();
      const newMessage: TicketMessage = {
        id: `msg_${selectedTicket.id}_${Date.now()}`,
        ticket_id: selectedTicket.id,
        sender_id: userId,
        message: replyMessage.trim(),
        is_internal_note: false,
        created_at: now,
        is_from_user: true,
      };
      
      setMessages(prev => [...prev, newMessage]);
      
      // Update ticket status
      const updatedTickets = tickets.map(t => 
        t.id === selectedTicket.id 
          ? { ...t, status: 'open' as const, updated_at: now }
          : t
      );
      setTickets(updatedTickets);
      storeTickets(updatedTickets);

      success('Reply sent successfully');
      setReplyMessage('');
    } catch (err) {
      console.error('[SupportPage] Error sending reply:', err);
      showError('Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const handleViewTicket = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    loadMessages(ticket.id);
    setView('detail');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCategoryIcon = (category: string) => {
    return CATEGORY_OPTIONS.find(c => c.value === category)?.icon || 'ri-question-line';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-40">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view !== 'list' && (
              <button
                onClick={() => {
                  setView('list');
                  setSelectedTicket(null);
                }}
                className="p-2 -ml-2 text-gray-600 hover:text-gray-900"
              >
                <i className="ri-arrow-left-line text-xl"></i>
              </button>
            )}
            <h1 className="text-xl font-semibold text-gray-900">
              {view === 'list' ? 'Support' : view === 'create' ? 'New Ticket' : 'Ticket Details'}
            </h1>
          </div>
          {view === 'list' && (
            <button
              onClick={() => setView('create')}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
            >
              <i className="ri-add-line"></i>
              New Ticket
            </button>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {view === 'list' && (
          <>
            {tickets.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                  <i className="ri-customer-service-2-line text-3xl text-gray-400"></i>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Support Tickets</h3>
                <p className="text-gray-500 mb-6">
                  Need help? Create a support ticket and our team will assist you.
                </p>
                <button
                  onClick={() => setView('create')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
                >
                  <i className="ri-add-line"></i>
                  Create Ticket
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => handleViewTicket(ticket)}
                    className="w-full bg-white rounded-xl p-4 border border-gray-100 hover:border-green-200 hover:shadow-sm transition-all text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <i className={`${getCategoryIcon(ticket.category)} text-gray-600`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900 truncate">{ticket.subject}</h3>
                        </div>
                        <p className="text-sm text-gray-500 line-clamp-1 mb-2">{ticket.message}</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CONFIG[ticket.status].color}`}>
                            {STATUS_CONFIG[ticket.status].label}
                          </span>
                          <span className="text-xs text-gray-400">{formatDate(ticket.created_at)}</span>
                        </div>
                      </div>
                      <i className="ri-arrow-right-s-line text-gray-400"></i>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {view === 'create' && (
          <form onSubmit={handleCreateTicket} className="space-y-6">
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORY_OPTIONS.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setNewTicket({ ...newTicket, category: cat.value as any })}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                      newTicket.category === cat.value
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <i className={cat.icon}></i>
                    <span className="text-sm">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
              <input
                type="text"
                value={newTicket.subject}
                onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                placeholder="Brief description of your issue"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
              <textarea
                value={newTicket.message}
                onChange={(e) => setNewTicket({ ...newTicket, message: e.target.value })}
                placeholder="Please describe your issue in detail..."
                rows={5}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                required
              />
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map((p) => {
                  const isSelected = newTicket.priority === p;
                  const colorClass = p === 'high' ? 'border-red-500 bg-red-50 text-red-700' :
                    p === 'medium' ? 'border-amber-500 bg-amber-50 text-amber-700' :
                    'border-green-500 bg-green-50 text-green-700';
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewTicket({ ...newTicket, priority: p })}
                      className={`flex-1 py-2 px-3 rounded-lg border text-sm capitalize transition-colors ${
                        isSelected ? colorClass : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <i className="ri-send-plane-line"></i>
                  Submit Ticket
                </>
              )}
            </button>
          </form>
        )}

        {view === 'detail' && selectedTicket && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className={`${getCategoryIcon(selectedTicket.category)} text-gray-600`}></i>
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold text-gray-900">{selectedTicket.subject}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CONFIG[selectedTicket.status].color}`}>
                      {STATUS_CONFIG[selectedTicket.status].label}
                    </span>
                    <span className="text-xs text-gray-400 capitalize">{selectedTicket.priority} priority</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600">{selectedTicket.message}</p>
              <p className="text-xs text-gray-400 mt-3">Created {formatDate(selectedTicket.created_at)}</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="font-medium text-gray-900">Conversation</h3>
              </div>
              
              {messagesLoading ? (
                <div className="p-8 flex justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-green-500"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <i className="ri-chat-3-line text-2xl mb-2 block"></i>
                  <p className="text-sm">No messages yet. Our support team will respond soon.</p>
                </div>
              ) : (
                <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.is_from_user ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                          msg.is_from_user
                            ? 'bg-green-500 text-white rounded-br-md'
                            : 'bg-gray-100 text-gray-900 rounded-bl-md'
                        }`}
                      >
                        <p className="text-sm">{msg.message}</p>
                        <p className={`text-xs mt-1 ${msg.is_from_user ? 'text-green-100' : 'text-gray-400'}`}>
                          {formatDate(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved' && (
                <div className="p-4 border-t border-gray-100">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Type your reply..."
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply();
                        }
                      }}
                    />
                    <button
                      onClick={handleSendReply}
                      disabled={sendingReply || !replyMessage.trim()}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sendingReply ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                      ) : (
                        <i className="ri-send-plane-fill"></i>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
}
