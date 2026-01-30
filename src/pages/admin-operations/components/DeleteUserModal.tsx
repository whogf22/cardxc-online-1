
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
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
        {/* Header */}
        <div className="bg-red-50 border-b border-red-200 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <i className="ri-delete-bin-line text-red-600 text-xl"></i>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-red-900">Delete User</h2>
            <p className="text-sm text-red-700">This action cannot be undone</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
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
            <p className="text-sm text-slate-600 mb-2">You are about to delete:</p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center">
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

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <i className="ri-alert-line text-amber-600 text-xl mt-0.5"></i>
              <div className="flex-1">
                <p className="text-amber-900 text-sm font-semibold mb-2">Warning</p>
                <ul className="text-amber-700 text-sm space-y-1 list-disc list-inside">
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
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Type <span className="text-red-600 font-mono">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm font-mono"
            />
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
              onClick={handleDelete}
              disabled={loading || !isConfirmed}
              className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
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
