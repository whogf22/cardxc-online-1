import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { Card, CardHeader, Tabs, Modal, DataTable } from '../../components/ui';
import { EmptyState } from '../../components/EmptyState';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useToastContext } from '../../contexts/ToastContext';
import { savingsApi } from '../../lib/api';

type SavingsTab = 'vaults' | 'budgets' | 'analytics' | 'roundups';

export default function SavingsPage() {
  const [activeTab, setActiveTab] = useState<SavingsTab>('vaults');
  const [isLoading, setIsLoading] = useState(true);
  const [vaults, setVaults] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const toast = useToastContext();

  const [vaultForm, setVaultForm] = useState({
    name: '',
    goalCents: '',
    currency: 'USD',
  });

  const [budgetForm, setBudgetForm] = useState({
    category: 'shopping',
    limit: '',
    period: 'monthly',
    alertThreshold: '80',
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [vaultsRes, budgetsRes, analyticsRes, alertsRes] = await Promise.all([
        savingsApi.getVaults().catch(() => ({ data: { vaults: [] } })),
        savingsApi.getBudgets().catch(() => ({ data: { budgets: [] } })),
        savingsApi.getAnalytics('month').catch(() => ({ data: { spendingByCategory: [], dailySpending: [], summary: null } })),
        savingsApi.getAlerts().catch(() => ({ data: { alerts: [] } })),
      ]);
      setVaults(vaultsRes.data?.vaults || []);
      setBudgets(budgetsRes.data?.budgets || []);
      setAnalytics({ byCategory: analyticsRes.data?.spendingByCategory || [], summary: analyticsRes.data?.summary });
      setAlerts(alertsRes.data?.alerts || []);
    } catch (err) {
      console.error('[Savings] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateVault = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await savingsApi.createVault({
        name: vaultForm.name,
        targetAmount: vaultForm.goalCents ? parseInt(vaultForm.goalCents) * 100 : 0,
        currency: vaultForm.currency,
      });
      toast.success('Savings vault created!');
      setShowVaultModal(false);
      setVaultForm({ name: '', goalCents: '', currency: 'USD' });
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create vault');
    }
  };

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await savingsApi.createBudget({
        category: budgetForm.category,
        limit: parseFloat(budgetForm.limit) * 100,
        period: budgetForm.period,
        currency: 'USD',
        alertThreshold: parseFloat(budgetForm.alertThreshold),
      });
      toast.success('Budget created!');
      setShowBudgetModal(false);
      setBudgetForm({ category: 'shopping', limit: '', period: 'monthly', alertThreshold: '80' });
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create budget');
    }
  };

  const totalSaved = vaults.reduce((sum, v) => sum + (v.balance_cents || 0), 0);
  const totalGoal = vaults.reduce((sum, v) => sum + (v.goal_cents || 0), 0);

  const tabs = [
    { id: 'vaults', label: 'Savings Vaults', icon: 'ri-safe-2-line', badge: vaults.length },
    { id: 'budgets', label: 'Budgets', icon: 'ri-pie-chart-line', badge: budgets.length },
    { id: 'analytics', label: 'Analytics', icon: 'ri-bar-chart-line' },
    { id: 'roundups', label: 'Round-ups', icon: 'ri-coin-line' },
  ];

  if (isLoading) {
    return (
      <DashboardLayout title="Savings">
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" fullScreen={false} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Savings"
      subtitle="Manage your savings goals and budgets"
      action={
        <button
          onClick={() => setShowVaultModal(true)}
          className="px-4 py-2 bg-lime-500 hover:bg-lime-600 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <i className="ri-add-line mr-2"></i>
          New Vault
        </button>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                <i className="ri-safe-2-fill text-2xl text-emerald-400"></i>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Total Saved</p>
                <p className="text-2xl font-bold text-white">${(totalSaved / 100).toFixed(2)}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-lime-500/20 rounded-2xl flex items-center justify-center">
                <i className="ri-target-line text-2xl text-lime-400"></i>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Savings Goal</p>
                <p className="text-2xl font-bold text-white">${(totalGoal / 100).toFixed(2)}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                <i className="ri-notification-3-line text-2xl text-amber-400"></i>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Active Alerts</p>
                <p className="text-2xl font-bold text-white">{alerts.filter(a => !a.read).length}</p>
              </div>
            </div>
          </Card>
        </div>

        <Tabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as SavingsTab)} />

        {activeTab === 'vaults' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vaults.length === 0 ? (
              <div className="col-span-full">
                <EmptyState
                  icon="ri-safe-2-line"
                  title="No savings vaults yet"
                  description="Create a vault to start saving towards your goals"
                  action={{ label: 'Create Vault', onClick: () => setShowVaultModal(true) }}
                  variant="card"
                />
              </div>
            ) : (
              vaults.map((vault) => {
                const progress = vault.goal_cents ? Math.min(100, (vault.balance_cents / vault.goal_cents) * 100) : 0;
                return (
                  <Card key={vault.id} hover>
                    <CardHeader title={vault.name} subtitle={vault.currency} icon="ri-safe-2-line" />
                    <div className="space-y-3">
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-2xl font-bold text-white">
                            ${(vault.balance_cents / 100).toFixed(2)}
                          </p>
                          {vault.goal_cents && (
                            <p className="text-sm text-neutral-500">
                              of ${(vault.goal_cents / 100).toFixed(2)} goal
                            </p>
                          )}
                        </div>
                        {vault.goal_cents && (
                          <span className="text-sm font-medium text-emerald-400">{progress.toFixed(0)}%</span>
                        )}
                      </div>
                      {vault.goal_cents && (
                        <div className="h-2 bg-dark-elevated rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'budgets' && (
          <Card padding="none">
            <div className="p-4 border-b border-dark-border flex items-center justify-between">
              <h3 className="font-semibold text-white">Your Budgets</h3>
              <button
                onClick={() => setShowBudgetModal(true)}
                className="px-3 py-1.5 text-sm font-medium text-lime-400 hover:bg-lime-500/20 rounded-lg transition-colors"
              >
                <i className="ri-add-line mr-1"></i>
                Add Budget
              </button>
            </div>
            <DataTable
              columns={[
                { key: 'category', label: 'Category', render: (row: any) => (
                  <span className="capitalize">{row.category}</span>
                )},
                { key: 'limit_cents', label: 'Limit', render: (row: any) => (
                  `$${(row.limit_cents / 100).toFixed(2)}`
                )},
                { key: 'spent_cents', label: 'Spent', render: (row: any) => (
                  `$${((row.spent_cents || 0) / 100).toFixed(2)}`
                )},
                { key: 'period', label: 'Period', render: (row: any) => (
                  <span className="capitalize">{row.period}</span>
                )},
                { key: 'progress', label: 'Progress', render: (row: any) => {
                  const pct = row.limit_cents ? ((row.spent_cents || 0) / row.limit_cents) * 100 : 0;
                  return (
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-dark-elevated rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <span className="text-xs text-neutral-500">{pct.toFixed(0)}%</span>
                    </div>
                  );
                }},
              ]}
              data={budgets}
              keyExtractor={(row) => row.id}
              emptyIcon="ri-pie-chart-line"
              emptyTitle="No budgets set"
              emptyDescription="Create budgets to track your spending"
            />
          </Card>
        )}

        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Spending by Category" icon="ri-pie-chart-2-line" />
              {analytics?.byCategory?.length > 0 ? (
                <div className="space-y-3">
                  {analytics.byCategory.map((cat: any) => (
                    <div key={cat.category} className="flex items-center justify-between">
                      <span className="text-sm text-neutral-400 capitalize">{cat.category}</span>
                      <span className="text-sm font-medium text-white">
                        ${(cat.total_cents / 100).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon="ri-pie-chart-line"
                  title="No spending data"
                  description="Make some transactions to see analytics"
                  variant="inline"
                />
              )}
            </Card>

            <Card>
              <CardHeader title="Monthly Trend" icon="ri-line-chart-line" />
              <EmptyState
                icon="ri-line-chart-line"
                title="Coming soon"
                description="Spending trends will appear here"
                variant="inline"
              />
            </Card>
          </div>
        )}

        {activeTab === 'roundups' && (
          <Card>
            <CardHeader
              title="Round-up Savings"
              subtitle="Automatically save spare change from transactions"
              icon="ri-coin-line"
            />
            <div className="mt-4 p-4 bg-dark-elevated rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">Round-up to nearest dollar</p>
                  <p className="text-sm text-neutral-500">Save the difference on every purchase</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-dark-bg peer-focus:ring-4 peer-focus:ring-lime-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-dark-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-lime-500"></div>
                </label>
              </div>
            </div>
          </Card>
        )}
      </div>

      <Modal isOpen={showVaultModal} onClose={() => setShowVaultModal(false)} title="Create Savings Vault" size="md">
        <form onSubmit={handleCreateVault} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Vault Name</label>
            <input
              type="text"
              value={vaultForm.name}
              onChange={(e) => setVaultForm({ ...vaultForm, name: e.target.value })}
              placeholder="e.g., Emergency Fund, Vacation"
              className="input-dark w-full px-4 py-3 rounded-xl"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Goal Amount (optional)</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={vaultForm.goalCents}
                onChange={(e) => setVaultForm({ ...vaultForm, goalCents: e.target.value })}
                placeholder="0.00"
                className="input-dark flex-1 px-4 py-3 rounded-xl"
              />
              <select
                value={vaultForm.currency}
                onChange={(e) => setVaultForm({ ...vaultForm, currency: e.target.value })}
                className="input-dark px-4 py-3 rounded-xl"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-lime-500 hover:bg-lime-600 text-white font-semibold rounded-xl transition-colors"
          >
            Create Vault
          </button>
        </form>
      </Modal>

      <Modal isOpen={showBudgetModal} onClose={() => setShowBudgetModal(false)} title="Create Budget" size="md">
        <form onSubmit={handleCreateBudget} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Category</label>
            <select
              value={budgetForm.category}
              onChange={(e) => setBudgetForm({ ...budgetForm, category: e.target.value })}
              className="input-dark w-full px-4 py-3 rounded-xl"
            >
              <option value="shopping">Shopping</option>
              <option value="food">Food & Dining</option>
              <option value="transport">Transport</option>
              <option value="entertainment">Entertainment</option>
              <option value="utilities">Utilities</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Budget Limit</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={budgetForm.limit}
              onChange={(e) => setBudgetForm({ ...budgetForm, limit: e.target.value })}
              placeholder="0.00"
              className="input-dark w-full px-4 py-3 rounded-xl"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Period</label>
            <select
              value={budgetForm.period}
              onChange={(e) => setBudgetForm({ ...budgetForm, period: e.target.value })}
              className="input-dark w-full px-4 py-3 rounded-xl"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Alert at (%)</label>
            <input
              type="number"
              min="1"
              max="100"
              value={budgetForm.alertThreshold}
              onChange={(e) => setBudgetForm({ ...budgetForm, alertThreshold: e.target.value })}
              className="input-dark w-full px-4 py-3 rounded-xl"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-lime-500 hover:bg-lime-600 text-white font-semibold rounded-xl transition-colors"
          >
            Create Budget
          </button>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
