import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../../../lib/apiClient';
import { useToastContext } from '../../../contexts/ToastContext';
import { useAuthContext } from '../../../contexts/AuthContext';
import { checkoutApi } from '../../../lib/api';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

interface RecentAdjustment {
  id: string;
  user_id: string;
  type: string;
  amount_cents: number;
  currency: string;
  reason: string;
  status: string;
  requested_by: string;
  approved_by?: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

type AdjustmentType = 'credit' | 'debit' | 'card_deposit';

export default function DepositForUserTab() {
  const toast = useToastContext();
  const { user: currentAdmin } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userBalance, setUserBalance] = useState<number>(0);
  
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('credit');
  
  const [adjustments, setAdjustments] = useState<RecentAdjustment[]>([]);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [checkoutAmount, setCheckoutAmount] = useState<number>(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const isSuperAdmin = currentAdmin?.role === 'SUPER_ADMIN';

  const loadUsers = useCallback(async () => {
    try {
      const response = await apiClient.get('/admin/users?limit=100');
      if (response.success) {
        setUsers(response.data?.users || []);
      }
    } catch (err) {
      console.error('[DepositForUserTab] Error loading users:', err);
    }
  }, []);

  const loadAdjustments = useCallback(async () => {
    try {
      const response = await apiClient.get('/admin/adjustments?status=APPROVED');
      if (response.success) {
        setAdjustments(response.data?.adjustments || []);
      }
    } catch (err) {
      console.error('[DepositForUserTab] Error loading adjustments:', err);
    }
  }, []);

  const loadUserBalance = useCallback(async (userId: string) => {
    try {
      const response = await apiClient.get(`/admin/users/${userId}/balance`);
      if (response.success) {
        setUserBalance(response.data?.balance || 0);
      }
    } catch (err) {
      console.error('[DepositForUserTab] Error loading balance:', err);
      setUserBalance(0);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadUsers(), loadAdjustments()]);
      setLoading(false);
    };
    init();
  }, [loadUsers, loadAdjustments]);

  useEffect(() => {
    if (selectedUser) {
      loadUserBalance(selectedUser.id);
    } else {
      setUserBalance(0);
    }
  }, [selectedUser, loadUserBalance]);

  const handleSelectUser = (user: UserProfile) => {
    setSelectedUser(user);
    setShowUserSearch(false);
    setSearchTerm('');
  };

  const handleCardDeposit = async () => {
    if (!selectedUser) {
      toast.error('Please select a user');
      return;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue < 100) {
      toast.error('Minimum card deposit is $100');
      return;
    }
    if (amountValue > 2500) {
      toast.error('Maximum card deposit is $2,500');
      return;
    }

    if (!reason.trim() || reason.trim().length < 10) {
      toast.error('Please enter a reason (at least 10 characters)');
      return;
    }

    try {
      setSubmitting(true);

      const response = await checkoutApi.createCardCheckout({
        amount: amountValue,
        currency: 'USD',
        merchantName: 'Admin Deposit',
        targetUserId: selectedUser.id,
      });

      if (response.success && response.data?.checkoutUrl) {
        toast.success(`Opening payment page for ${selectedUser.email}`);
        setCheckoutAmount(amountValue);
        setCheckoutUrl(response.data.checkoutUrl);
      } else {
        throw new Error(response.error?.message || 'Failed to create checkout session');
      }
    } catch (err: any) {
      console.error('[DepositForUserTab] Card deposit error:', err);
      toast.error(err.message || 'Failed to initiate card deposit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAdjustment = async () => {
    if (!selectedUser) {
      toast.error('Please select a user');
      return;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      toast.error('Please enter a valid amount greater than 0');
      return;
    }

    if (amountValue > 100000) {
      toast.error('Single adjustment cannot exceed $100,000');
      return;
    }

    if (!reason.trim() || reason.trim().length < 10) {
      toast.error('Please enter a reason (at least 10 characters)');
      return;
    }

    if (adjustmentType === 'card_deposit') {
      await handleCardDeposit();
      return;
    }

    try {
      setSubmitting(true);

      const response = await apiClient.post('/admin/adjustments', {
        userId: selectedUser.id,
        type: adjustmentType,
        amount: amountValue,
        currency: 'USD',
        reason: reason.trim(),
      });

      if (response.success) {
        const status = response.data?.status;
        if (status === 'SUCCESS') {
          toast.success(`Adjustment applied: ${adjustmentType === 'credit' ? '+' : '-'}$${amountValue.toFixed(2)} to ${selectedUser.email}`);
        } else {
          toast.success(`Adjustment request created. Pending SUPER_ADMIN approval.`);
        }

        setAmount('');
        setReason('');
        setSelectedUser(null);
        await loadAdjustments();
      }
    } catch (err: any) {
      console.error('[DepositForUserTab] Error creating adjustment:', err);
      toast.error(err.message || 'Failed to create adjustment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <i className="ri-coin-line text-2xl text-emerald-400"></i>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Balance Adjustments</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              {isSuperAdmin 
                ? 'Credit, debit, or process card deposits directly to user accounts. All adjustments are logged for audit.'
                : 'Request balance adjustments. Requires SUPER_ADMIN approval.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <i className="ri-user-add-line text-emerald-400"></i>
            Create Adjustment
          </h3>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Select User</label>
              <div className="relative">
                {selectedUser ? (
                  <div className="flex items-center justify-between bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {selectedUser.full_name?.charAt(0).toUpperCase() || selectedUser.email?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-medium">{selectedUser.email}</p>
                        <p className="text-sm text-slate-400">{selectedUser.full_name || 'No name'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="p-2 hover:bg-slate-700 rounded-lg cursor-pointer transition-colors"
                    >
                      <i className="ri-close-line text-slate-400"></i>
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setShowUserSearch(true);
                      }}
                      onFocus={() => setShowUserSearch(true)}
                      placeholder="Search by email or name..."
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                    {showUserSearch && searchTerm && (
                      <div className="absolute z-10 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-auto">
                        {filteredUsers.length === 0 ? (
                          <div className="p-4 text-slate-400 text-sm text-center">No users found</div>
                        ) : (
                          filteredUsers.slice(0, 10).map(user => (
                            <button
                              key={user.id}
                              onClick={() => handleSelectUser(user)}
                              className="w-full text-left p-3 hover:bg-slate-700/50 transition-colors cursor-pointer border-b border-slate-700/50 last:border-0"
                            >
                              <p className="text-white font-medium">{user.email}</p>
                              <p className="text-sm text-slate-400">{user.full_name || 'No name'}</p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {selectedUser && (
              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                <p className="text-sm text-slate-400 mb-1">Current Balance</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(userBalance)}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Adjustment Type</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setAdjustmentType('credit')}
                  className={`py-3 rounded-xl font-medium transition-all cursor-pointer ${
                    adjustmentType === 'credit'
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                      : 'bg-slate-900/50 text-slate-400 hover:text-white border border-slate-700'
                  }`}
                >
                  <i className="ri-add-line mr-1"></i> Credit
                </button>
                <button
                  onClick={() => setAdjustmentType('debit')}
                  className={`py-3 rounded-xl font-medium transition-all cursor-pointer ${
                    adjustmentType === 'debit'
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                      : 'bg-slate-900/50 text-slate-400 hover:text-white border border-slate-700'
                  }`}
                >
                  <i className="ri-subtract-line mr-1"></i> Debit
                </button>
                <button
                  onClick={() => setAdjustmentType('card_deposit')}
                  className={`py-3 rounded-xl font-medium transition-all cursor-pointer ${
                    adjustmentType === 'card_deposit'
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                      : 'bg-slate-900/50 text-slate-400 hover:text-white border border-slate-700'
                  }`}
                  title="Process card payment for user"
                >
                  <i className="ri-bank-card-line mr-1"></i> Card
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min={adjustmentType === 'card_deposit' ? '100' : '0.01'}
                  max={adjustmentType === 'card_deposit' ? '2500' : '100000'}
                  step="0.01"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-8 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              {adjustmentType === 'card_deposit' && (
                <p className="text-slate-400 text-xs mt-2">Card deposit range: $100 - $2,500</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Reason (Required)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain the reason for this adjustment (min 10 characters)..."
                rows={3}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
              />
            </div>

            <button
              onClick={handleSubmitAdjustment}
              disabled={!selectedUser || !amount || !reason.trim() || submitting}
              className={`w-full py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                !selectedUser || !amount || !reason.trim() || submitting
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : adjustmentType === 'credit'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                    : adjustmentType === 'debit'
                      ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25'
                      : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/25'
              }`}
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : adjustmentType === 'card_deposit' ? (
                <>
                  <i className="ri-bank-card-line"></i>
                  Process Card Deposit
                </>
              ) : (
                <>
                  <i className={adjustmentType === 'credit' ? 'ri-add-circle-line' : 'ri-subtract-line'}></i>
                  {isSuperAdmin ? 'Apply Adjustment' : 'Request Adjustment'}
                </>
              )}
            </button>

            {!isSuperAdmin && adjustmentType !== 'card_deposit' && (
              <p className="text-xs text-slate-400 text-center">
                Adjustments require SUPER_ADMIN approval before being applied.
              </p>
            )}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <i className="ri-history-line text-blue-400"></i>
              Recent Adjustments
            </h3>
            <button
              onClick={loadAdjustments}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer"
            >
              <i className="ri-refresh-line"></i>
            </button>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-auto">
            {adjustments.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="ri-inbox-line text-3xl text-slate-500"></i>
                </div>
                <p className="font-medium">No adjustments found</p>
              </div>
            ) : (
              adjustments.map(adjustment => (
                <div
                  key={adjustment.id}
                  className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50 hover:border-slate-600/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          adjustment.type === 'credit' 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : adjustment.type === 'debit'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}>
                          {adjustment.type.toUpperCase()}
                        </span>
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          adjustment.status === 'APPROVED' || adjustment.status === 'SUCCESS'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : adjustment.status === 'PENDING'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {adjustment.status}
                        </span>
                      </div>
                      <p className="text-white font-medium truncate">
                        {adjustment.user_email || 'Unknown user'}
                      </p>
                      <p className="text-slate-400 text-sm truncate">{adjustment.reason}</p>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className={`font-bold text-lg ${
                        adjustment.type === 'credit' || adjustment.type === 'card_deposit'
                          ? 'text-emerald-400'
                          : 'text-red-400'
                      }`}>
                        {adjustment.type === 'debit' ? '-' : '+'}{formatCurrency(adjustment.amount_cents)}
                      </p>
                      <p className="text-xs text-slate-500">{formatDate(adjustment.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {checkoutUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <i className="ri-bank-card-line text-emerald-400 text-xl"></i>
                </div>
                <div>
                  <h3 className="font-bold text-white">Card Deposit - {selectedUser?.email}</h3>
                  <p className="text-sm text-slate-400">${checkoutAmount.toFixed(2)} • Complete payment below</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setCheckoutUrl(null);
                  if (selectedUser) loadUserBalance(selectedUser.id);
                  loadAdjustments();
                }}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>
            <div className="flex-1 min-h-[400px] bg-slate-900">
              <iframe
                ref={iframeRef}
                src={checkoutUrl}
                className="w-full h-full min-h-[400px] border-0"
                title="Secure Checkout"
                allow="payment"
                sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-top-navigation"
              />
            </div>
            <div className="p-3 border-t border-slate-700 flex items-center justify-between">
              <p className="text-xs text-slate-500 flex items-center gap-2">
                <i className="ri-lock-line text-emerald-500"></i>
                Payment processed securely. Stay on this page to complete.
              </p>
              <button
                onClick={() => {
                  setCheckoutUrl(null);
                  if (selectedUser) loadUserBalance(selectedUser.id);
                  loadAdjustments();
                }}
                className="text-sm text-slate-400 hover:text-white underline cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
