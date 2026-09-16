import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export interface ToastOptions {
  kind?: 'success' | 'error';
  /** Label + handler for an inline action, e.g. "Undo". */
  action?: { label: string; onClick: () => void | Promise<void> };
  /** Auto-dismiss delay; errors and toasts with an action linger longer. */
  duration?: number;
}

interface ToastState extends ToastOptions {
  id: number;
  message: string;
  leaving: boolean;
}

type Show = (message: string, options?: ToastOptions) => void;

const ToastContext = createContext<Show>(() => {});

/** `const toast = useToast(); toast('Saved'); toast('Failed', { kind: 'error' })` */
export function useToast(): Show {
  return useContext(ToastContext);
}

const EXIT_MS = 180;
let nextId = 1;

/** One toast at a time, bottom-centre: slides up, waits, slides away. A new
 * toast replaces the current one rather than stacking. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setToast((t) => (t ? { ...t, leaving: true } : t));
    timer.current = window.setTimeout(() => setToast(null), EXIT_MS);
  }, []);

  const show = useCallback<Show>((message, options = {}) => {
    window.clearTimeout(timer.current);
    const duration = options.duration ?? (options.kind === 'error' || options.action ? 6000 : 3000);
    setToast({ id: nextId++, message, leaving: false, ...options });
    timer.current = window.setTimeout(dismiss, duration);
  }, [dismiss]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function act() {
    if (!toast?.action) return;
    dismiss();
    await toast.action.onClick();
  }

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toast && (
          <div
            key={toast.id}
            className={`toast ${toast.kind ?? 'success'}${toast.leaving ? ' leaving' : ''}`}
            role={toast.kind === 'error' ? 'alert' : 'status'}
          >
            <span className="toast-icon" aria-hidden="true">
              {toast.kind === 'error' ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8.5l3.2 3L13 4.5" />
                </svg>
              )}
            </span>
            <span className="toast-message">{toast.message}</span>
            {toast.action && (
              <button type="button" className="toast-action" onClick={act}>{toast.action.label}</button>
            )}
            <button type="button" className="toast-close" aria-label="Dismiss" onClick={dismiss}>×</button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
