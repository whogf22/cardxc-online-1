import { useState, useEffect } from 'react';
import { adminApi } from '../../../lib/api';
import { gateway } from '../../../lib/gateway';

interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  bank_name?: string;
  account_number?: string;
  account_name?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed';
  admin_notes?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
  user_balance?: number;
}

interface ConfirmationModal {
  show: boolean;
  type: 'approve' | 'reject' | null;
  withdrawal: WithdrawalRequest | null;
}

export default function WithdrawalsTab() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [filteredWithdrawals, setFilteredWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [processing, setProcessing] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmationModal>({
    show: false,
    type: null,
    withdrawal: null,
  });
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    loadWithdrawals();
  }, []);

  useEffect(() => {
    filterWithdrawals();
  }, [withdrawals, statusFilter]);

  const loadWithdrawals = async () => {
    try {
      setLoading(true);
      setError('');

      const [withdrawalsResult, usersResult] = await Promise.all([
        adminApi.getWithdrawals(),
        adminApi.getUsers()
      ]);

      if (!withdrawalsResult.success) {
        throw new Error(withdrawalsResult.error?.message || 'Failed to load withdrawals');
      }

      const withdrawalData = withdrawalsResult.data?.withdrawals || [];
      const profiles = usersResult.data?.users || [];

      const enrichedWithdrawals = withdrawalData.map((withdrawal: any) => {
        const profile = profiles.find((p: any) => p.id === withdrawal.user_id);
        return {
          ...withdrawal,
          user_email: profile?.email,
          user_name: profile?.full_name,
          user_balance: profile?.balance || 0,
        };
      });

      setWithdrawals(enrichedWithdrawals);
    } catch (err: any) {
      console.error('Error loading withdrawals:', err);
      setError(err.message || 'Failed to load withdrawal requests');
    } finally {
      setLoading(false);
    }
  };

  const filterWithdrawals = () => {
    let filtered = [...withdrawals];

    if (statusFilter !== 'all') {
      filtered = filtered.filter((w) => w.status === statusFilter);
    }

    setFilteredWithdrawals(filtered);
  };

  const getRiskLevel = (withdrawal: WithdrawalRequest): { level: string; color: string } => {
    const amount = parseFloat(withdrawal.amount.toString());
    const balance = parseFloat(withdrawal.user_balance?.toString() || '0');

    if (amount > balance) {
      return { level: 'CRITICAL', color: 'bg-red-100 text-red-700 border-red-300' };
    }

    if (amount > 10000) {
      return { level: 'HIGH', color: 'bg-orange-100 text-orange-700 border-orange-300' };
    }

    if (amount > 5000) {
      return { level: 'MEDIUM', color: 'bg-amber-100 text-amber-700 border-amber-300' };
    }

    return { level: 'LOW', color: 'bg-green-100 text-green-700 border-green-300' };
  };

  const openConfirmModal = (type: 'approve' | 'reject', withdrawal: WithdrawalRequest) => {
    setConfirmModal({ show: true, type, withdrawal });
    setAdminNotes('');
  };

  const closeConfirmModal = () => {
    setConfirmModal({ show: false, type: null, withdrawal: null });
    setAdminNotes('');
  };

  const handleApprove = async () => {
    if (!confirmModal.withdrawal) return;

    try {
      setProcessing(confirmModal.withdrawal.id);
      setError('');

      const result = await gateway.approveWithdrawal(
        confirmModal.withdrawal.id,
        adminNotes || 'Approved by admin'
      );

      if (result.error) {
        throw new Error(result.error);
      }

      await loadWithdrawals();
      closeConfirmModal();
    } catch (err: any) {
      console.error('Error approving withdrawal:', err);
      setError(err.message || 'Failed to approve withdrawal');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!confirmModal.withdrawal) return;

    if (!adminNotes.trim()) {
      setError('Rejection reason is required');
      return;
    }

    try {
      setProcessing(confirmModal.withdrawal.id);
      setError('');

      const result = await gateway.rejectWithdrawal(confirmModal.withdrawal.id, adminNotes);

      if (result.error) {
        throw new Error(result.error);
      }

      await loadWithdrawals();
      closeConfirmModal();
    } catch (err: any) {
      console.error('Error rejecting withdrawal:', err);
      setError(err.message || 'Failed to reject withdrawal');
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-amber-100 text-amber-700 border-amber-200',
      approved: 'bg-green-100 text-green-700 border-green-200',
      rejected: 'bg-red-100 text-red-700 border-red-200',
      completed: 'bg-blue-100 text-blue-700 border-blue-200',
      failed: 'bg-red-100 text-red-700 border-red-200',
    };
    return styles[status as keyof typeof styles] || styles.pending;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6 animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-48 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-slate-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Critical Security Banner */}
      <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <i className="ri-shield-check-line text-red-600 text-2xl mt-0.5"></i>
          <div className="flex-1">
            <h3 className="text-red-900 font-bold text-sm">CRITICAL: Withdrawal Approval System</h3>
            <p className="text-red-700 text-sm mt-1">
              All withdrawal approvals are processed via API Gateway with server-side validation.
              Balance checks, cooldown enforcement, and fraud detection are performed server-side.
              All actions are logged for audit compliance. NO direct database modifications allowed.
            </p>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <i className="ri-error-warning-line text-red-600 text-xl"></i>
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={() => setError('')}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-600 mb-1">Total Requests</p>
          <p className="text-2xl font-bold text-slate-900">{withdrawals.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-600 mb-1">Pending</p>
          <p className="text-2xl font-bold text-amber-600">
            {withdrawals.filter((w) => w.status === 'pending').length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-600 mb-1">Approved</p>
          <p className="text-2xl font-bold text-green-600">
            {withdrawals.filter((w) => w.status === 'approved').length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-600 mb-1">Rejected</p>
          <p className="text-2xl font-bold text-red-600">
            {withdrawals.filter((w) => w.status === 'rejected').length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-600 mb-1">Completed</p>
          <p className="text-2xl font-bold text-blue-600">
            {withdrawals.filter((w) => w.status === 'completed').length}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Filter by Status
        </label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full md:w-64 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending (Action Required)</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Withdrawals List */}
      <div className="space-y-4">
        {filteredWithdrawals.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <i className="ri-bank-card-line text-slate-300 text-5xl mb-4"></i>
            <p className="text-slate-500 text-lg">No withdrawal requests found</p>
          </div>
        ) : (
          filteredWithdrawals.map((withdrawal) => {
            const risk = getRiskLevel(withdrawal);
            const isProcessing = processing === withdrawal.id;

            return (
              <div
                key={withdrawal.id}
                className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-lg font-semibold">
                        {withdrawal.user_email?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {withdrawal.user_name || 'N/A'}
                      </h3>
                      <p className="text-sm text-slate-600">{withdrawal.user_email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 text-xs font-bold rounded-full border ${risk.color}`}>
                      RISK: {risk.level}
                    </span>
                    <span
                      className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusBadge(
                        withdrawal.status
                      )}`}
                    >
                      {withdrawal.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Withdrawal Amount</p>
                    <p className="text-xl font-bold text-slate-900">
                      {withdrawal.currency} {parseFloat(withdrawal.amount.toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Current Balance</p>
                    <p className="text-xl font-bold text-green-600">
                      {withdrawal.currency} {parseFloat(withdrawal.user_balance?.toString() || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Bank Name</p>
                    <p className="text-sm font-medium text-slate-900">
                      {withdrawal.bank_name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Account Number</p>
                    <p className="text-sm font-mono text-slate-900">
                      {withdrawal.account_number || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Account Name</p>
                    <p className="text-sm font-medium text-slate-900">
                      {withdrawal.account_name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Request Date</p>
                    <p className="text-sm text-slate-900">
                      {new Date(withdrawal.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {withdrawal.admin_notes && (
                  <div className="bg-slate-50 rounded-lg p-3 mb-4">
                    <p className="text-xs text-slate-500 mb-1">Admin Notes</p>
                    <p className="text-sm text-slate-900">{withdrawal.admin_notes}</p>
                  </div>
                )}

                {parseFloat(withdrawal.amount.toString()) > parseFloat(withdrawal.user_balance?.toString() || '0') && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2">
                      <i className="ri-error-warning-line text-red-600"></i>
                      <p className="text-sm text-red-700 font-semibold">
                        INSUFFICIENT BALANCE - Cannot approve this withdrawal
                      </p>
                    </div>
                  </div>
                )}

                {withdrawal.status === 'pending' && (
                  <div className="flex gap-3 pt-4 border-t border-slate-200">
                    <button
                      onClick={() => openConfirmModal('approve', withdrawal)}
                      disabled={isProcessing || parseFloat(withdrawal.amount.toString()) > parseFloat(withdrawal.user_balance?.toString() || '0')}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? (
                        <>
                          <i className="ri-loader-4-line animate-spin"></i>
                          Processing...
                        </>
                      ) : (
                        <>
                          <i className="ri-checkbox-circle-line"></i>
                          Approve Withdrawal
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => openConfirmModal('reject', withdrawal)}
                      disabled={isProcessing}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <i className="ri-close-circle-line"></i>
                      Reject Withdrawal
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal.show && confirmModal.withdrawal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">
              {confirmModal.type === 'approve' ? 'Approve Withdrawal' : 'Reject Withdrawal'}
            </h3>

            <div className="bg-slate-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-slate-600 mb-2">Withdrawal Details:</p>
              <p className="text-lg font-bold text-slate-900">
                {confirmModal.withdrawal.currency}{' '}
                {parseFloat(confirmModal.withdrawal.amount.toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-slate-600 mt-2">
                User: {confirmModal.withdrawal.user_name} ({confirmModal.withdrawal.user_email})
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Admin Notes {confirmModal.type === 'reject' && <span className="text-red-600">*</span>}
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder={
                  confirmModal.type === 'approve'
                    ? 'Optional notes...'
                    : 'Required: Reason for rejection...'
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm"
                rows={3}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-blue-700">
                <i className="ri-information-line"></i> This action will be logged server-side for audit compliance.
                All validations are performed by the backend.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={closeConfirmModal}
                disabled={!!processing}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.type === 'approve' ? handleApprove : handleReject}
                disabled={!!processing}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 ${
                  confirmModal.type === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {processing ? 'Processing...' : `Confirm ${confirmModal.type === 'approve' ? 'Approval' : 'Rejection'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
