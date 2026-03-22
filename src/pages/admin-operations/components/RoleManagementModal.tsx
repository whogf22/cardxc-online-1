import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
    }
  }, [user]);

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
      <div className="bg-dark-card rounded-xl border border-dark-border shadow-2xl max-w-lg w-full">
        {/* Header */}
        <div className="bg-lime-500/10 border-b border-lime-500/30 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-lime-500/20 rounded-full flex items-center justify-center">
            <i className="ri-shield-user-line text-lime-400 text-xl"></i>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-lime-400">Role Management</h2>
            <p className="text-sm text-lime-400/90">Change user role and permissions</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-lime-400 hover:text-white hover:bg-lime-500/20 rounded-lg transition-colors"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <i className="ri-error-warning-line text-red-400 text-xl"></i>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* User Info */}
          <div className="bg-dark-elevated border border-dark-border rounded-lg p-4">
            <p className="text-sm text-neutral-400 mb-2">Managing role for:</p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-lime-500 rounded-full flex items-center justify-center">
                <span className="text-black text-lg font-semibold">
                  {user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-base font-semibold text-white">{user.full_name || 'N/A'}</p>
                <p className="text-sm text-neutral-400">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Current Role */}
          <div>
            <label className="block text-sm font-semibold text-neutral-400 mb-2">
              Current Role
            </label>
            <div className="px-4 py-2.5 border border-dark-border rounded-lg bg-dark-elevated">
              <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${
                user.role === 'SUPER_ADMIN' 
                  ? 'bg-lime-500/20 text-lime-400 border-lime-500/30' 
                  : 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30'
              }`}>
                {user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'User'}
              </span>
            </div>
          </div>

          {/* New Role */}
          <div>
            <label className="block text-sm font-semibold text-neutral-400 mb-2">
              New Role <span className="text-red-400">*</span>
            </label>
            <div className="space-y-3">
              {/* User Option */}
              <label className="flex items-start gap-3 p-4 border-2 border-dark-border rounded-lg cursor-pointer hover:border-lime-500/50 transition-colors">
                <input
                  type="radio"
                  name="role"
                  value="USER"
                  checked={selectedRole === 'USER'}
                  onChange={(e) => setSelectedRole(e.target.value as 'USER' | 'SUPER_ADMIN')}
                  className="mt-1 w-4 h-4 text-lime-500 focus:ring-2 focus:ring-lime-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-white">User</span>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-neutral-500/20 text-neutral-400 border border-neutral-500/30">
                      Standard
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Can manage own wallet, make deposits/withdrawals, view own transactions
                  </p>
                </div>
              </label>

              {/* Super Admin Option */}
              <label className="flex items-start gap-3 p-4 border-2 border-dark-border rounded-lg cursor-pointer hover:border-lime-500/50 transition-colors">
                <input
                  type="radio"
                  name="role"
                  value="SUPER_ADMIN"
                  checked={selectedRole === 'SUPER_ADMIN'}
                  onChange={(e) => setSelectedRole(e.target.value as 'USER' | 'SUPER_ADMIN')}
                  className="mt-1 w-4 h-4 text-lime-500 focus:ring-2 focus:ring-lime-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-white">Super Admin</span>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-lime-500/20 text-lime-400 border border-lime-500/30">
                      Full Access
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Full system access, user management, withdrawal approvals, risk monitoring
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <i className="ri-alert-line text-amber-400 text-lg mt-0.5"></i>
              <div className="flex-1">
                <p className="text-amber-400 text-sm font-semibold mb-2">Important Notes</p>
                <ul className="text-amber-300/90 text-xs space-y-1 list-disc list-inside">
                  <li>Cannot change your own role</li>
                  <li>Super Admin role grants full system access</li>
                  <li>Role changes take effect immediately</li>
                  <li>All changes are logged for audit compliance</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-dark-border">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2.5 text-neutral-300 hover:bg-dark-elevated rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !roleChanged}
              className="px-6 py-2.5 bg-lime-500 text-black rounded-lg hover:bg-lime-400 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
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
