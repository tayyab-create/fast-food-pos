import { useEffect, useId, useRef, type ReactNode } from 'react';

// Ids of the modals currently mounted, oldest first — only the topmost one
// reacts to Escape, so a modal opened from inside another closes alone.
const openStack: string[] = [];

interface ModalProps {
  title: string;
  onClose: () => void;
  /** Blocks every way of closing (×, overlay, Escape) — e.g. while a request is in flight. */
  closeDisabled?: boolean;
  className?: string;
  /** Rendered above the header, e.g. the checkout confirmation tick. */
  lead?: ReactNode;
  /** Rendered in the header between the title and the × — e.g. a status pill. */
  headerExtra?: ReactNode;
  children: ReactNode;
}

/** The one dialog shell: overlay, panel, title, × button, and Escape/overlay
 * closing. Anything modal in the app goes through this. */
export function Modal({ title, onClose, closeDisabled = false, className, lead, headerExtra, children }: ModalProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);
  onCloseRef.current = onClose;
  closeDisabledRef.current = closeDisabled;

  useEffect(() => {
    openStack.push(id);
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && openStack.at(-1) === id && !closeDisabledRef.current) onCloseRef.current();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openStack.splice(openStack.indexOf(id), 1);
    };
  }, [id]);

  return (
    <div className="modal-overlay" onClick={() => !closeDisabled && onClose()}>
      <div
        className={`modal${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        {lead}
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          {headerExtra}
          <button type="button" className="modal-close" aria-label="Close" disabled={closeDisabled} onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
