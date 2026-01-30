import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../../lib/apiClient';
import { useToastContext } from '../../../contexts/ToastContext';

interface UserKYC {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  country: string;
  kyc_status: 'not_started' | 'pending' | 'approved' | 'rejected';
  account_status: string;
  created_at: string;
}

type KYCStatusFilter = 'all' | 'not_started' | 'pending' | 'approved' | 'rejected';

const KYC_STATUS_CONFIG = {
  not_started: { label: 'Not Started', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: 'ri-file-unknow-line' },
  pending: { label: 'Pending', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: 'ri-time-line' },
  approved: { label: 'Approved', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: 'ri-checkbox-circle-line' },
  rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: 'ri-close-circle-line' },
};

export default function KYCManagementTab() {
  const [users, setUsers] = useState<UserKYC[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<KYCStatusFilter>('all');
  const [error, setError] = useState<string | null>(null);

  const toast = useToastContext();

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get('/admin/users?limit=100');
      
      if (response.success) {
        const usersData = response.data?.users || [];
        setUsers(usersData.map((u: any) => ({
          ...u,
          kyc_status: u.kyc_status || 'not_started',
        })));
      }
    } catch (err: any) {
      console.error('[KYCManagementTab] Error loading users:', err);
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleUpdateKYCStatus = async (userId: string, newStatus: string) => {
    try {
      setUpdating(userId);
      
      await apiClient.put(`/admin/users/${userId}/kyc-status`, {
        status: newStatus,
      });

      toast.success(`KYC status updated to ${newStatus}`);
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update KYC status');
    } finally {
      setUpdating(null);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || user.kyc_status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: users.length,
    not_started: users.filter(u => !u.kyc_status || u.kyc_status === 'not_started').length,
    pending: users.filter(u => u.kyc_status === 'pending').length,
    approved: users.filter(u => u.kyc_status === 'approved').length,
    rejected: users.filter(u => u.kyc_status === 'rejected').length,
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
          <h2 className="text-2xl font-bold text-white">KYC Management</h2>
          <p className="text-slate-400 mt-1">Review and manage user verification</p>
        </div>
        <button 
          onClick={loadUsers}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all duration-200 font-medium border border-slate-700 hover:border-slate-600"
        >
          <i className={`ri-refresh-line ${loading ? 'animate-spin' : ''}`}></i>
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
          <p className="text-2xl font-bold text-white">{stats.total}</p>
          <p className="text-sm text-slate-400">Total Users</p>
        </div>
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-500/30">
          <p className="text-2xl font-bold text-slate-400">{stats.not_started}</p>
          <p className="text-sm text-slate-400">Not Started</p>
        </div>
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-amber-500/30">
          <p className="text-2xl font-bold text-amber-400">{stats.pending}</p>
          <p className="text-sm text-slate-400">Pending</p>
        </div>
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-emerald-500/30">
          <p className="text-2xl font-bold text-emerald-400">{stats.approved}</p>
          <p className="text-sm text-slate-400">Approved</p>
        </div>
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-red-500/30">
          <p className="text-2xl font-bold text-red-400">{stats.rejected}</p>
          <p className="text-sm text-slate-400">Rejected</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <i className="ri-error-warning-line text-red-400 text-xl"></i>
          </div>
          <p className="text-red-400">{error}</p>
        </div>
      )}

      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              placeholder="Search by email or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {(['all', 'not_started', 'pending', 'approved', 'rejected'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2.5 rounded-xl font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
                  filterStatus === status
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                    : 'bg-slate-900/50 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600'
                }`}
              >
                {status === 'all' ? 'All' : status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
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
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Phone</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">KYC Status</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Account</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Joined</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="ri-user-line text-3xl text-slate-500"></i>
                    </div>
                    <p className="text-slate-400 font-medium">No users found</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, index) => {
                  const statusConfig = KYC_STATUS_CONFIG[user.kyc_status as keyof typeof KYC_STATUS_CONFIG] || KYC_STATUS_CONFIG.not_started;
                  return (
                    <tr 
                      key={user.id} 
                      className={`border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors ${
                        index % 2 === 0 ? 'bg-slate-800/20' : 'bg-transparent'
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                            <span className="text-white font-bold text-sm">
                              {user.full_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div>
                            <p className="text-white font-medium">{user.full_name || 'Unknown'}</p>
                            <p className="text-sm text-slate-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-white">{user.phone || 'N/A'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border ${statusConfig.color}`}>
                          <i className={statusConfig.icon}></i>
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                          user.account_status === 'active' 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                            : user.account_status === 'suspended' 
                              ? 'bg-red-500/20 text-red-400 border-red-500/30' 
                              : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                        }`}>
                          {user.account_status || 'active'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-white text-sm">
                          {new Date(user.created_at).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {user.kyc_status !== 'approved' && (
                            <button
                              onClick={() => handleUpdateKYCStatus(user.id, 'approved')}
                              disabled={updating === user.id}
                              className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium transition-all disabled:opacity-50 cursor-pointer border border-emerald-500/30"
                            >
                              {updating === user.id ? '...' : 'Approve'}
                            </button>
                          )}
                          {user.kyc_status !== 'rejected' && (
                            <button
                              onClick={() => handleUpdateKYCStatus(user.id, 'rejected')}
                              disabled={updating === user.id}
                              className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-all disabled:opacity-50 cursor-pointer border border-red-500/30"
                            >
                              {updating === user.id ? '...' : 'Reject'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
