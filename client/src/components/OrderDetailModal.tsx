import { useEffect, useState } from 'react';
import { Modal, ModalBody } from './Modal';
import { VoidOrderModal } from './VoidOrderModal';
import type { Order } from '../types';

interface OrderDetailModalProps {
  order: Order;
  onClose: () => void;
  /** Shown at the top in place of the order's real status — used right after checkout. */
  confirmed?: boolean;
  closeLabel?: string;
  /** Called after a successful void so the caller can refresh its order list. */
  onVoided?: () => void;
}

const VOIDABLE_STATUSES = ['pending', 'preparing', 'ready'];

export function OrderDetailModal({ order, onClose, confirmed, closeLabel = 'Close', onVoided }: OrderDetailModalProps) {
  const [voiding, setVoiding] = useState(false);
  const itemCount = order.items.reduce((sum, i) => sum + i.qty, 0);
  // Derived from the stored totals rather than recomputed from the discount
  // value, so it can never disagree with `total` by a rounding cent.
  const discountAmount = order.discount ? order.subtotal - order.total : 0;

  // Circle draws itself in, then the check strokes in right after it closes —
  // the familiar "approved" sequence. Pure CSS (stroke-dasharray/-dashoffset
  // keyed to each path's own length), off entirely under reduced motion.
  const lead = confirmed ? (
    <svg className="confirm-check" width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle className="confirm-check-circle" cx="20" cy="20" r="18" stroke="var(--forest)" strokeWidth="1.5" pathLength={100} />
      <path className="confirm-check-mark" d="M12 20.5l5.5 5.5L28 14" stroke="var(--forest)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength={100} />
    </svg>
  ) : undefined;

  return (
    <Modal
      title={confirmed ? `Order #${order.orderNumber} placed` : `Order #${order.orderNumber}`}
      className={`order-confirm-modal${confirmed ? ' confirmed' : ''}`}
      onClose={onClose}
      lead={lead}
      headerExtra={confirmed ? undefined : <span className={`status-pill ${order.status}`}>{order.status}</span>}
    >
      <ModalBody>
        {(requestClose) => (
          <>
            <EnterToClose active={!voiding} requestClose={requestClose} />
            <div className="list-header">
              <div className="section-header">Items</div>
              <span className="order-summary">
                {itemCount} item{itemCount !== 1 ? 's' : ''}
              </span>
            </div>
            <ul className="order-confirm-items">
              {order.items.map((item, i) => (
                <li key={i}>
                  <span className="num">{item.qty}×</span>
                  <span className="name">
                    {item.name}
                    {item.note && <span className="muted-text"> — {item.note}</span>}
                  </span>
                  <span className="num">${(item.price * item.qty).toFixed(2)}</span>
                </li>
              ))}
            </ul>

            {order.note && (
              <p className="order-confirm-note">
                <span className="muted-text">Order note: </span>
                {order.note}
              </p>
            )}

            <div className="totals-block">
              <div className="totals-row">
                <span>Subtotal</span>
                <span className="num">${order.subtotal.toFixed(2)}</span>
              </div>
              {order.discount && (
                <div className="totals-row">
                  <span>
                    Discount
                    {order.discount.reason && <span className="muted-text"> ({order.discount.reason})</span>}
                  </span>
                  <span className="num">−${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="totals-row">
                <span>Payment</span>
                <span>{order.paymentMethod === 'cash' ? 'Cash' : 'Card'}</span>
              </div>
              {order.orderType && (
                <div className="totals-row">
                  <span>Order type</span>
                  <span style={{ textTransform: 'capitalize' }}>{order.orderType}</span>
                </div>
              )}
              {order.amountTendered !== undefined && (
                <div className="totals-row">
                  <span>Tendered</span>
                  <span className="num">${order.amountTendered.toFixed(2)}</span>
                </div>
              )}
              <div className="total-row">
                <span>Total</span>
                <span className="num">${order.total.toFixed(2)}</span>
              </div>
              {order.amountTendered !== undefined && (
                <div className="totals-row change-row">
                  <span>Change</span>
                  <span className="num">${(order.amountTendered - order.total).toFixed(2)}</span>
                </div>
              )}
            </div>

            {order.voidReason && (
              <p className="order-confirm-note">
                <span className="muted-text">Void reason: </span>
                {order.voidReason}
              </p>
            )}

            {!confirmed && !!order.statusHistory?.length && (
              <>
                <div className="section-header">Status history</div>
                <ul className="status-history">
                  {order.statusHistory.map((change, i) => (
                    <li key={i}>
                      <span className={`status-pill ${change.status}`}>{change.status}</span>
                      <span className="muted-text">{new Date(change.at).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="checkout-row">
              {!confirmed && VOIDABLE_STATUSES.includes(order.status) && (
                <button type="button" className="ghost danger" onClick={() => setVoiding(true)}>
                  Void order
                </button>
              )}
              <button type="button" className="primary" style={{ flex: 1 }} onClick={requestClose}>
                {closeLabel}
              </button>
            </div>

            {voiding && (
              <VoidOrderModal
                order={order}
                onClose={() => setVoiding(false)}
                onVoided={() => {
                  setVoiding(false);
                  onVoided?.();
                  requestClose();
                }}
              />
            )}
          </>
        )}
      </ModalBody>
    </Modal>
  );
}

/** Enter closes, except when focus is on a button — it already handles its
 * own Enter via a native click (would otherwise double-fire on Void/Close).
 * Escape is handled by Modal itself. Disabled while VoidOrderModal is open
 * on top, so Enter there doesn't also close this modal underneath it. */
function EnterToClose({ active, requestClose }: { active: boolean; requestClose: () => void }) {
  useEffect(() => {
    if (!active) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') requestClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, requestClose]);
  return null;
}
