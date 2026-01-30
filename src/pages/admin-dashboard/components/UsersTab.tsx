import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../../lib/apiClient';
import { useToastContext } from '../../../contexts/ToastContext';
import { useAuthContext } from '../../../contexts/AuthContext';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: string;
  kyc_status?: string;
  account_status?: string;
  two_factor_enabled?: boolean;
  failed_login_attempts?: number;
  locked_until?: string;
  created_at: string;
  updated_at?: string;
}

interface Wallet {
  currency: string;
  balance_cents: number;
  reserved_cents?: number;
}

export default function UsersTab() {
  const toast = useToastContext();
  const { user: currentAdmin } = useAuthContext();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'USER' | 'SUPER_ADMIN'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended' | 'closed'>('all');
  const [error, setError] = useState<string | null>(null);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    role: 'USER' as 'USER' | 'SUPER_ADMIN',
  });

  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userWallets, setUserWallets] = useState<Wallet[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  const isSuperAdmin = currentAdmin?.role === 'SUPER_ADMIN';

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams();
      queryParams.set('limit', '100');
      if (searchTerm) {
        queryParams.set('search', searchTerm);
      }

      const response = await apiClient.get(`/admin/users?${queryParams.toString()}`);
      
      if (response.success) {
        setUsers(response.data?.users || []);
      }
    } catch (err: any) {
      console.error('[UsersTab] Error loading users:', err);
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadUsers();
    }, 300);
    return () => clearTimeout(debounce);
  }, [loadUsers]);

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password) {
      toast.error('Email and password are required');
      return;
    }

    if (newUser.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    try {
      setCreating(true);
      
      const response = await apiClient.post('/admin/users', {
        email: newUser.email.trim(),
        password: newUser.password,
        fullName: newUser.fullName.trim() || undefined,
        phone: newUser.phone.trim() || undefined,
        role: newUser.role,
      });

      if (response.success) {
        toast.success(`User ${newUser.email} created successfully`);
        setShowCreateModal(false);
        setNewUser({ email: '', password: '', fullName: '', phone: '', role: 'USER' });
        await loadUsers();
      }
    } catch (err: any) {
      console.error('[UsersTab] Error creating user:', err);
      toast.error(err.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleViewUser = async (user: UserProfile) => {
    try {
      setLoadingDetails(true);
      setSelectedUser(user);
      
      const response = await apiClient.get(`/admin/users/${user.id}`);
      
      if (response.success) {
        setSelectedUser(response.data?.user || user);
        setUserWallets(response.data?.wallets || []);
      }
    } catch (err: any) {
      console.error('[UsersTab] Error loading user details:', err);
      toast.error(err.message || 'Failed to load user details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return;

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    try {
      setResettingPassword(true);
      
      const response = await apiClient.put(`/admin/users/${selectedUser.id}/password`, {
        password: newPassword,
      });

      if (response.success) {
        toast.success('Password reset successfully');
        setShowPasswordReset(false);
        setNewPassword('');
      }
    } catch (err: any) {
      console.error('[UsersTab] Error resetting password:', err);
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

  const canResetPassword = (user: UserProfile) => {
    if (user.role === 'SUPER_ADMIN' && currentAdmin?.role !== 'SUPER_ADMIN') return false;
    return true;
  };

  const filteredByRole = filterRole === 'all' 
    ? users 
    : users.filter(u => u.role === filterRole);

  const filteredByStatus = filterStatus === 'all'
    ? filteredByRole
    : filteredByRole.filter(u => u.account_status === filterStatus);

  const filteredUsers = filteredByStatus.filter((user) =>
    (user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.phone && user.phone.includes(searchTerm)))
  );

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-400 border border-red-500/30';
      default:
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      case 'suspended':
        return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      case 'closed':
        return 'bg-red-500/20 text-red-400 border border-red-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border border-slate-500/30';
    }
  };

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
  };

  if (loading && users.length === 0) {
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
          <h2 className="text-2xl font-bold text-white">User Management</h2>
          <p className="text-slate-400 mt-1">Search and manage user accounts</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-all duration-200 font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 cursor-pointer"
          >
            <i className="ri-user-add-line"></i>
            Create User
          </button>
          <button 
            onClick={loadUsers}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all duration-200 font-medium border border-slate-700 hover:border-slate-600 disabled:opacity-50 cursor-pointer"
          >
            <i className={`ri-refresh-line ${loading ? 'animate-spin' : ''}`}></i>
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              placeholder="Search by email, name, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all duration-200"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'USER', 'SUPER_ADMIN'] as const).map((role) => (
              <button
                key={role}
                onClick={() => setFilterRole(role)}
                className={`px-4 py-3 rounded-xl font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
                  filterRole === role
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                    : 'bg-slate-900/50 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600'
                }`}
              >
                {role === 'all' ? 'All' : role === 'USER' ? 'Users' : 'Admins'}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(['all', 'active', 'suspended', 'closed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-3 rounded-xl font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
                  filterStatus === status
                    ? status === 'active' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                      : status === 'suspended' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25'
                      : status === 'closed' ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                      : 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-slate-900/50 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex gap-6 mt-6 pt-6 border-t border-slate-700/50">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{users.length}</p>
            <p className="text-sm text-slate-400">Total</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-400">
              {users.filter(u => u.account_status === 'active').length}
            </p>
            <p className="text-sm text-slate-400">Active</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-400">
              {users.filter(u => u.role === 'SUPER_ADMIN').length}
            </p>
            <p className="text-sm text-slate-400">Admins</p>
          </div>
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

      <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-700/50">
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">User</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Role</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">KYC</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Joined</th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
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
                    <p className="text-slate-500 text-sm mt-1">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, index) => (
                  <tr 
                    key={user.id} 
                    className={`border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors ${
                      index % 2 === 0 ? 'bg-slate-800/20' : 'bg-transparent'
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                          <span className="text-white font-bold text-sm">
                            {user.full_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">{user.full_name || 'Unknown'}</p>
                          <p className="text-sm text-slate-400 truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold ${getRoleBadgeStyle(user.role)}`}>
                        {user.role || 'USER'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        user.kyc_status === 'approved' 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {user.kyc_status || 'pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold ${getStatusBadgeStyle(user.account_status || 'active')}`}>
                        {user.account_status || 'active'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-white text-sm">
                        {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleViewUser(user)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white rounded-lg transition-all duration-200 text-sm font-medium cursor-pointer"
                      >
                        <i className="ri-eye-line"></i>
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <i className="ri-user-add-line text-emerald-400 text-xl"></i>
                </div>
                <h3 className="text-xl font-bold text-white">Create New User</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-slate-400 text-xl"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="user@example.com"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Password <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Minimum 8 characters"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
                <input
                  type="text"
                  value={newUser.fullName}
                  onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                  placeholder="John Doe"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Phone</label>
                <input
                  type="tel"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  placeholder="+1 234 567 8900"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Role</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewUser({ ...newUser, role: 'USER' })}
                    className={`flex-1 py-3 rounded-xl font-medium transition-all cursor-pointer ${
                      newUser.role === 'USER'
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                        : 'bg-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <i className="ri-user-line mr-2"></i>User
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewUser({ ...newUser, role: 'SUPER_ADMIN' })}
                    disabled={!isSuperAdmin}
                    className={`flex-1 py-3 rounded-xl font-medium transition-all cursor-pointer ${
                      newUser.role === 'SUPER_ADMIN'
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                        : !isSuperAdmin
                          ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                          : 'bg-slate-700 text-slate-400 hover:text-white'
                    }`}
                    title={!isSuperAdmin ? 'Only SUPER_ADMIN can create super admin users' : ''}
                  >
                    <i className="ri-shield-user-line mr-2"></i>Admin
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="flex-1 py-3 rounded-xl font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateUser}
                  disabled={creating || !newUser.email || !newUser.password}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    creating || !newUser.email || !newUser.password
                      ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                  }`}
                >
                  {creating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <i className="ri-user-add-line"></i>
                      Create
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-2xl border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <i className="ri-user-line text-blue-400 text-xl"></i>
                </div>
                <h3 className="text-xl font-bold text-white">User Profile</h3>
              </div>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setShowPasswordReset(false);
                  setNewPassword('');
                }}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-slate-400 text-xl"></i>
              </button>
            </div>

            {loadingDetails ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-slate-900/50 rounded-xl">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-2xl">
                      {selectedUser.full_name?.charAt(0).toUpperCase() || selectedUser.email?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xl font-bold text-white truncate">{selectedUser.full_name || 'Unknown'}</h4>
                    <p className="text-slate-400 truncate">{selectedUser.email}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-semibold ${getRoleBadgeStyle(selectedUser.role)}`}>
                        {selectedUser.role}
                      </span>
                      <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-semibold ${getStatusBadgeStyle(selectedUser.account_status || 'active')}`}>
                        {selectedUser.account_status || 'active'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-900/50 rounded-xl">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Phone</p>
                    <p className="text-white font-medium">{selectedUser.phone || 'Not set'}</p>
                  </div>
                  <div className="p-4 bg-slate-900/50 rounded-xl">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">KYC Status</p>
                    <p className={`font-medium ${selectedUser.kyc_status === 'approved' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {selectedUser.kyc_status || 'Pending'}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-900/50 rounded-xl">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">2FA</p>
                    <p className={`font-medium ${selectedUser.two_factor_enabled ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {selectedUser.two_factor_enabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-900/50 rounded-xl">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Joined</p>
                    <p className="text-white font-medium">
                      {new Date(selectedUser.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {userWallets.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Wallets</h4>
                    <div className="space-y-2">
                      {userWallets.map((wallet, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                              <i className="ri-wallet-3-line text-emerald-400"></i>
                            </div>
                            <span className="text-white font-medium">{wallet.currency}</span>
                          </div>
                          <span className="text-white font-bold">{formatCurrency(wallet.balance_cents)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {canResetPassword(selectedUser) && (
                  <div className="pt-4 border-t border-slate-700">
                    {!showPasswordReset ? (
                      <button
                        onClick={() => setShowPasswordReset(true)}
                        className="w-full py-3 bg-amber-500/20 text-amber-400 rounded-xl font-medium hover:bg-amber-500/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <i className="ri-lock-password-line"></i>
                        Reset Password
                      </button>
                    ) : (
                      <div className="space-y-4 p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
                        <div className="flex items-center gap-2 text-amber-400">
                          <i className="ri-lock-password-line"></i>
                          <span className="font-medium">Reset Password</span>
                        </div>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="New password (min 8 characters)"
                          className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              setShowPasswordReset(false);
                              setNewPassword('');
                            }}
                            className="flex-1 py-2.5 bg-slate-700 text-slate-300 rounded-xl font-medium hover:bg-slate-600 transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleResetPassword}
                            disabled={resettingPassword || newPassword.length < 8}
                            className={`flex-1 py-2.5 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                              resettingPassword || newPassword.length < 8
                                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                : 'bg-amber-500 text-white hover:bg-amber-600'
                            }`}
                          >
                            {resettingPassword ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Resetting...
                              </>
                            ) : (
                              'Reset'
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
