// Toast notification hook for showing success, error, warning, and info messages

import { useState, useCallback } from 'react';
import type { ToastType } from '../components/Toast';

interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const success = useCallback((message: string) => {
    showToast('success', message);
  }, [showToast]);

  const error = useCallback((message: string) => {
    showToast('error', message);
  }, [showToast]);

  const warning = useCallback((message: string) => {
    showToast('warning', message);
  }, [showToast]);

  const info = useCallback((message: string) => {
    showToast('info', message);
  }, [showToast]);

  return {
    toasts,
    removeToast,
    success,
    error,
    warning,
    info,
  };
}
