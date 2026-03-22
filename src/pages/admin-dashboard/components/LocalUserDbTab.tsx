import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../../lib/api';
import { clearRateCache } from '../../../lib/exchangeRateService';
import { formatDateTime } from '../../../lib/localeUtils';

type TableKey = 'users' | 'sessions' | 'wallets' | 'rate-limits';

export default function LocalUserDbTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [rateLimits, setRateLimits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTable, setActiveTable] = useState<TableKey>('users');
  const [clearing, setClearing] = useState<string | null>(null);

  const handleRefreshRates = () => {
    clearRateCache();
    load();
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dbRes, rateRes] = await Promise.all([
        adminApi.getLocalUserDb(),
        adminApi.getRateLimits()
      ]);

      if (dbRes.success && dbRes.data) {
        setUsers(dbRes.data.users ?? []);
        setSessions(dbRes.data.sessions ?? []);
        setWallets(dbRes.data.wallets ?? []);
      }

      if (rateRes.success && rateRes.data) {
        setRateLimits(rateRes.data.violations ?? []);
      }

      if (!dbRes.success && !rateRes.success) {
        setError('Failed to load data');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load local user DB');
      setUsers([]);
      setSessions([]);
      setWallets([]);
      setRateLimits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleClearRateLimit = async (ip?: string) => {
    try {
      setClearing(ip || 'all');
      await adminApi.clearRateLimits(ip);
      await load();
    } catch (e: any) {
      console.error('Failed to clear rate limit:', e);
    } finally {
      setClearing(null);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  const formatDate = (v: any) => (v ? formatDateTime(v) : '—');
  const formatCents = (cents: number) => (cents != null ? `$${(Number(cents) / 100).toFixed(2)}` : '—');

  const tabs: { id: TableKey; label: string; count: number }[] = [
    { id: 'users', label: 'Users', count: users.length },
    { id: 'sessions', label: 'Sessions', count: sessions.length },
    { id: 'wallets', label: 'Wallets', count: wallets.length },
    { id: 'rate-limits', label: 'Rate Limits', count: rateLimits.length },
  ];

  if (loading && !users.length && !rateLimits.length) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-lime-500/30 border-t-lime-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading local user DB...</p>
        </div>
      </div>
    );
  }

  if (error && !users.length) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
        <p className="text-red-400 font-semibold mb-2">Could not load local user DB</p>
        <p className="text-neutral-400 text-sm mb-4">{error}</p>
        <button
          onClick={load}
          className="px-5 py-2.5 bg-lime-500 text-black font-semibold rounded-xl hover:bg-lime-400 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <i className="ri-database-2-line text-lime-400"></i>
            Local User DB
          </h2>
          <p className="text-neutral-400 mt-1 text-sm">
            Users, sessions, and wallets from the local-user schema (read-only), plus server-side rate limits.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeTable === 'rate-limits' && rateLimits.length > 0 && (
            <button
              onClick={() => handleClearRateLimit()}
              disabled={!!clearing}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 rounded-xl border border-red-500/30 text-red-400 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <i className="ri-delete-bin-line" />
              Clear All Violations
            </button>
          )}
          <button
            onClick={handleRefreshRates}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-lime-500/10 hover:bg-lime-500/20 rounded-xl border border-lime-500/30 text-lime-400 text-sm font-medium transition-colors"
          >
            <i className="ri-exchange-dollar-line" />
            Refresh Market Rates
          </button>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-dark-elevated hover:bg-dark-hover rounded-xl border border-dark-border text-white text-sm font-medium transition-colors"
          >
            <i className="ri-refresh-line" />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-dark-border pb-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTable(tab.id)}
            className={`px-4 py-2.5 rounded-t-xl text-sm font-medium transition-all whitespace-nowrap ${activeTable === tab.id
              ? 'bg-dark-card text-lime-400 border border-dark-border border-b-0 -mb-0.5 shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-dark-elevated'
              }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-dark-border bg-dark-card overflow-hidden shadow-3d-depth">
        <div className="overflow-x-auto">
          {activeTable === 'users' && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-dark-border bg-dark-elevated text-neutral-400">
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">KYC</th>
                  <th className="px-4 py-3 font-medium">2FA</th>
                  <th className="px-4 py-3 font-medium">Referral</th>
                  <th className="px-4 py-3 font-medium">Failed Logins</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((r) => (
                  <tr key={r.id} className="border-b border-dark-border hover:bg-dark-elevated/50 transition-colors">
                    <td className="px-4 py-2 text-white">{r.email ?? '—'}</td>
                    <td className="px-4 py-2 text-neutral-300">{r.full_name ?? '—'}</td>
                    <td className="px-4 py-2 text-neutral-300">{r.role ?? '—'}</td>
                    <td className="px-4 py-2 text-neutral-300">{r.account_status ?? '—'}</td>
                    <td className="px-4 py-2 text-neutral-300">{r.kyc_status ?? '—'}</td>
                    <td className="px-4 py-2">
                      {r.two_factor_enabled ? (
                        <span className="text-lime-400">✓ Enabled</span>
                      ) : (
                        <span className="text-neutral-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-neutral-400 font-mono text-xs">{r.referral_code ?? '—'}</td>
                    <td className="px-4 py-2">
                      {r.failed_login_attempts > 0 ? (
                        <span className="text-amber-400">{r.failed_login_attempts}</span>
                      ) : (
                        <span className="text-neutral-500">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-neutral-400">{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {activeTable === 'sessions' && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-dark-border bg-dark-elevated text-neutral-400">
                  <th className="px-4 py-3 font-medium">User ID</th>
                  <th className="px-4 py-3 font-medium">Active</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                  <th className="px-4 py-3 font-medium">Last used</th>
                  <th className="px-4 py-3 font-medium">Expires</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((r) => (
                  <tr key={r.id} className="border-b border-dark-border hover:bg-dark-elevated/50 transition-colors">
                    <td className="px-4 py-2 text-neutral-300 font-mono text-xs">{r.user_id ?? '—'}</td>
                    <td className="px-4 py-2">{r.is_active ? <span className="text-lime-400">Yes</span> : <span className="text-neutral-500">No</span>}</td>
                    <td className="px-4 py-2 text-neutral-300">{r.ip_address ?? '—'}</td>
                    <td className="px-4 py-2 text-neutral-400">{formatDate(r.last_used_at)}</td>
                    <td className="px-4 py-2 text-neutral-400">{formatDate(r.expires_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {activeTable === 'wallets' && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-dark-border bg-dark-elevated text-neutral-400">
                  <th className="px-4 py-3 font-medium">User ID</th>
                  <th className="px-4 py-3 font-medium">Currency</th>
                  <th className="px-4 py-3 font-medium">Balance</th>
                  <th className="px-4 py-3 font-medium">Reserved</th>
                  <th className="px-4 py-3 font-medium">USDT</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((r) => (
                  <tr key={r.id} className="border-b border-dark-border hover:bg-dark-elevated/50 transition-colors">
                    <td className="px-4 py-2 text-neutral-300 font-mono text-xs">{r.user_id ?? '—'}</td>
                    <td className="px-4 py-2 text-white">{r.currency ?? '—'}</td>
                    <td className="px-4 py-2 text-lime-400 font-mono">{formatCents(r.balance_cents)}</td>
                    <td className="px-4 py-2 text-amber-400 font-mono">{formatCents(r.reserved_cents)}</td>
                    <td className="px-4 py-2 text-lime-400 font-mono">{formatCents(r.usdt_balance_cents || 0)}</td>
                    <td className="px-4 py-2 text-neutral-400">{formatDate(r.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {activeTable === 'rate-limits' && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-dark-border bg-dark-elevated text-neutral-400">
                  <th className="px-4 py-3 font-medium">IP Address</th>
                  <th className="px-4 py-3 font-medium">Violations</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rateLimits.map((r) => (
                  <tr key={r.ip} className="border-b border-dark-border hover:bg-dark-elevated/50 transition-colors">
                    <td className="px-4 py-2 text-white font-mono">{r.ip}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${r.violations > 10 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                        {r.violations}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => handleClearRateLimit(r.ip)}
                        disabled={clearing === r.ip}
                        className="text-lime-400 hover:text-lime-300 text-xs font-medium"
                      >
                        {clearing === r.ip ? 'Clearing...' : 'Clear'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {((activeTable === 'users' && !users.length) ||
          (activeTable === 'sessions' && !sessions.length) ||
          (activeTable === 'wallets' && !wallets.length) ||
          (activeTable === 'rate-limits' && !rateLimits.length)) && (
            <p className="px-4 py-12 text-center text-neutral-500">No rows</p>
          )}
      </div>
    </div>
  );
}
