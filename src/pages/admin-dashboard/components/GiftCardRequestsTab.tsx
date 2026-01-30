import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../../lib/apiClient';
import { useToastContext } from '../../../contexts/ToastContext';

interface GiftCardRequest {
  id: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  type: 'buy' | 'sell';
  brand: string;
  amount: number;
  amount_cents: number;
  currency: string;
  status: string;
  card_code?: string;
  created_at: string;
  updated_at?: string;
}

export default function GiftCardRequestsTab() {
  const [requests, setRequests] = useState<GiftCardRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'rejected'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const toast = useToastContext();

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get('/admin/gift-card-requests?limit=500');
      
      if (response.success) {
        setRequests(response.data?.requests || []);
      }
    } catch (err: any) {
      console.error('[GiftCardRequestsTab] Error loading requests:', err);
      if (err.message?.includes('404') || err.message?.includes('Not Found')) {
        setRequests([]);
      } else {
        setError(err.message || 'Failed to load gift card requests');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleApprove = async (requestId: string) => {
    try {
      await apiClient.post(`/admin/gift-card-requests/${requestId}/approve`);
      toast.success('Request approved successfully');
      loadRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve request');
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await apiClient.post(`/admin/gift-card-requests/${requestId}/reject`, {
        reason: 'Rejected by admin',
      });
      toast.success('Request rejected');
      loadRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject request');
    }
  };

  const filteredRequests = requests.filter((req) => {
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    const matchesType = typeFilter === 'all' || req.type === typeFilter;
    const matchesSearch = 
      req.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.user_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesType && matchesSearch;
  });

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      case 'pending':
        return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      case 'rejected':
        return 'bg-red-500/20 text-red-400 border border-red-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border border-slate-500/30';
    }
  };

  const getTypeBadge = (type: string) => {
    return type === 'buy'
      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
      : 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
  };

  const formatCurrency = (cents: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(cents / 100);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 animate-pulse">
          <div className="h-10 bg-slate-700 rounded-xl mb-6"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-slate-700/50 rounded-xl"></div>
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
          <h2 className="text-2xl font-bold text-white">Gift Card Requests</h2>
          <p className="text-slate-400 mt-1">Manage user gift card buy and sell requests</p>
        </div>
        <button 
          onClick={loadRequests}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all duration-200 font-medium border border-slate-700 hover:border-slate-600 cursor-pointer"
        >
          <i className={`ri-refresh-line ${loading ? 'animate-spin' : ''}`}></i>
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <i className="ri-error-warning-line text-red-400 text-xl"></i>
          </div>
          <p className="text-red-400">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center">
              <i className="ri-shopping-cart-line text-blue-400 text-2xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {requests.filter(r => r.type === 'buy').length}
              </p>
              <p className="text-sm text-slate-400">Buy Requests</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl flex items-center justify-center">
              <i className="ri-exchange-dollar-line text-purple-400 text-2xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {requests.filter(r => r.type === 'sell').length}
              </p>
              <p className="text-sm text-slate-400">Sell Requests</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl flex items-center justify-center">
              <i className="ri-time-line text-amber-400 text-2xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {requests.filter(r => r.status === 'pending').length}
              </p>
              <p className="text-sm text-slate-400">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl flex items-center justify-center">
              <i className="ri-checkbox-circle-line text-emerald-400 text-2xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {requests.filter(r => r.status === 'completed').length}
              </p>
              <p className="text-sm text-slate-400">Completed</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              placeholder="Search by email, brand, or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {(['all', 'pending', 'completed', 'rejected'] as const).map((status) => (
              <button
                key={status}
                onClick={() => { setStatusFilter(status); setCurrentPage(1); }}
                className={`px-4 py-3 rounded-xl font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
                  statusFilter === status
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                    : 'bg-slate-900/50 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {(['all', 'buy', 'sell'] as const).map((type) => (
              <button
                key={type}
                onClick={() => { setTypeFilter(type); setCurrentPage(1); }}
                className={`px-4 py-3 rounded-xl font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
                  typeFilter === type
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-slate-900/50 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-700/50">
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">User</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Brand</th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="ri-gift-line text-3xl text-slate-500"></i>
                    </div>
                    <p className="text-slate-400 font-medium">No gift card requests found</p>
                    <p className="text-slate-500 text-sm mt-1">Requests will appear here when users submit them</p>
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((request, index) => (
                  <tr 
                    key={request.id} 
                    className={`border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors ${
                      index % 2 === 0 ? 'bg-slate-800/20' : 'bg-transparent'
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                          <span className="text-white font-bold text-sm">
                            {request.user_name?.charAt(0).toUpperCase() || request.user_email?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">{request.user_name || 'Unknown'}</p>
                          <p className="text-sm text-slate-400 truncate">{request.user_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold ${getTypeBadge(request.type)}`}>
                        {request.type === 'buy' ? 'Buy' : 'Sell'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-white font-medium">{request.brand}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-white font-bold">{formatCurrency(request.amount_cents, request.currency)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold ${getStatusBadge(request.status)}`}>
                        {request.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-white text-sm">
                        {new Date(request.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-slate-400 text-xs">
                        {new Date(request.created_at).toLocaleTimeString()}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {request.status === 'pending' && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleApprove(request.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-all duration-200 text-sm font-medium cursor-pointer"
                          >
                            <i className="ri-check-line"></i>
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(request.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all duration-200 text-sm font-medium cursor-pointer"
                          >
                            <i className="ri-close-line"></i>
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700/50">
            <p className="text-sm text-slate-400">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredRequests.length)} of {filteredRequests.length} requests
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <i className="ri-arrow-left-s-line"></i>
              </button>
              <span className="px-4 py-2 bg-slate-700/50 text-white rounded-lg font-medium">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <i className="ri-arrow-right-s-line"></i>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
