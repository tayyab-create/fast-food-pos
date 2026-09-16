import { useState } from 'react';
import { updateOrderStatus } from '../api/orders';
import { Modal } from './Modal';
import type { Order } from '../types';

// Mirrors the server's slice(0, 200) in ordersController.updateStatus.
const REASON_MAX = 200;

interface VoidOrderModalProps {
  order: Order;
  onClose: () => void;
  /** Called once the server has recorded the void. */
  onVoided: () => void;
}

/** Confirms a void and captures why — the reason is required by the API and
 * ends up on the order and in its status history. */
export function VoidOrderModal({ order, onClose, onVoided }: VoidOrderModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Give a reason for voiding this order.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await updateOrderStatus(order._id, 'voided', trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not void the order.');
      setSubmitting(false);
      return;
    }
    onVoided();
  }

  return (
    <Modal title={`Void order #${order.orderNumber}`} className="void-modal" onClose={onClose} closeDisabled={submitting}>
      <p className="hint">
        This can't be undone. The order stays in history, marked voided, and drops out of today's revenue.
      </p>
      <label className="field-label">
        <span className="field-label-row">
          Reason
          <span className={`char-count${reason.length >= REASON_MAX ? ' at-limit' : ''}`} aria-live="polite">
            {reason.length}/{REASON_MAX}
          </span>
        </span>
        <textarea
          className={`void-reason${error && !reason.trim() ? ' invalid' : ''}`}
          rows={3}
          maxLength={REASON_MAX}
          autoFocus
          placeholder="e.g. customer changed their mind, keyed the wrong item"
          value={reason}
          disabled={submitting}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="checkout-row">
        <button type="button" className="ghost" disabled={submitting} onClick={onClose}>Keep order</button>
        <button type="button" className="primary danger" style={{ flex: 1 }} disabled={submitting} onClick={confirm}>
          {submitting && <span className="spinner" aria-hidden="true" />}{submitting ? 'Voiding…' : 'Void order'}
        </button>
      </div>
    </Modal>
  );
}
