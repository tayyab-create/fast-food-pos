import { useEffect } from 'react';
import { updateOrderStatus } from '../api/orders';
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
  const itemCount = order.items.reduce((sum, i) => sum + i.qty, 0);
  const discountAmount = order.discount
    ? order.discount.type === 'percent'
      ? order.subtotal * (order.discount.value / 100)
      : order.discount.value
    : 0;

  async function voidOrder() {
    if (!window.confirm(`Void order #${order.orderNumber}? This can't be undone.`)) return;
    await updateOrderStatus(order._id, 'voided');
    onVoided?.();
    onClose();
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Enter closes too, except when focus is on a button — it already handles its
      // own Enter via a native click (would otherwise double-fire on Void/Close).
      if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal order-confirm-modal" onClick={(e) => e.stopPropagation()}>
        {confirmed ? (
          <>
            <svg className="confirm-check" width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="18" stroke="var(--forest)" strokeWidth="1.5" />
              <path d="M12 20.5l5.5 5.5L28 14" stroke="var(--forest)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h2>Order #{order.orderNumber} placed</h2>
          </>
        ) : (
          <div className="ledger-sheet-header">
            <h2>Order #{order.orderNumber}</h2>
            <span className={`status-pill ${order.status}`}>{order.status}</span>
          </div>
        )}

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
            <span>{order.paymentMethod === 'cash' ? 'Cash' : order.paymentMethod === 'card' ? 'Card' : '—'}</span>
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
            <div className="totals-row">
              <span>Change</span>
              <span className="num">${(order.amountTendered - order.total).toFixed(2)}</span>
            </div>
          )}
        </div>

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
            <button className="ghost danger" onClick={voidOrder}>
              Void order
            </button>
          )}
          <button className="primary" style={{ flex: 1 }} onClick={onClose}>
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
