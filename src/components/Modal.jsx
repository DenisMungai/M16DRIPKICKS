import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const prev = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-ink/50 p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        className={`my-8 w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-xl border border-line bg-card p-6 outline-none`}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-title">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-ink-soft hover:text-ink"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
