import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { Card, CardHeader, Tabs, Modal, StatusBadge, DataTable } from '../../components/ui';
import { EmptyState } from '../../components/EmptyState';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useToastContext } from '../../contexts/ToastContext';
import { paymentsApi } from '../../lib/api';

type PaymentTab = 'send' | 'links' | 'recurring' | 'splits';

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<PaymentTab>('send');
  const [isLoading, setIsLoading] = useState(true);
  const [paymentLinks, setPaymentLinks] = useState<any[]>([]);
  const [recurringTransfers, setRecurringTransfers] = useState<any[]>([]);
  const [splitBills, setSplitBills] = useState<any[]>([]);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const toast = useToastContext();

  const [sendForm, setSendForm] = useState({
    recipient: '',
    recipientType: 'email',
    amount: '',
    currency: 'USD',
    note: '',
  });

  const [linkForm, setLinkForm] = useState({
    amount: '',
    currency: 'USD',
    description: '',
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [linksRes, recurringRes, splitsRes] = await Promise.all([
        paymentsApi.getPaymentLinks().catch(() => ({ data: { paymentLinks: [] } })),
        paymentsApi.getRecurringTransfers().catch(() => ({ data: { recurringTransfers: [] } })),
        paymentsApi.getSplitBills().catch(() => ({ data: { createdSplits: [], participatingSplits: [] } })),
      ]);
      setPaymentLinks(linksRes.data?.paymentLinks || []);
      setRecurringTransfers(recurringRes.data?.recurringTransfers || []);
      setSplitBills([...(splitsRes.data?.createdSplits || []), ...(splitsRes.data?.participatingSplits || [])]);
    } catch (err) {
      console.error('[Payments] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSendMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await paymentsApi.p2pTransfer({
        recipient: sendForm.recipient,
        recipientType: sendForm.recipientType as 'email' | 'phone' | 'username',
        amount: parseFloat(sendForm.amount),
        currency: sendForm.currency,
        note: sendForm.note,
      });
      toast.success('Money sent successfully!');
      setShowSendModal(false);
      setSendForm({ recipient: '', recipientType: 'email', amount: '', currency: 'USD', note: '' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to send money');
    }
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await paymentsApi.createPaymentLink({
        amount: linkForm.amount ? parseFloat(linkForm.amount) : undefined,
        currency: linkForm.currency,
        description: linkForm.description,
      });
      toast.success('Payment link created!');
      setShowLinkModal(false);
      setLinkForm({ amount: '', currency: 'USD', description: '' });
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create link');
    }
  };

  const tabs = [
    { id: 'send', label: 'Send Money', icon: 'ri-send-plane-line' },
    { id: 'links', label: 'Payment Links', icon: 'ri-link', badge: paymentLinks.length },
    { id: 'recurring', label: 'Recurring', icon: 'ri-repeat-line', badge: recurringTransfers.length },
    { id: 'splits', label: 'Split Bills', icon: 'ri-group-line', badge: splitBills.length },
  ];

  if (isLoading) {
    return (
      <DashboardLayout title="Payments">
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" fullScreen={false} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Payments"
      subtitle="Send money, create payment links, and manage transfers"
      action={
        <button
          onClick={() => setShowSendModal(true)}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <i className="ri-send-plane-fill mr-2"></i>
          Send Money
        </button>
      }
    >
      <div className="space-y-6">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as PaymentTab)} />

        {activeTab === 'send' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card hover onClick={() => setShowSendModal(true)}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-sky-100 rounded-2xl flex items-center justify-center">
                  <i className="ri-user-line text-2xl text-sky-600"></i>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Send to Contact</h3>
                  <p className="text-sm text-slate-500">Email, phone, or username</p>
                </div>
              </div>
            </Card>

            <Card hover onClick={() => setShowLinkModal(true)}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                  <i className="ri-link text-2xl text-emerald-600"></i>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Request Money</h3>
                  <p className="text-sm text-slate-500">Create a payment link</p>
                </div>
              </div>
            </Card>

            <Card hover>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center">
                  <i className="ri-qr-code-line text-2xl text-purple-600"></i>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">QR Payment</h3>
                  <p className="text-sm text-slate-500">Scan or show QR code</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'links' && (
          <Card padding="none">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Your Payment Links</h3>
              <button
                onClick={() => setShowLinkModal(true)}
                className="px-3 py-1.5 text-sm font-medium text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
              >
                <i className="ri-add-line mr-1"></i>
                Create Link
              </button>
            </div>
            <DataTable
              columns={[
                { key: 'code', label: 'Code', render: (row: any) => (
                  <span className="font-mono text-sm">{row.code}</span>
                )},
                { key: 'amount_cents', label: 'Amount', render: (row: any) => (
                  row.amount_cents ? `$${(row.amount_cents / 100).toFixed(2)}` : 'Any amount'
                )},
                { key: 'status', label: 'Status', render: (row: any) => (
                  <StatusBadge status={row.status} />
                )},
                { key: 'created_at', label: 'Created', sortable: true, render: (row: any) => (
                  new Date(row.created_at).toLocaleDateString()
                )},
              ]}
              data={paymentLinks}
              keyExtractor={(row) => row.id}
              emptyIcon="ri-link"
              emptyTitle="No payment links yet"
              emptyDescription="Create a link to start receiving payments"
            />
          </Card>
        )}

        {activeTab === 'recurring' && (
          <Card padding="none">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Recurring Transfers</h3>
            </div>
            <DataTable
              columns={[
                { key: 'recipient_email', label: 'Recipient' },
                { key: 'amount_cents', label: 'Amount', render: (row: any) => (
                  `$${(row.amount_cents / 100).toFixed(2)}`
                )},
                { key: 'frequency', label: 'Frequency' },
                { key: 'status', label: 'Status', render: (row: any) => (
                  <StatusBadge status={row.status} />
                )},
                { key: 'next_run', label: 'Next Run', render: (row: any) => (
                  row.next_run ? new Date(row.next_run).toLocaleDateString() : '-'
                )},
              ]}
              data={recurringTransfers}
              keyExtractor={(row) => row.id}
              emptyIcon="ri-repeat-line"
              emptyTitle="No recurring transfers"
              emptyDescription="Set up automatic transfers"
            />
          </Card>
        )}

        {activeTab === 'splits' && (
          <Card padding="none">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Bill Splits</h3>
            </div>
            <DataTable
              columns={[
                { key: 'title', label: 'Title' },
                { key: 'total_cents', label: 'Total', render: (row: any) => (
                  `$${(row.total_cents / 100).toFixed(2)}`
                )},
                { key: 'status', label: 'Status', render: (row: any) => (
                  <StatusBadge status={row.status} />
                )},
                { key: 'created_at', label: 'Date', sortable: true, render: (row: any) => (
                  new Date(row.created_at).toLocaleDateString()
                )},
              ]}
              data={splitBills}
              keyExtractor={(row) => row.id}
              emptyIcon="ri-group-line"
              emptyTitle="No bill splits"
              emptyDescription="Split expenses with friends"
            />
          </Card>
        )}
      </div>

      <Modal isOpen={showSendModal} onClose={() => setShowSendModal(false)} title="Send Money" size="md">
        <form onSubmit={handleSendMoney} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Recipient Type</label>
            <select
              value={sendForm.recipientType}
              onChange={(e) => setSendForm({ ...sendForm, recipientType: e.target.value })}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            >
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="username">Username</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Recipient</label>
            <input
              type="text"
              value={sendForm.recipient}
              onChange={(e) => setSendForm({ ...sendForm, recipient: e.target.value })}
              placeholder={sendForm.recipientType === 'email' ? 'email@example.com' : sendForm.recipientType === 'phone' ? '+1234567890' : 'username'}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={sendForm.amount}
                onChange={(e) => setSendForm({ ...sendForm, amount: e.target.value })}
                placeholder="0.00"
                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                required
              />
              <select
                value={sendForm.currency}
                onChange={(e) => setSendForm({ ...sendForm, currency: e.target.value })}
                className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Note (optional)</label>
            <input
              type="text"
              value={sendForm.note}
              onChange={(e) => setSendForm({ ...sendForm, note: e.target.value })}
              placeholder="What's this for?"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl transition-colors"
          >
            Send Money
          </button>
        </form>
      </Modal>

      <Modal isOpen={showLinkModal} onClose={() => setShowLinkModal(false)} title="Create Payment Link" size="md">
        <form onSubmit={handleCreateLink} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount (optional)</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={linkForm.amount}
                onChange={(e) => setLinkForm({ ...linkForm, amount: e.target.value })}
                placeholder="Leave empty for any amount"
                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
              <select
                value={linkForm.currency}
                onChange={(e) => setLinkForm({ ...linkForm, currency: e.target.value })}
                className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <input
              type="text"
              value={linkForm.description}
              onChange={(e) => setLinkForm({ ...linkForm, description: e.target.value })}
              placeholder="What is this payment for?"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors"
          >
            Create Link
          </button>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
