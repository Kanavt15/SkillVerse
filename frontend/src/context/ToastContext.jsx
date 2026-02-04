import React, { createContext, useContext, useState, useCallback } from 'react';
import { Toast, ToastClose, ToastTitle, ToastDescription } from '../components/ui/toast';
import { CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ title, description, variant = 'default', duration = 5000 }) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, title, description, variant }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const toast = {
    success: (title, description) => addToast({ title, description, variant: 'success' }),
    error: (title, description) => addToast({ title, description, variant: 'destructive' }),
    warning: (title, description) => addToast({ title, description, variant: 'warning' }),
    info: (title, description) => addToast({ title, description, variant: 'info' }),
    default: (title, description) => addToast({ title, description, variant: 'default' }),
  };

  const getIcon = (variant) => {
    switch (variant) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'destructive':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-600" />;
      default:
        return null;
    }
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm">
        {toasts.map((toast) => (
          <Toast key={toast.id} variant={toast.variant} className="group">
            <div className="flex gap-3 items-start">
              {getIcon(toast.variant)}
              <div className="flex-1 space-y-1">
                {toast.title && <ToastTitle>{toast.title}</ToastTitle>}
                {toast.description && <ToastDescription>{toast.description}</ToastDescription>}
              </div>
            </div>
            <ToastClose onClick={() => removeToast(toast.id)} />
          </Toast>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
