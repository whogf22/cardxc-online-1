import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../../lib/api';
import { useToastContext } from '../../../contexts/ToastContext';

type EntityType = 'users' | 'orders' | 'webhook_logs' | 'ledger' | 'withdrawals';
type DataGroup = 'user' | 'admin';

const ENTITIES: { id: EntityType; label: string; subtitle: string; group: DataGroup }[] = [
  { id: 'users', label: 'Users', subtitle: 'User accounts', group: 'user' },
  { id: 'orders', label: 'Card Orders', subtitle: 'Payment card orders', group: 'user' },
  { id: 'webhook_logs', label: 'Webhook Logs', subtitle: 'Payment webhook events', group: 'admin' },
  { id: 'ledger', label: 'Ledger', subtitle: 'Audit trail', group: 'admin' },
  { id: 'withdrawals', label: 'Withdrawals', subtitle: 'Withdrawal requests', group: 'admin' },
];

const USER_ENTITIES = ENTITIES.filter((e) => e.group === 'user');
const ADMIN_ENTITIES = ENTITIES.filter((e) => e.group === 'admin');

const PAGE_SIZE = 20;

export default function DataExplorerTab() {
  const [entity, setEntity] = useState<EntityType>('users');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; reason: string } | null>(null);
  const toast = useToastContext();

  const loadUsers = useCallback(async () => {
    const res = await adminApi.getUsers({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
    if (res.success && res.data?.users) {
      setRows(res.data.users);
      setTotal(res.data.users.length < PAGE_SIZE ? (page - 1) * PAGE_SIZE + res.data.users.length : page * PAGE_SIZE + 1);
    } else {
      setRows([]);
      setTotal(0);
    }
  }, [page]);

  const loadOrders = useCallback(async () => {
    const res = await adminApi.getCardOrders({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
    if (res.success && res.data) {
      setRows(res.data.orders || []);
      setTotal(res.data.total ?? 0);
    } else {
      setRows([]);
      setTotal(0);
    }
  }, [page]);

  const loadWebhookLogs = useCallback(async () => {
    const res = await adminApi.getWebhookLogs({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
    if (res.success && res.data) {
      setRows(res.data.logs || []);
      setTotal(res.data.total ?? 0);
    } else {
      setRows([]);
      setTotal(0);
    }
  }, [page]);

  const loadLedger = useCallback(async () => {
    const res = await adminApi.getLedger(500);
    if (res.success && res.data?.entries) {
      const all = res.data.entries;
      const start = (page - 1) * PAGE_SIZE;
      setRows(all.slice(start, start + PAGE_SIZE));
      setTotal(all.length);
    } else {
      setRows([]);
      setTotal(0);
    }
  }, [page]);

  const loadWithdrawals = useCallback(async () => {
    const res = await adminApi.getWithdrawals();
    if (res.success && res.data?.withdrawals) {
      const all = res.data.withdrawals;
      const start = (page - 1) * PAGE_SIZE;
      setRows(all.slice(start, start + PAGE_SIZE));
      setTotal(all.length);
    } else {
      setRows([]);
      setTotal(0);
    }
  }, [page]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      switch (entity) {
        case 'users':
          await loadUsers();
          break;
        case 'orders':
          await loadOrders();
          break;
        case 'webhook_logs':
          await loadWebhookLogs();
          break;
        case 'ledger':
          await loadLedger();
          break;
        case 'withdrawals':
          await loadWithdrawals();
          break;
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load data');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [entity, page, loadUsers, loadOrders, loadWebhookLogs, loadLedger, loadWithdrawals]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [entity]);

  const handleApproveWithdrawal = async (id: string) => {
    try {
      setProcessingId(id);
      await adminApi.approveWithdrawal(id);
      toast.success('Withdrawal approved');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to approve');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectWithdrawal = async () => {
    if (!rejectModal?.id || !rejectModal.reason.trim()) return;
    try {
      setProcessingId(rejectModal.id);
      await adminApi.rejectWithdrawal(rejectModal.id, rejectModal.reason);
      toast.success('Withdrawal rejected');
      setRejectModal(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to reject');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReplayWebhook = async (id: string) => {
    try {
      setProcessingId(id);
      const res = await adminApi.replayWebhook(id) as { message?: string; data?: { message?: string } };
      toast.success(res?.message || res?.data?.message || 'Replay requested');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Replay failed');
    } finally {
      setProcessingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const formatDate = (v: any) => (v ? new Date(v).toLocaleString() : '—');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Data Explorer</h2>
          <p className="text-slate-400 mt-1">View-only inspection; safe actions (Replay, Approve/Reject) only where shown.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-400">Entity:</label>
          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value as EntityType)}
            className="bg-slate-800 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
          >
            <optgroup label="User data">
              {USER_ENTITIES.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </optgroup>
            <optgroup label="Admin / System data">
              {ADMIN_ENTITIES.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </optgroup>
          </select>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 disabled:opacity-50"
          >
            <i className={`ri-refresh-line ${loading ? 'animate-spin' : ''}`}></i>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 animate-pulse">
          <div className="h-10 bg-slate-700 rounded-xl mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-700/50 rounded-xl"></div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            {entity === 'users' && (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800 text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300 divide-y divide-slate-700/50">
                  {rows.map((r: any) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3">{r.email ?? '—'}</td>
                      <td className="px-4 py-3">{r.full_name ?? '—'}</td>
                      <td className="px-4 py-3">{r.role ?? '—'}</td>
                      <td className="px-4 py-3">{formatDate(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {entity === 'orders' && (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800 text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300 divide-y divide-slate-700/50">
                  {rows.map((r: any) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-mono text-xs">{r.id?.slice(0, 8)}…</td>
                      <td className="px-4 py-3">{r.user_email ?? r.user_name ?? '—'}</td>
                      <td className="px-4 py-3">{r.amount != null ? `${r.amount} ${r.currency || ''}` : '—'}</td>
                      <td className="px-4 py-3">{r.status ?? '—'}</td>
                      <td className="px-4 py-3">{formatDate(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {entity === 'webhook_logs' && (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800 text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">Processed</th>
                    <th className="px-4 py-3">Error</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300 divide-y divide-slate-700/50">
                  {rows.map((r: any) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-mono text-xs">{r.id?.slice(0, 8)}…</td>
                      <td className="px-4 py-3">{r.event_type ?? '—'}</td>
                      <td className="px-4 py-3">{r.processed ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-3 max-w-[200px] truncate" title={r.error_message}>{r.error_message || '—'}</td>
                      <td className="px-4 py-3">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-3">
                        {!r.processed && (
                          <button
                            onClick={() => handleReplayWebhook(r.id)}
                            disabled={processingId === r.id}
                            className="text-emerald-400 hover:text-emerald-300 text-xs font-medium disabled:opacity-50"
                          >
                            {processingId === r.id ? 'Replaying…' : 'Replay'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {entity === 'ledger' && (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800 text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300 divide-y divide-slate-700/50">
                  {rows.map((r: any) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-mono text-xs">{r.id?.slice(0, 8)}…</td>
                      <td className="px-4 py-3">{r.action ?? '—'}</td>
                      <td className="px-4 py-3">{r.entity_type ?? '—'}</td>
                      <td className="px-4 py-3">{formatDate(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {entity === 'withdrawals' && (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800 text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300 divide-y divide-slate-700/50">
                  {rows.map((r: any) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-mono text-xs">{r.id?.slice(0, 8)}…</td>
                      <td className="px-4 py-3">{r.user_email ?? r.user_name ?? '—'}</td>
                      <td className="px-4 py-3">{r.amount != null ? `${r.amount} ${r.currency || ''}` : (r.amount_cents != null ? `${(r.amount_cents / 100).toFixed(2)} ${r.currency || ''}` : '—')}</td>
                      <td className="px-4 py-3">{r.status ?? '—'}</td>
                      <td className="px-4 py-3">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-3 flex gap-2">
                        {r.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApproveWithdrawal(r.id)}
                              disabled={processingId === r.id}
                              className="text-emerald-400 hover:text-emerald-300 text-xs font-medium disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setRejectModal({ id: r.id, reason: '' })}
                              disabled={processingId === r.id}
                              className="text-red-400 hover:text-red-300 text-xs font-medium disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-t border-slate-700/50">
              <span className="text-slate-400 text-sm">
                Page {page} of {totalPages} ({total} total)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm disabled:opacity-50 text-slate-300"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm disabled:opacity-50 text-slate-300"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Reject withdrawal</h3>
            <p className="text-slate-400 text-sm mb-4">Reason (required):</p>
            <input
              type="text"
              value={rejectModal.reason}
              onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
              placeholder="Reason for rejection"
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500/50"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectWithdrawal}
                disabled={!rejectModal.reason.trim()}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
