import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { DashboardLayout } from '../../components/DashboardLayout';

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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 text-white text-sm font-medium hover:bg-sky-700"
          >
            <i className="ri-add-line"></i> Deposit
          </button>
          <button
            type="button"
            onClick={() => navigate('/transfer')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700 text-white text-sm font-medium hover:bg-slate-600"
          >
            <i className="ri-arrow-left-right-line"></i> Transfer
          </button>
          <button
            type="button"
            onClick={() => navigate('/wallet')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
          >
            <i className="ri-bank-line"></i> Withdraw
          </button>
        </div>
      }
    >
      <div className="space-y-8">
        {error && (
          <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <i className="ri-wallet-3-line text-sky-600"></i>
            Wallets (read-only)
          </h2>
          {loading ? (
            <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Currency</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">Balance</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">Reserved</th>
                  </tr>
                </thead>
                <tbody>
                  {wallets.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 px-4 text-center text-slate-500">
                        No wallets yet.
                      </td>
                    </tr>
                  ) : (
                    wallets.map((w) => (
                      <tr key={w.id || w.currency} className="border-b border-slate-100 last:border-0">
                        <td className="py-3 px-4 font-medium text-slate-900">{w.currency}</td>
                        <td className="py-3 px-4 text-right text-slate-700">
                          {typeof w.balance === 'number' ? w.balance.toFixed(2) : (w.balanceCents / 100)?.toFixed(2) ?? '—'}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500">
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

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <i className="ri-file-list-3-line text-sky-600"></i>
            Recent transactions (read-only)
          </h2>
          {loading ? (
            <div className="h-48 bg-slate-100 rounded-xl animate-pulse" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Type</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 px-4 text-center text-slate-500">
                        No transactions yet.
                      </td>
                    </tr>
                  ) : (
                    transactions.slice(0, 50).map((t) => (
                      <tr key={t.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-3 px-4 font-medium text-slate-900">{t.type || t.transaction_type || '—'}</td>
                        <td className="py-3 px-4 text-right text-slate-700">
                          {t.currency} {(t.amountCents != null ? t.amountCents / 100 : t.amount)?.toFixed(2) ?? '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            (t.status || '').toLowerCase() === 'success' ? 'bg-emerald-100 text-emerald-800' :
                            (t.status || '').toLowerCase() === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {t.status || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}</td>
                        <td className="py-3 px-4 text-slate-600 max-w-[200px] truncate" title={t.description}>{t.description || t.merchant_display_name || '—'}</td>
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
