import { useState, type ReactNode } from 'react';
import { Modal } from './Modal';

interface ConfirmModalProps {
  /** A question, e.g. "Delete Cheeseburger?" */
  title: string;
  /** One sentence on what happens if they confirm. */
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
  /** May be async; the dialog shows progress and closes itself once it resolves. A throw keeps it open with the error. */
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

/** Red-ruled callout for the irreversible part of the message. */
export function ConfirmWarning({ children }: { children: ReactNode }) {
  return (
    <p className="confirm-warning" role="note">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <path d="M8 2.5l6 11H2z" strokeLinejoin="round" />
        <path d="M8 6.5v3M8 11.6v.2" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

/** The app's one "are you sure?" dialog, replacing window.confirm. The safe
 * button takes focus first so Enter never confirms by accident. */
export function ConfirmModal({ title, message, confirmLabel, cancelLabel = 'Cancel', danger, onConfirm, onClose }: ConfirmModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setSubmitting(false);
    }
  }

  return (
    <Modal title={title} className="confirm-modal" onClose={onClose} closeDisabled={submitting}>
      <div className="confirm-message">{message}</div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="checkout-row">
        <button type="button" className="ghost" autoFocus disabled={submitting} onClick={onClose}>{cancelLabel}</button>
        <button type="button" className={`primary${danger ? ' danger' : ''}`} style={{ flex: 1 }} disabled={submitting} onClick={confirm}>
          {submitting && <span className="spinner" aria-hidden="true" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
