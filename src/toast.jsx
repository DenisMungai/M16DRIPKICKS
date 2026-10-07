import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef();

  const show = useCallback((message, action) => {
    clearTimeout(timer.current);
    setToast({ message, action, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4" aria-live="polite" role="status">
        {toast && (
          <div key={toast.id} className="pointer-events-auto flex items-center gap-4 rounded-lg bg-ink px-5 py-3 text-small text-white shadow-lg">
            <span>{toast.message}</span>
            {toast.action && <Link to={toast.action.to} className="font-medium underline underline-offset-4">{toast.action.label}</Link>}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
