import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onDismiss: () => void;
}

export function Toast({ message, type = 'info', duration = 3000, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  const bgColor = {
    success: 'bg-green-600',
    error: 'bg-destructive',
    info: 'bg-secondary',
  }[type];

  return (
    <div
      className={cn(
        'fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm text-white shadow-lg animate-in fade-in slide-in-from-bottom-4',
        bgColor
      )}
    >
      {message}
    </div>
  );
}

let toastId = 0;
let listeners: Array<(toast: { id: number; message: string; type: 'success' | 'error' | 'info' }) => void> = [];

export function toast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const id = ++toastId;
  listeners.forEach((l) => l({ id, message, type }));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'success' | 'error' | 'info' }>>([]);

  const addToast = useCallback((t: { id: number; message: string; type: 'success' | 'error' | 'info' }) => {
    setToasts((prev) => [...prev, t]);
  }, []);

  useEffect(() => {
    listeners.push(addToast);
    return () => {
      listeners = listeners.filter((l) => l !== addToast);
    };
  }, [addToast]);

  return (
    <>
      {toasts.map((t) => (
        <Toast
          key={t.id}
          message={t.message}
          type={t.type}
          onDismiss={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
        />
      ))}
    </>
  );
}
