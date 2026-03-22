
import { useState, useEffect } from 'react';
import { updateUser } from '../../../lib/userManagement';

interface User {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  country?: string;
  status: 'active' | 'suspended' | 'blocked';
}

interface EditUserModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditUserModal({ isOpen, user, onClose, onSuccess }: EditUserModalProps) {
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
    country: '',
    status: 'active' as 'active' | 'suspended' | 'blocked',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        full_name: user.full_name || '',
        phone: user.phone || '',
        country: user.country || '',
        status: user.status || 'active',
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      await updateUser({
        user_id: user.id,
        ...formData,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error updating user:', err);
      setError(err.message || 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-card rounded-xl border border-dark-border shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-dark-card border-b border-dark-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Edit User</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-dark-elevated rounded-lg transition-colors"
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

          {/* User ID (Read-only) */}
          <div>
            <label className="block text-sm font-semibold text-neutral-400 mb-2">
              User ID
            </label>
            <input
              type="text"
              value={user.id}
              disabled
              className="input-dark w-full px-4 py-2.5 rounded-lg bg-dark-elevated/50 text-neutral-500 text-sm"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-neutral-400 mb-2">
              Email Address <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="user@example.com"
              className="input-dark w-full px-4 py-2.5 rounded-lg text-sm"
            />
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-semibold text-neutral-400 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="John Doe"
              className="input-dark w-full px-4 py-2.5 rounded-lg text-sm"
            />
          </div>

          {/* Phone & Country */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-400 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1234567890"
                className="input-dark w-full px-4 py-2.5 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-neutral-400 mb-2">
                Country Code
              </label>
              <input
                type="text"
                maxLength={3}
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value.toUpperCase() })}
                placeholder="US"
                className="input-dark w-full px-4 py-2.5 rounded-lg text-sm uppercase"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold text-neutral-400 mb-2">
              Status <span className="text-red-400">*</span>
            </label>
            <select
              required
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'suspended' | 'blocked' })}
              className="input-dark w-full px-4 py-2.5 rounded-lg text-sm"
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>

          {/* Info Banner */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <i className="ri-alert-line text-amber-400 text-lg mt-0.5"></i>
              <div className="flex-1">
                <p className="text-amber-400 text-sm font-medium">Important Notes</p>
                <ul className="text-amber-300/90 text-xs mt-2 space-y-1 list-disc list-inside">
                  <li>Changing email will update both profile and authentication</li>
                  <li>User role cannot be changed here (use Role Management)</li>
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
              disabled={loading}
              className="px-6 py-2.5 bg-lime-500 text-black rounded-lg hover:bg-lime-400 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
            >
              {loading ? (
                <>
                  <i className="ri-loader-4-line animate-spin"></i>
                  Updating...
                </>
              ) : (
                <>
                  <i className="ri-save-line"></i>
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
