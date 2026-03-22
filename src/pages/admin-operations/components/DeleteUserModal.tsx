
import { useState } from 'react';
import { deleteUser } from '../../../lib/userManagement';

interface User {
  id: string;
  email: string;
  full_name?: string;
}

interface DeleteUserModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DeleteUserModal({ isOpen, user, onClose, onSuccess }: DeleteUserModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const handleDelete = async () => {
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      await deleteUser(user.id);
      onSuccess();
      onClose();
      setConfirmText('');
    } catch (err: any) {
      console.error('Error deleting user:', err);
      setError(err.message || 'Failed to delete user');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !user) return null;

  const isConfirmed = confirmText === 'DELETE';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-card rounded-xl border border-dark-border shadow-2xl max-w-lg w-full">
        {/* Header */}
        <div className="bg-red-500/10 border-b border-red-500/30 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
            <i className="ri-delete-bin-line text-red-400 text-xl"></i>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-red-400">Delete User</h2>
            <p className="text-sm text-red-300/90">This action cannot be undone</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
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
            <p className="text-sm text-neutral-400 mb-2">You are about to delete:</p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-lg font-semibold">
                  {user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-base font-semibold text-white">{user.full_name || 'N/A'}</p>
                <p className="text-sm text-neutral-400">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <i className="ri-alert-line text-amber-400 text-xl mt-0.5"></i>
              <div className="flex-1">
                <p className="text-amber-400 text-sm font-semibold mb-2">Warning</p>
                <ul className="text-amber-300/90 text-sm space-y-1 list-disc list-inside">
                  <li>User account will be permanently deleted</li>
                  <li>All authentication credentials will be removed</li>
                  <li>User profile data will be deleted</li>
                  <li>Cannot delete users with active balances</li>
                  <li>This action is logged for audit compliance</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Confirmation Input */}
          <div>
            <label className="block text-sm font-semibold text-neutral-400 mb-2">
              Type <span className="text-red-400 font-mono">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="input-dark w-full px-4 py-2.5 rounded-lg text-sm font-mono"
            />
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
              onClick={handleDelete}
              disabled={loading || !isConfirmed}
              className="px-6 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
            >
              {loading ? (
                <>
                  <i className="ri-loader-4-line animate-spin"></i>
                  Deleting...
                </>
              ) : (
                <>
                  <i className="ri-delete-bin-line"></i>
                  Delete User
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
