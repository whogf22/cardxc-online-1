import { ActionButton } from './ActionButton';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'success';
  icon?: string;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  icon = 'ri-question-line',
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  const iconColors = {
    danger: 'bg-red-100 text-red-600',
    primary: 'bg-sky-100 text-sky-600',
    success: 'bg-emerald-100 text-emerald-600',
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
        <div className={`w-14 h-14 ${iconColors[variant]} rounded-full flex items-center justify-center mx-auto mb-4`}>
          <i className={`${icon} text-2xl`}></i>
        </div>

        <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
          {title}
        </h2>

        <p className="text-gray-600 text-center mb-6">
          {message}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            {cancelText}
          </button>
          <ActionButton
            onClick={handleConfirm}
            variant={variant}
            className="flex-1"
          >
            {confirmText}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
