import { useState } from 'react';
import { createUser } from '../../../lib/userManagement';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateUserModal({ isOpen, onClose, onSuccess }: CreateUserModalProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    country: '',
    role: 'USER' as 'USER' | 'SUPER_ADMIN',
    status: 'active' as 'active' | 'suspended' | 'blocked',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await createUser(formData);
      onSuccess();
      onClose();
      // Reset form
      setFormData({
        email: '',
        password: '',
        full_name: '',
        phone: '',
        country: '',
        role: 'USER',
        status: 'active',
      });
    } catch (err: any) {
      console.error('Error creating user:', err);
      setError(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-card rounded-xl border border-dark-border shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-dark-card border-b border-dark-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Create New User</h2>
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

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-neutral-400 mb-2">
              Password <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Minimum 8 characters"
              className="input-dark w-full px-4 py-2.5 rounded-lg text-sm"
            />
            <p className="text-xs text-neutral-500 mt-1">Must be at least 8 characters long</p>
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

          {/* Role & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-400 mb-2">
                Role <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'USER' | 'SUPER_ADMIN' })}
                className="input-dark w-full px-4 py-2.5 rounded-lg text-sm"
              >
                <option value="USER">User</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>
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
          </div>

          {/* Info Banner */}
          <div className="bg-neutral-500/10 border border-neutral-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <i className="ri-information-line text-neutral-400 text-lg mt-0.5"></i>
              <div className="flex-1">
                <p className="text-neutral-400 text-sm font-medium">User Creation Notes</p>
                <ul className="text-neutral-400/90 text-xs mt-2 space-y-1 list-disc list-inside">
                  <li>Email will be auto-confirmed</li>
                  <li>Wallet balances will be initialized to 0 for all currencies</li>
                  <li>All actions are logged for audit compliance</li>
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
                  Creating...
                </>
              ) : (
                <>
                  <i className="ri-user-add-line"></i>
                  Create User
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
