'use client';

import { useEffect, useState } from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastMessage;
  onRemove: (id: string) => void;
}

function Toast({ toast, onRemove }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast, onRemove]);

  const bgColor = {
    success: 'bg-green-900/90 border-green-800',
    error: 'bg-red-900/90 border-red-800',
    info: 'bg-gray-800/90 border-gray-700'
  }[toast.type];

  const textColor = {
    success: 'text-green-400',
    error: 'text-red-400',
    info: 'text-gray-300'
  }[toast.type];

  return (
    <div
      className={`${bgColor} border ${textColor} p-4 rounded-lg shadow-lg backdrop-blur-sm animate-slide-in-right flex items-center justify-between gap-4 min-w-[300px] max-w-[500px]`}
    >
      <p className="text-lg">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-gray-300 hover:text-white transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleToast = (event: CustomEvent<ToastMessage>) => {
      setToasts(prev => [...prev, event.detail]);
    };

    window.addEventListener('showToast', handleToast as EventListener);
    return () => window.removeEventListener('showToast', handleToast as EventListener);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}

// Helper function to show toast
export function showToast(type: 'success' | 'error' | 'info', message: string, duration?: number) {
  const event = new CustomEvent('showToast', {
    detail: {
      id: `${Date.now()}-${Math.random()}`,
      type,
      message,
      duration
    }
  });
  window.dispatchEvent(event);
}