import { useState, useEffect } from 'react';
import { Calendar, Filter, Download, Search, TrendingUp, DollarSign } from 'lucide-react';
import { userApi } from '../../lib/api';
import { formatDate } from '../../lib/localeUtils';

interface FluzTransaction {
  transactionId: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  description?: string;
  merchantName?: string;
  createdAt: string;
  virtualCardId?: string;
  giftCardId?: string;
}

export default function FluzTransactionsPage() {
  const [transactions, setTransactions] = useState<FluzTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const params: any = { limit: 100 };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await userApi.getFluzTransactions({
        limit: 100,
        startDate,
        endDate
      });
      setTransactions(response.data?.transactions ?? []);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = !searchTerm || 
      tx.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.merchantName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || tx.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const totalAmount = filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  const successCount = filteredTransactions.filter(tx => tx.status === 'SUCCESS').length;

  const handleExport = () => {
    const csv = [
      ['Date', 'Merchant', 'Amount', 'Status', 'Type', 'Description'],
      ...filteredTransactions.map(tx => [
        formatDate(tx.createdAt),
        tx.merchantName || 'N/A',
        tx.amount.toFixed(2),
        tx.status,
        tx.type,
        tx.description || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fluz-transactions-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-dark-bg py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Transaction History</h1>
          <p className="text-neutral-400">Complete transaction history</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-dark-card rounded-2xl border border-dark-border p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-neutral-400 text-sm font-medium">Total Transactions</span>
              <TrendingUp className="w-5 h-5 text-lime-400" />
            </div>
            <p className="text-3xl font-bold text-white">{filteredTransactions.length}</p>
          </div>

          <div className="bg-dark-card rounded-2xl border border-dark-border p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-neutral-400 text-sm font-medium">Successful</span>
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-emerald-400">{successCount}</p>
          </div>

          <div className="bg-dark-card rounded-2xl border border-dark-border p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-neutral-400 text-sm font-medium">Total Amount</span>
              <DollarSign className="w-5 h-5 text-lime-400" />
            </div>
            <p className="text-3xl font-bold text-lime-400">${totalAmount.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-dark-card rounded-2xl border border-dark-border p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-dark w-full px-4 py-2 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-dark w-full px-4 py-2 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                <Filter className="w-4 h-4 inline mr-1" />
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-dark w-full px-4 py-2 rounded-lg"
              >
                <option value="all">All Status</option>
                <option value="success">Success</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                <Search className="w-4 h-4 inline mr-1" />
                Search
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Merchant or description..."
                className="input-dark w-full px-4 py-2 rounded-lg"
              />
            </div>
          </div>

          <div className="flex gap-4 mt-4">
            <button
              onClick={loadTransactions}
              className="px-6 py-2 bg-lime-500 hover:bg-lime-600 text-white rounded-lg transition-all"
            >
              Apply Filters
            </button>
            <button
              onClick={handleExport}
              className="px-6 py-2 bg-dark-elevated text-neutral-300 rounded-lg hover:bg-dark-border transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-elevated">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-400">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-400">Merchant</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-400">Description</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-400">Type</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-neutral-400">Amount</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-neutral-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-neutral-500">
                      Loading transactions...
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-neutral-500">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.transactionId} className="hover:bg-dark-elevated transition-colors">
                      <td className="px-6 py-4 text-sm text-neutral-300">
                        {formatDate(tx.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-white">
                        {tx.merchantName || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-400">
                        {tx.description || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-3 py-1 bg-lime-500/20 text-lime-400 rounded-full text-xs font-medium">
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-semibold">
                        <span className={tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          ${Math.abs(tx.amount).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          tx.status === 'SUCCESS' 
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : tx.status === 'PENDING'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
