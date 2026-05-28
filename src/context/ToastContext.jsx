import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prevToasts) => [...prevToasts, { id, message, type }]);
    
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((t) => t.id !== id));
  }, []);

  const showSuccess = useCallback((msg) => addToast(msg, 'success'), [addToast]);
  const showError = useCallback((msg) => addToast(msg, 'error'), [addToast]);
  const showInfo = useCallback((msg) => addToast(msg, 'info'), [addToast]);

  return (
    <ToastContext.Provider value={{ showSuccess, showError, showInfo }}>
      {children}
      
      {/* Toast Render Node Overlay */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span style={{ display: 'inline-flex', flexShrink: 0 }}>
              {toast.type === 'success' && <CheckCircle2 size={18} color="#10B981" />}
              {toast.type === 'error' && <AlertCircle size={18} color="#EF4444" />}
              {toast.type === 'info' && <Info size={18} color="#8B5CF6" />}
            </span>
            <p style={{ fontSize: '0.9rem', fontWeight: 500, flexGrow: 1, color: '#F3F4F6' }}>
              {toast.message}
            </p>
            <button 
              onClick={() => removeToast(toast.id)} 
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#6B7280',
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px',
                borderRadius: '4px',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.color = '#F3F4F6'}
              onMouseLeave={(e) => e.target.style.color = '#6B7280'}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
