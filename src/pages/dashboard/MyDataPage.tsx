import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { DashboardLayout } from '../../components/DashboardLayout';
import { formatDate } from '../../lib/localeUtils';

export default function MyDataPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [wallets, setWallets] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.id) {
      navigate('/signin', { replace: true });
      return;
    }
    loadData();
  }, [user?.id, navigate]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [walletsRes, txRes] = await Promise.all([
        userApi.getWallets(),
        userApi.getTransactions({ limit: 100 }),
      ]);
      if (walletsRes.success && walletsRes.data?.wallets) {
        setWallets(walletsRes.data.wallets);
      }
      if (txRes.success && txRes.data?.transactions) {
        setTransactions(txRes.data.transactions);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load data');
    }
    setLoading(false);
  };

  return (
    <DashboardLayout
      title="My Data"
      subtitle="View-only inspection of your wallets and transactions. Use the actions below to make changes safely."
      action={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate('/wallet')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-lime-500 text-black text-sm font-semibold hover:bg-lime-400 transition-colors"
          >
            <i className="ri-add-line"></i> Deposit
          </button>
          <button
            type="button"
            onClick={() => navigate('/transfer')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-elevated border border-dark-border text-white text-sm font-medium hover:bg-dark-hover transition-colors"
          >
            <i className="ri-arrow-left-right-line"></i> Transfer
          </button>
          <button
            type="button"
            onClick={() => navigate('/wallet')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-dark-border text-neutral-300 text-sm font-medium hover:bg-dark-elevated transition-colors"
          >
            <i className="ri-bank-line"></i> Withdraw
          </button>
        </div>
      }
    >
      <div className="space-y-8 -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 p-4 sm:p-6 lg:p-8 bg-dark-bg rounded-t-3xl border-t border-dark-border">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <section className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden">
          <div className="px-6 py-4 border-b border-dark-border flex items-center gap-2">
            <i className="ri-wallet-3-line text-lime-400 text-xl"></i>
            <h2 className="text-lg font-semibold text-white">Wallets (read-only)</h2>
          </div>
          {loading ? (
            <div className="h-24 skeleton-shimmer rounded-none" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-border bg-dark-elevated">
                    <th className="text-left py-3 px-4 font-medium text-neutral-400">Currency</th>
                    <th className="text-right py-3 px-4 font-medium text-neutral-400">Balance</th>
                    <th className="text-right py-3 px-4 font-medium text-neutral-400">Reserved</th>
                  </tr>
                </thead>
                <tbody>
                  {wallets.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 px-4 text-center text-neutral-500">
                        No wallets yet.
                      </td>
                    </tr>
                  ) : (
                    wallets.map((w) => (
                      <tr key={w.id || w.currency} className="border-b border-dark-border last:border-0 hover:bg-dark-elevated/50 transition-colors">
                        <td className="py-3 px-4 font-medium text-white">{w.currency}</td>
                        <td className="py-3 px-4 text-right text-lime-400 font-mono">
                          {typeof w.balance === 'number' ? w.balance.toFixed(2) : (w.balanceCents / 100)?.toFixed(2) ?? '—'}
                        </td>
                        <td className="py-3 px-4 text-right text-neutral-400 font-mono">
                          {typeof w.reserved_cents === 'number' ? (w.reserved_cents / 100).toFixed(2) : (w.reservedCents / 100)?.toFixed(2) ?? '0'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden">
          <div className="px-6 py-4 border-b border-dark-border flex items-center gap-2">
            <i className="ri-file-list-3-line text-lime-400 text-xl"></i>
            <h2 className="text-lg font-semibold text-white">Recent transactions (read-only)</h2>
          </div>
          {loading ? (
            <div className="h-48 skeleton-shimmer rounded-none" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-border bg-dark-elevated">
                    <th className="text-left py-3 px-4 font-medium text-neutral-400">Type</th>
                    <th className="text-right py-3 px-4 font-medium text-neutral-400">Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-neutral-400">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-neutral-400">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-neutral-400">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 px-4 text-center text-neutral-500">
                        No transactions yet.
                      </td>
                    </tr>
                  ) : (
                    transactions.slice(0, 50).map((t) => (
                      <tr key={t.id} className="border-b border-dark-border last:border-0 hover:bg-dark-elevated/50 transition-colors">
                        <td className="py-3 px-4 font-medium text-white">{t.type || t.transaction_type || '—'}</td>
                        <td className="py-3 px-4 text-right text-lime-400 font-mono">
                          {t.currency} {(t.amountCents != null ? t.amountCents / 100 : t.amount)?.toFixed(2) ?? '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ${
                            (t.status || '').toLowerCase() === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
                            (t.status || '').toLowerCase() === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-neutral-500/20 text-neutral-400'
                          }`}>
                            {t.status || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-neutral-400">{t.created_at ? formatDate(t.created_at) : '—'}</td>
                        <td className="py-3 px-4 text-neutral-400 max-w-[200px] truncate" title={t.description}>{t.description || t.merchant_display_name || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
