import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { Card, CardHeader, Tabs, StatusBadge, DataTable } from '../../components/ui';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useToastContext } from '../../contexts/ToastContext';
import { rewardsApi } from '../../lib/api';

type RewardsTab = 'cashback' | 'referrals' | 'subscriptions';

export default function RewardsPage() {
  const [activeTab, setActiveTab] = useState<RewardsTab>('cashback');
  const [isLoading, setIsLoading] = useState(true);
  const [cashback, setCashback] = useState<any>(null);
  const [referralCode, setReferralCode] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const toast = useToastContext();

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cashbackRes, referralRes, subsRes] = await Promise.all([
        rewardsApi.getCashback().catch(() => ({ data: { summary: { balance_cents: 0, lifetime_cents: 0 } } })),
        rewardsApi.getReferralInfo().catch(() => ({ data: { referralCode: null, referrals: [] } })),
        rewardsApi.getSubscriptions().catch(() => ({ data: { subscriptions: [] } })),
      ]);
      setCashback(cashbackRes.data?.summary);
      setReferralCode(referralRes.data?.referralCode);
      setReferrals(referralRes.data?.referrals || []);
      setSubscriptions(subsRes.data?.subscriptions || []);
    } catch (err) {
      console.error('[Rewards] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateCode = async () => {
    try {
      const result = await rewardsApi.getReferralInfo();
      setReferralCode(result.data?.referralCode);
      toast.success('Referral code loaded!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to load code');
    }
  };

  const handleCopyCode = () => {
    if (referralCode?.code) {
      navigator.clipboard.writeText(referralCode.code);
      toast.success('Code copied to clipboard!');
    }
  };

  const totalSubCost = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + (s.amount_cents || 0), 0);

  const tabs = [
    { id: 'cashback', label: 'Cashback', icon: 'ri-money-dollar-circle-line' },
    { id: 'referrals', label: 'Referrals', icon: 'ri-user-add-line', badge: referrals.length },
    { id: 'subscriptions', label: 'Subscriptions', icon: 'ri-repeat-line', badge: subscriptions.length },
  ];

  if (isLoading) {
    return (
      <DashboardLayout title="Rewards">
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" fullScreen={false} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Rewards"
      subtitle="Earn cashback, refer friends, and track subscriptions"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                <i className="ri-money-dollar-circle-fill text-2xl text-emerald-400"></i>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Cashback Balance</p>
                <p className="text-2xl font-bold text-white">
                  ${((cashback?.balance_cents || 0) / 100).toFixed(2)}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-2xl flex items-center justify-center">
                <i className="ri-user-star-fill text-2xl text-purple-400"></i>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Successful Referrals</p>
                <p className="text-2xl font-bold text-white">
                  {referrals.filter(r => r.status === 'completed').length}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                <i className="ri-repeat-fill text-2xl text-amber-400"></i>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Monthly Subscriptions</p>
                <p className="text-2xl font-bold text-white">
                  ${(totalSubCost / 100).toFixed(2)}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <Tabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as RewardsTab)} />

        {activeTab === 'cashback' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Your Cashback" icon="ri-money-dollar-circle-line" />
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-emerald-500/20 rounded-xl">
                  <div>
                    <p className="text-sm text-emerald-400">Available Balance</p>
                    <p className="text-3xl font-bold text-emerald-400">
                      ${((cashback?.balance_cents || 0) / 100).toFixed(2)}
                    </p>
                  </div>
                  <button className="px-4 py-2 bg-lime-500 hover:bg-lime-600 text-white font-medium rounded-xl transition-colors">
                    Withdraw
                  </button>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">Lifetime Earned</span>
                  <span className="font-medium text-white">
                    ${((cashback?.lifetime_cents || 0) / 100).toFixed(2)}
                  </span>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="How to Earn" icon="ri-lightbulb-line" />
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-dark-elevated rounded-xl">
                  <div className="w-8 h-8 bg-lime-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className="ri-bank-card-line text-lime-400"></i>
                  </div>
                  <div>
                    <p className="font-medium text-white">Card Purchases</p>
                    <p className="text-sm text-neutral-500">Earn up to 2% on eligible purchases</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-dark-elevated rounded-xl">
                  <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className="ri-user-add-line text-purple-400"></i>
                  </div>
                  <div>
                    <p className="font-medium text-white">Refer Friends</p>
                    <p className="text-sm text-neutral-500">Get $10 for each successful referral</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'referrals' && (
          <div className="space-y-6">
            <Card>
              <CardHeader title="Your Referral Code" icon="ri-share-line" />
              {referralCode ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1 p-4 bg-dark-elevated rounded-xl">
                    <p className="text-2xl font-mono font-bold text-white tracking-wider">
                      {referralCode.code}
                    </p>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="p-3 bg-lime-500/20 hover:bg-lime-500/30 text-lime-400 rounded-xl transition-colors"
                  >
                    <i className="ri-file-copy-line text-xl"></i>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGenerateCode}
                  className="w-full py-3 bg-lime-500 hover:bg-lime-600 text-white font-medium rounded-xl transition-colors"
                >
                  Generate Referral Code
                </button>
              )}
            </Card>

            <Card padding="none">
              <div className="p-4 border-b border-dark-border">
                <h3 className="font-semibold text-white">Your Referrals</h3>
              </div>
              <DataTable
                columns={[
                  { key: 'referee_email', label: 'Email', render: (row: any) => (
                    <span className="text-neutral-400">{row.referee_email || 'Pending signup'}</span>
                  )},
                  { key: 'status', label: 'Status', render: (row: any) => (
                    <StatusBadge status={row.status} />
                  )},
                  { key: 'bonus_cents', label: 'Bonus', render: (row: any) => (
                    row.bonus_cents ? `$${(row.bonus_cents / 100).toFixed(2)}` : '-'
                  )},
                  { key: 'created_at', label: 'Date', sortable: true, render: (row: any) => (
                    new Date(row.created_at).toLocaleDateString()
                  )},
                ]}
                data={referrals}
                keyExtractor={(row) => row.id}
                emptyIcon="ri-user-add-line"
                emptyTitle="No referrals yet"
                emptyDescription="Share your code to start earning"
              />
            </Card>
          </div>
        )}

        {activeTab === 'subscriptions' && (
          <Card padding="none">
            <div className="p-4 border-b border-dark-border flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">Tracked Subscriptions</h3>
                <p className="text-sm text-neutral-500">
                  Total: ${(totalSubCost / 100).toFixed(2)}/month
                </p>
              </div>
            </div>
            <DataTable
              columns={[
                { key: 'merchant', label: 'Service' },
                { key: 'amount_cents', label: 'Amount', render: (row: any) => (
                  `$${(row.amount_cents / 100).toFixed(2)}`
                )},
                { key: 'frequency', label: 'Frequency', render: (row: any) => (
                  <span className="capitalize">{row.frequency}</span>
                )},
                { key: 'status', label: 'Status', render: (row: any) => (
                  <StatusBadge status={row.status} />
                )},
                { key: 'next_charge_date', label: 'Next Charge', render: (row: any) => (
                  row.next_charge_date ? new Date(row.next_charge_date).toLocaleDateString() : '-'
                )},
              ]}
              data={subscriptions}
              keyExtractor={(row) => row.id}
              emptyIcon="ri-repeat-line"
              emptyTitle="No subscriptions tracked"
              emptyDescription="Add subscriptions to monitor your recurring payments"
            />
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
