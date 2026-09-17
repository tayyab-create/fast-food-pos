import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';

// Ids of the modals currently mounted, oldest first — only the topmost one
// reacts to Escape, so a modal opened from inside another closes alone.
const openStack: string[] = [];

// Publishes the enclosing Modal's soft-close so a Cancel/"Keep it"/success
// button inside `children` can trigger the same fade instead of calling the
// raw onClose prop and unmounting instantly. Defaults to a no-op so a
// component that uses the hook outside a Modal doesn't crash — it just
// gets an inert close.
const ModalCloseContext = createContext<() => void>(() => {});

/** The soft-close function for the nearest enclosing `<Modal>`. Use this
 * instead of calling an `onClose` prop directly from a button *inside* a
 * modal's content (Cancel, "Keep it", a success path) — calling the prop
 * itself skips the fade this component exists to provide. Only callable
 * from something actually rendered inside a `<Modal>` (`ModalBody` is the
 * usual way to reach it, since a modal's own top-level function body runs
 * before its `<Modal>` JSX exists to provide the context). */
export function useModalClose(): () => void {
  return useContext(ModalCloseContext);
}

/** Render-prop wrapper so a modal's content can reach `useModalClose()` —
 * needed because that hook reads context from the `<Modal>` this renders
 * inside, which doesn't exist yet while the outer component's own function
 * body (where `<Modal>{...}</Modal>` gets built) is running. */
export function ModalBody({ children }: { children: (requestClose: () => void) => ReactNode }) {
  return <>{children(useModalClose())}</>;
}

// Matches .modal-overlay.leaving / .modal.leaving's transition duration —
// the real onClose (which unmounts this component) fires after this delay,
// so the fade/settle plays out instead of the dialog vanishing instantly.
// Skipped under reduced motion: there's no visible animation to wait for,
// so waiting anyway would just be a dead pause before the dialog closes.
const EXIT_MS = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 150;

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
 * closing. Anything modal in the app goes through this.
 *
 * Closing is soft, not instant: every close path (×, overlay click, Escape)
 * plays a short fade/settle-down first and only calls the caller's onClose
 * — which unmounts this component — once that finishes, so the dialog
 * never just vanishes mid-frame. */
export function Modal({ title, onClose, closeDisabled = false, className, lead, headerExtra, children }: ModalProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);
  onCloseRef.current = onClose;
  closeDisabledRef.current = closeDisabled;
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

  function requestClose() {
    if (closeDisabledRef.current || closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => onCloseRef.current(), EXIT_MS);
  }

  useEffect(() => {
    openStack.push(id);
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && openStack.at(-1) === id && !closeDisabledRef.current) requestClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openStack.splice(openStack.indexOf(id), 1);
      window.clearTimeout(closeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- requestClose reads refs, doesn't need to be a dep
  }, [id]);

  return (
    <div className={`modal-overlay${closing ? ' leaving' : ''}`} onClick={requestClose}>
      <div
        className={`modal${className ? ` ${className}` : ''}${closing ? ' leaving' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        {lead}
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          {headerExtra}
          <button type="button" className="modal-close" aria-label="Close" disabled={closeDisabled} onClick={requestClose}>
            ×
          </button>
        </div>
        <ModalCloseContext.Provider value={requestClose}>{children}</ModalCloseContext.Provider>
      </div>
    </div>
  );
}
