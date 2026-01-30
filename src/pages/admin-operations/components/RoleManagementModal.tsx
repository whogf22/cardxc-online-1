import { useState } from 'react';
import { updateUserRole } from '../../../lib/userManagement';

interface User {
  id: string;
  email: string;
  full_name?: string;
  role: 'USER' | 'SUPER_ADMIN';
}

interface RoleManagementModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RoleManagementModal({ isOpen, user, onClose, onSuccess }: RoleManagementModalProps) {
  const [selectedRole, setSelectedRole] = useState<'USER' | 'SUPER_ADMIN'>('USER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useState(() => {
    if (user) {
      setSelectedRole(user.role);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      await updateUserRole({
        user_id: user.id,
        role: selectedRole,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error updating role:', err);
      setError(err.message || 'Failed to update user role');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !user) return null;

  const roleChanged = selectedRole !== user.role;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
        {/* Header */}
        <div className="bg-purple-50 border-b border-purple-200 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <i className="ri-shield-user-line text-purple-600 text-xl"></i>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-purple-900">Role Management</h2>
            <p className="text-sm text-purple-700">Change user role and permissions</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-purple-400 hover:text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <i className="ri-error-warning-line text-red-600 text-xl"></i>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* User Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="text-sm text-slate-600 mb-2">Managing role for:</p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
                <span className="text-white text-lg font-semibold">
                  {user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-base font-semibold text-slate-900">{user.full_name || 'N/A'}</p>
                <p className="text-sm text-slate-600">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Current Role */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Current Role
            </label>
            <div className="px-4 py-2.5 border border-slate-300 rounded-lg bg-slate-50">
              <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${
                user.role === 'SUPER_ADMIN' 
                  ? 'bg-purple-100 text-purple-700 border-purple-200' 
                  : 'bg-blue-100 text-blue-700 border-blue-200'
              }`}>
                {user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'User'}
              </span>
            </div>
          </div>

          {/* New Role */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              New Role <span className="text-red-500">*</span>
            </label>
            <div className="space-y-3">
              {/* User Option */}
              <label className="flex items-start gap-3 p-4 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors">
                <input
                  type="radio"
                  name="role"
                  value="USER"
                  checked={selectedRole === 'USER'}
                  onChange={(e) => setSelectedRole(e.target.value as 'USER' | 'SUPER_ADMIN')}
                  className="mt-1 w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-slate-900">User</span>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                      Standard
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Can manage own wallet, make deposits/withdrawals, view own transactions
                  </p>
                </div>
              </label>

              {/* Super Admin Option */}
              <label className="flex items-start gap-3 p-4 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-purple-300 transition-colors">
                <input
                  type="radio"
                  name="role"
                  value="SUPER_ADMIN"
                  checked={selectedRole === 'SUPER_ADMIN'}
                  onChange={(e) => setSelectedRole(e.target.value as 'USER' | 'SUPER_ADMIN')}
                  className="mt-1 w-4 h-4 text-purple-600 focus:ring-2 focus:ring-purple-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-slate-900">Super Admin</span>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                      Full Access
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Full system access, user management, withdrawal approvals, risk monitoring
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <i className="ri-alert-line text-amber-600 text-lg mt-0.5"></i>
              <div className="flex-1">
                <p className="text-amber-900 text-sm font-semibold mb-2">Important Notes</p>
                <ul className="text-amber-700 text-xs space-y-1 list-disc list-inside">
                  <li>Cannot change your own role</li>
                  <li>Super Admin role grants full system access</li>
                  <li>Role changes take effect immediately</li>
                  <li>All changes are logged for audit compliance</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2.5 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !roleChanged}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
            >
              {loading ? (
                <>
                  <i className="ri-loader-4-line animate-spin"></i>
                  Updating...
                </>
              ) : (
                <>
                  <i className="ri-shield-check-line"></i>
                  Update Role
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
