'use client';

import { useEffect, useRef, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  message: string;
  type: ToastType;
  duration?: number;
  onClose?: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, duration = 5000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);
  // Keep the latest onClose without restarting the timer: the provider passes
  // a new function on every render, which used to reset every toast's timer
  // whenever another toast was added.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onCloseRef.current?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  if (!isVisible) return null;

  const typeStyles = {
    success: 'bg-green-600 border-green-700',
    error: 'bg-red-600 border-red-700',
    warning: 'bg-yellow-600 border-yellow-700',
    info: 'bg-blue-600 border-blue-700'
  };

  const iconStyles = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  return (
    // Positioned by the provider's stacking container (not fixed itself, so
    // multiple toasts stack instead of overlapping)
    <div className="animate-in slide-in-from-right">
      <div className={`flex items-center p-4 rounded-lg border shadow-lg text-white ${typeStyles[type]}`}>
        <span className="mr-2 text-lg">{iconStyles[type]}</span>
        <span className="text-sm font-medium">{message}</span>
        <button
          onClick={() => {
            setIsVisible(false);
            onCloseRef.current?.();
          }}
          className="ml-4 text-white hover:text-gray-200 focus:outline-none"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default Toast;