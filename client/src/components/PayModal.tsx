import { useEffect, useState } from 'react';
import { isMoneyInput } from '../money';
import { Modal, ModalBody } from './Modal';
import type { PaymentMethod } from '../types';

interface PayModalProps {
  total: number;
  /** Resolves once the order is placed; a rejection is shown inline and leaves the modal open. */
  onConfirm: (method: PaymentMethod, amountTendered?: number) => Promise<void>;
  onClose: () => void;
}

/** Tender step: amount due, Cash/Card tabs, cash-tendered + change-due, and a
 * single confirm that can't double-fire — owns its own submitting/error state
 * so the cart page doesn't have to. */
export function PayModal({ total, onConfirm, onClose }: PayModalProps) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [tenderedStr, setTenderedStr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tendered = Number(tenderedStr) || 0;
  const changeDue = tendered - total;
  const cashReady = tenderedStr !== '' && tendered >= total;
  const canConfirm = !submitting && (method === 'card' || cashReady);

  async function confirm() {
    if (!canConfirm) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(method, method === 'cash' ? tendered : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place the order.');
      setSubmitting(false);
    }
  }

  useEffect(() => {
    // Enter confirms from anywhere except a button (which already clicks itself) —
    // including the tendered field, where Enter is the natural "done" key.
    // Escape is handled by Modal.
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') {
        e.preventDefault();
        confirm();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <Modal title="Take payment" className="pay-modal" onClose={onClose} closeDisabled={submitting}>
      <ModalBody>
        {(requestClose) => (
          <>
            <div className="pay-total-display">
              <span>Amount due</span>
              <span className="pay-total-amount">${total.toFixed(2)}</span>
            </div>

            <div className="pay-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={method === 'cash'} className={method === 'cash' ? 'active' : ''} onClick={() => setMethod('cash')}>
                Cash
              </button>
              <button type="button" role="tab" aria-selected={method === 'card'} className={method === 'card' ? 'active' : ''} onClick={() => setMethod('card')}>
                Card
              </button>
            </div>

            {method === 'cash' ? (
              <div className="pay-cash-section">
                <div className="pay-tender-row">
                  <span className="pay-amount-field">
                    <span className="discount-unit">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="num"
                      autoFocus
                      placeholder="0.00"
                      aria-label="Amount tendered"
                      value={tenderedStr}
                      disabled={submitting}
                      onChange={(e) => isMoneyInput(e.target.value) && setTenderedStr(e.target.value)}
                    />
                  </span>
                  <button
                    type="button"
                    className="ghost"
                    disabled={submitting}
                    title="Customer paid the exact amount"
                    onClick={() => setTenderedStr(total.toFixed(2))}
                  >
                    Exact
                  </button>
                </div>
                <div className={`pay-change-row${tenderedStr ? (cashReady ? ' positive' : ' negative') : ''}`}>
                  <span>Change due</span>
                  <span className="num">${tenderedStr ? Math.max(0, changeDue).toFixed(2) : '0.00'}</span>
                </div>
                <button type="button" className="primary" disabled={!canConfirm} onClick={confirm}>
                  {submitting && <span className="spinner" aria-hidden="true" />}{submitting ? 'Placing order…' : 'Confirm payment'}
                </button>
              </div>
            ) : (
              <div className="pay-card-section">
                <p className="hint">Process the card on the terminal, then confirm here.</p>
                <button type="button" className="primary" disabled={!canConfirm} onClick={confirm}>
                  {submitting && <span className="spinner" aria-hidden="true" />}{submitting ? 'Placing order…' : 'Confirm payment'}
                </button>
              </div>
            )}

            {error && <p className="field-error" role="alert">{error}</p>}

            <button type="button" className="ghost" disabled={submitting} onClick={requestClose}>Cancel</button>
          </>
        )}
      </ModalBody>
    </Modal>
  );
}
