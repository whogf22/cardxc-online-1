import { useState, useEffect } from 'react';
import { adminApi } from '../../../lib/api';
import CreateUserModal from './CreateUserModal';
import EditUserModal from './EditUserModal';
import DeleteUserModal from './DeleteUserModal';
import RoleManagementModal from './RoleManagementModal';

interface User {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  country?: string;
  role: 'USER' | 'SUPER_ADMIN';
  account_status?: string;
  status: 'active' | 'suspended' | 'blocked' | 'limited' | 'closed';
  kyc_status?: string;
  kyc_verified: boolean;
  created_at: string;
}

export default function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, searchTerm, roleFilter, statusFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');

      const result = await adminApi.getUsers();
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to load users');
      }

      const raw = result.data?.users || [];
      setUsers(raw.map((u: any) => {
        const acc = u.account_status || u.status || 'active';
        const status = acc === 'closed' ? 'blocked' : (acc === 'limited' ? 'suspended' : acc);
        return { ...u, status, kyc_verified: u.kyc_status === 'approved' };
      }));
    } catch (err: any) {
      console.error('Error loading users:', err);
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.email?.toLowerCase().includes(term) ||
          user.full_name?.toLowerCase().includes(term) ||
          user.phone?.toLowerCase().includes(term)
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((user) => user.status === statusFilter);
    }

    setFilteredUsers(filtered);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditModalOpen(true);
  };

  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setDeleteModalOpen(true);
  };

  const handleManageRole = (user: User) => {
    setSelectedUser(user);
    setRoleModalOpen(true);
  };

  const handleSuccess = () => {
    loadUsers();
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-lime-500/20 text-lime-400 border-lime-500/30',
      suspended: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      blocked: 'bg-red-500/20 text-red-400 border-red-500/30',
      limited: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      closed: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return styles[status as keyof typeof styles] || styles.active;
  };

  const getRoleBadge = (role: string) => {
    return role === 'SUPER_ADMIN'
      ? 'bg-lime-500/20 text-lime-400 border-lime-500/30'
      : 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-dark-card rounded-lg border border-dark-border p-6 animate-pulse">
          <div className="h-8 bg-dark-elevated rounded w-48 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-dark-elevated rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <i className="ri-error-warning-line text-red-400 text-2xl"></i>
          <div>
            <h3 className="text-red-400 font-semibold">Error Loading Users</h3>
            <p className="text-red-300 text-sm mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={loadUsers}
          className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-dark-card rounded-lg border border-dark-border p-4">
          <p className="text-sm text-neutral-400 mb-1">Total Users</p>
          <p className="text-2xl font-bold text-white">{users.length}</p>
        </div>
        <div className="bg-dark-card rounded-lg border border-dark-border p-4">
          <p className="text-sm text-neutral-400 mb-1">Active Users</p>
          <p className="text-2xl font-bold text-lime-400">
            {users.filter((u) => u.status === 'active').length}
          </p>
        </div>
        <div className="bg-dark-card rounded-lg border border-dark-border p-4">
          <p className="text-sm text-neutral-400 mb-1">KYC Verified</p>
          <p className="text-2xl font-bold text-lime-400">
            {users.filter((u) => u.kyc_verified).length}
          </p>
        </div>
        <div className="bg-dark-card rounded-lg border border-dark-border p-4">
          <p className="text-sm text-neutral-400 mb-1">Super Admins</p>
          <p className="text-2xl font-bold text-lime-400">
            {users.filter((u) => u.role === 'SUPER_ADMIN').length}
          </p>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="bg-dark-card rounded-lg border border-dark-border p-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-white">User Management</h3>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 bg-lime-500 text-black rounded-lg hover:bg-lime-400 transition-colors text-sm font-medium flex items-center gap-2 whitespace-nowrap"
          >
            <i className="ri-user-add-line"></i>
            Create User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-dark-card rounded-lg border border-dark-border p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">
              Search Users
            </label>
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"></i>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Email, name, or phone..."
                className="input-dark w-full pl-10 pr-4 py-2 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">
              Filter by Role
            </label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="input-dark w-full px-4 py-2 rounded-lg text-sm"
            >
              <option value="all">All Roles</option>
              <option value="USER">User</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">
              Filter by Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-dark w-full px-4 py-2 rounded-lg text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-dark-card rounded-lg border border-dark-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-elevated border-b border-dark-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  KYC
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <i className="ri-user-line text-neutral-500 text-4xl mb-2"></i>
                    <p className="text-neutral-400">No users found</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-dark-elevated transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-lime-500 rounded-full flex items-center justify-center">
                          <span className="text-black text-sm font-semibold">
                            {user.email?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {user.full_name || 'N/A'}
                          </p>
                          <p className="text-xs text-neutral-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-white">{user.phone || 'N/A'}</p>
                      <p className="text-xs text-neutral-500">{user.country || 'N/A'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 text-xs font-semibold rounded-full border ${getRoleBadge(
                          user.role
                        )}`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusBadge(
                          user.status
                        )}`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.kyc_verified ? (
                        <span className="flex items-center gap-1 text-lime-400 text-sm">
                          <i className="ri-checkbox-circle-fill"></i>
                          Verified
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-neutral-500 text-sm">
                          <i className="ri-close-circle-line"></i>
                          Not Verified
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-white">
                        {new Date(user.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {new Date(user.created_at).toLocaleTimeString()}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleManageRole(user)}
                          className="w-8 h-8 flex items-center justify-center text-lime-400 hover:bg-lime-500/20 rounded-lg transition-colors"
                          title="Manage Role"
                        >
                          <i className="ri-shield-user-line"></i>
                        </button>
                        <button
                          onClick={() => handleEditUser(user)}
                          className="w-8 h-8 flex items-center justify-center text-lime-400 hover:bg-lime-500/20 rounded-lg transition-colors"
                          title="Edit User"
                        >
                          <i className="ri-edit-line"></i>
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="w-8 h-8 flex items-center justify-center text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Delete User"
                        >
                          <i className="ri-delete-bin-line"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-neutral-500/10 border border-neutral-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <i className="ri-information-line text-neutral-400 text-xl mt-0.5"></i>
          <div className="flex-1">
            <h3 className="text-neutral-400 font-semibold text-sm">User Management Features</h3>
            <p className="text-neutral-400/90 text-sm mt-1">
              Create, edit, and delete users. Manage user roles and permissions. All admin actions are logged server-side for audit compliance.
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateUserModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleSuccess}
      />
      <EditUserModal
        isOpen={editModalOpen}
        user={selectedUser}
        onClose={() => setEditModalOpen(false)}
        onSuccess={handleSuccess}
      />
      <DeleteUserModal
        isOpen={deleteModalOpen}
        user={selectedUser}
        onClose={() => setDeleteModalOpen(false)}
        onSuccess={handleSuccess}
      />
      <RoleManagementModal
        isOpen={roleModalOpen}
        user={selectedUser}
        onClose={() => setRoleModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
