import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../../lib/apiClient';
import { useToastContext } from '../../../contexts/ToastContext';

interface Withdrawal {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  amount: number;
  amount_cents: number;
  currency: string;
  status: string;
  bank_name?: string;
  account_number?: string;
  account_name?: string;
  created_at: string;
  admin_notes?: string;
}

export default function WithdrawalsTab() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const toast = useToastContext();

  const loadWithdrawals = useCallback(async () => {
    try {
      setLoading(true);

      const response = await apiClient.get(`/admin/withdrawals?status=${statusFilter}`);
      
      if (response.success) {
        setWithdrawals(response.data?.withdrawals || []);
      }
    } catch (err: any) {
      console.error('[WithdrawalsTab] Error loading withdrawals:', err);
      toast.error(err.message || 'Failed to load withdrawals');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    loadWithdrawals();
  }, [loadWithdrawals]);

  const handleApprove = async (withdrawalId: string) => {
    try {
      setProcessing(withdrawalId);
      
      await apiClient.post(`/admin/withdrawals/${withdrawalId}/approve`);
      
      toast.success('Withdrawal approved successfully');
      loadWithdrawals();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve withdrawal');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!showRejectModal || !rejectReason.trim()) return;

    try {
      setProcessing(showRejectModal);
      
      await apiClient.post(`/admin/withdrawals/${showRejectModal}/reject`, {
        reason: rejectReason,
      });
      
      toast.success('Withdrawal rejected');
      setShowRejectModal(null);
      setRejectReason('');
      loadWithdrawals();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject withdrawal');
    } finally {
      setProcessing(null);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  if (loading && withdrawals.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 animate-pulse">
          <div className="h-10 bg-slate-700 rounded-xl mb-6"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-slate-700/50 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Withdrawal Requests</h2>
          <p className="text-slate-400 mt-1">Review and process withdrawal requests</p>
        </div>
        <button 
          onClick={loadWithdrawals}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all duration-200 font-medium border border-slate-700 hover:border-slate-600"
        >
          <i className={`ri-refresh-line ${loading ? 'animate-spin' : ''}`}></i>
          Refresh
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['pending', 'approved', 'rejected'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2.5 rounded-xl font-medium transition-all duration-200 cursor-pointer ${
              statusFilter === status
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status === 'pending' && withdrawals.length > 0 && statusFilter === 'pending' && (
              <span className="ml-2 px-2 py-0.5 bg-amber-500/30 text-amber-300 text-xs rounded-full font-semibold">
                {withdrawals.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
        {withdrawals.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-exchange-funds-line text-3xl text-slate-500"></i>
            </div>
            <p className="text-slate-400 font-medium">No {statusFilter} withdrawals</p>
            <p className="text-slate-500 text-sm mt-1">All clear for now</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {withdrawals.map((withdrawal, index) => (
              <div 
                key={withdrawal.id} 
                className={`p-6 hover:bg-slate-700/20 transition-colors ${
                  index % 2 === 0 ? 'bg-slate-800/20' : 'bg-transparent'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/20">
                      <i className="ri-arrow-up-line text-white text-xl"></i>
                    </div>
                    <div>
                      <p className="text-white font-semibold">{withdrawal.user_name || withdrawal.user_email}</p>
                      <p className="text-sm text-slate-400">{withdrawal.user_email}</p>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-slate-500">
                          <i className="ri-bank-line mr-1"></i>
                          {withdrawal.bank_name || 'N/A'}
                        </p>
                        <p className="text-sm text-slate-500 font-mono">
                          <i className="ri-hashtag mr-1"></i>
                          {withdrawal.account_number || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col lg:items-end gap-3">
                    <p className="text-2xl font-bold text-white">
                      {formatCurrency(withdrawal.amount || withdrawal.amount_cents / 100, withdrawal.currency)}
                    </p>
                    <p className="text-sm text-slate-400">
                      {new Date(withdrawal.created_at).toLocaleString()}
                    </p>
                    
                    {statusFilter === 'pending' && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleApprove(withdrawal.id)}
                          disabled={processing === withdrawal.id}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-all duration-200 flex items-center gap-2 disabled:opacity-50 font-medium shadow-lg shadow-emerald-500/25 cursor-pointer"
                        >
                          {processing === withdrawal.id ? (
                            <i className="ri-loader-4-line animate-spin"></i>
                          ) : (
                            <i className="ri-check-line"></i>
                          )}
                          Approve
                        </button>
                        <button
                          onClick={() => setShowRejectModal(withdrawal.id)}
                          disabled={processing === withdrawal.id}
                          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-all duration-200 flex items-center gap-2 disabled:opacity-50 font-medium border border-red-500/30 cursor-pointer"
                        >
                          <i className="ri-close-line"></i>
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700 shadow-2xl animate-fadeIn">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                <i className="ri-close-circle-line text-red-400 text-xl"></i>
              </div>
              <h3 className="text-xl font-bold text-white">Reject Withdrawal</h3>
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 h-32 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowRejectModal(null); setRejectReason(''); }}
                className="flex-1 px-4 py-3 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 transition-all font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || processing !== null}
                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all disabled:opacity-50 font-bold cursor-pointer"
              >
                {processing ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
