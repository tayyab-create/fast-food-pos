import { useEffect, useMemo, useRef, useState } from 'react';
import { getMenu } from '../api/menu';
import { createOrder } from '../api/orders';
import { getPopularItems } from '../api/reports';
import { comboContentsSummary, comboItemsTotal } from '../comboFormat';
import { isMoneyInput, roundMoney } from '../money';
import { ConfirmModal } from '../components/ConfirmModal';
import { Modal } from '../components/Modal';
import { OrderDetailModal } from '../components/OrderDetailModal';
import { PayModal } from '../components/PayModal';
import type { Discount, MenuItem, Order, OrderItem, OrderType, PaymentMethod } from '../types';

const ALL = 'All';

/** Everything that makes up an in-progress order — what gets stashed on Hold. */
interface CartState {
  cart: OrderItem[];
  discountType: Discount['type'] | null;
  discountValue: string;
  discountReason: string;
  urgent: boolean;
  orderNote: string;
  orderType: OrderType;
}

const EMPTY_CART: CartState = {
  cart: [],
  discountType: null,
  discountValue: '',
  discountReason: '',
  urgent: false,
  orderNote: '',
  orderType: 'dine-in',
};

interface HeldOrder extends CartState {
  id: string;
  label: string;
}

const HELD_ORDERS_KEY = 'pos.heldOrders';

function loadHeldOrders(): HeldOrder[] {
  try {
    const raw = localStorage.getItem(HELD_ORDERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    // Older holds predate orderType; fill it so resume never reads undefined.
    return Array.isArray(parsed) ? parsed.map((h) => ({ ...EMPTY_CART, ...h })) : [];
  } catch {
    return [];
  }
}

// crypto.randomUUID is only defined in secure contexts, and a till on plain
// http://<lan-ip> isn't one — fall back rather than crash "Hold order".
function newId(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function Cashier() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [popular, setPopular] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>(ALL);
  const [search, setSearch] = useState('');
  const [expandedTile, setExpandedTile] = useState<string | null>(null);
  const [openNoteFor, setOpenNoteFor] = useState<string | null>(null);

  const [cart, setCart] = useState<OrderItem[]>(EMPTY_CART.cart);
  const [discountType, setDiscountType] = useState(EMPTY_CART.discountType);
  const [discountValue, setDiscountValue] = useState(EMPTY_CART.discountValue);
  const [discountReason, setDiscountReason] = useState(EMPTY_CART.discountReason);
  const [urgent, setUrgent] = useState(EMPTY_CART.urgent);
  const [orderNote, setOrderNote] = useState(EMPTY_CART.orderNote);
  const [orderType, setOrderType] = useState(EMPTY_CART.orderType);

  const [showMore, setShowMore] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>(loadHeldOrders);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  useEffect(() => {
    getMenu().then(setMenu).catch((err) => setMenuError(err instanceof Error ? err.message : 'Could not load the menu.'));
    // Purely decorative — a failure just means no "Popular" badges.
    getPopularItems().then(setPopular).catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem(HELD_ORDERS_KEY, JSON.stringify(heldOrders));
  }, [heldOrders]);

  function applyCartState(state: CartState) {
    setCart(state.cart);
    setDiscountType(state.discountType);
    setDiscountValue(state.discountValue);
    setDiscountReason(state.discountReason);
    setUrgent(state.urgent);
    setOrderNote(state.orderNote);
    setOrderType(state.orderType);
    setShowMore(false);
  }

  const categories = useMemo(() => [ALL, ...new Set(menu.map((i) => i.category))], [menu]);

  const visibleItems = menu
    .filter((i) => i.available !== false)
    .filter((i) => activeCategory === ALL || i.category === activeCategory)
    .filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));

  // Sold as "Name" or "Name (Size)" — popular names come back in order-line form.
  const isPopular = (item: MenuItem) =>
    popular.some((name) => name === item.name || name.startsWith(`${item.name} (`));

  function addLine(name: string, price: number, comboItems?: string[]) {
    setCart((prev) => {
      const existing = prev.find((i) => i.name === name);
      if (existing) {
        return prev.map((i) => (i.name === name ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { name, price, qty: 1, comboItems }];
    });
  }

  function tapTile(item: MenuItem) {
    if (item.variants?.length) {
      setExpandedTile((prev) => (prev === item._id ? null : item._id));
      return;
    }
    const comboItems = item.isCombo && item.comboItems?.length
      ? comboContentsSummary(item.comboItems, menu).split(' + ')
      : undefined;
    addLine(item.name, item.price, comboItems);
  }

  function pickVariant(item: MenuItem, variantName: string, price: number) {
    addLine(`${item.name} (${variantName})`, price);
    setExpandedTile(null);
  }

  function changeQty(name: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => (i.name === name ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    );
  }

  function setQty(name: string, qty: number) {
    if (!(qty > 0)) return;
    setCart((prev) => prev.map((i) => (i.name === name ? { ...i, qty } : i)));
  }

  function removeLine(name: string) {
    setCart((prev) => prev.filter((i) => i.name !== name));
  }

  function setNote(name: string, note: string) {
    setCart((prev) => prev.map((i) => (i.name === name ? { ...i, note } : i)));
  }

  function holdOrder() {
    if (cart.length === 0) return;
    const label = cart[0].name + (cart.length > 1 ? ` +${cart.length - 1} more` : '');
    setHeldOrders((prev) => [
      ...prev,
      { id: newId(), label, cart, discountType, discountValue, discountReason, urgent, orderNote, orderType },
    ]);
    applyCartState(EMPTY_CART);
  }

  function resumeOrder(held: HeldOrder) {
    applyCartState(held);
    setHeldOrders((prev) => prev.filter((h) => h.id !== held.id));
  }

  const [discardTarget, setDiscardTarget] = useState<HeldOrder | null>(null);
  function discardHeld(id: string) {
    setHeldOrders((prev) => prev.filter((h) => h.id !== id));
  }

  const itemCount = cart.reduce((sum, i) => sum + i.qty, 0);
  const subtotal = roundMoney(cart.reduce((sum, i) => sum + i.price * i.qty, 0));
  const discountValueNum = Number(discountValue) || 0;

  let discountError: string | null = null;
  if (discountType && discountValue !== '') {
    if (discountValueNum <= 0) {
      discountError = 'Must be greater than 0.';
    } else if (discountType === 'percent' && discountValueNum > 100) {
      discountError = 'Percent discount can\'t exceed 100.';
    } else if (discountType === 'flat' && discountValueNum > subtotal) {
      discountError = 'Flat discount can\'t exceed the subtotal.';
    }
  }

  // Same rounding as the server's applyDiscount, so the preview never differs
  // from the stored total by a cent.
  const discountAmount = !discountType || !discountValueNum || discountError ? 0
    : roundMoney(discountType === 'percent' ? subtotal * (discountValueNum / 100) : discountValueNum);
  const total = Math.max(0, roundMoney(subtotal - discountAmount));
  const discount: Discount | undefined = discountType && discountValueNum && !discountError
    ? { type: discountType, value: discountValueNum, reason: discountReason || undefined }
    : undefined;
  const canPay = cart.length > 0 && !discountError;

  // Throws on failure so PayModal can show the error and stay open; the cart is
  // only cleared once the server has actually accepted the order.
  async function checkout(method: PaymentMethod, amountTendered?: number) {
    const order = await createOrder(cart, {
      discount, urgent, note: orderNote || undefined, paymentMethod: method, orderType, amountTendered,
    });
    applyCartState(EMPTY_CART);
    setShowPay(false);
    setPlacedOrder(order);
  }

  // Page-level shortcut: Enter opens Pay. Read through a ref so the single
  // listener always sees current state without re-subscribing on every
  // keystroke. Modals handle their own keys (and Escape) while open.
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e) => {
    if (placedOrder || showPay || showMore || e.key !== 'Enter') return;
    // Inputs and buttons already do their own thing on Enter.
    if (['INPUT', 'TEXTAREA', 'BUTTON'].includes((e.target as HTMLElement).tagName)) return;
    if (canPay) {
      e.preventDefault();
      setShowPay(true);
    }
  };
  useEffect(() => {
    const listener = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  return (
    <div className="pos-layout">
      <div className="pos-menu">
        <input
          className="search-input"
          placeholder="Search products…"
          aria-label="Search products"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="category-tabs">
          {categories.map((cat) => (
            <button
              type="button"
              key={cat}
              className={cat === activeCategory ? 'active' : ''}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {menuError && <p className="field-error" role="alert">{menuError}</p>}

        <div className="item-grid">
          {visibleItems.map((item) => {
            const comboSeparateTotal = item.isCombo && item.comboItems?.length
              ? comboItemsTotal(item.comboItems, menu)
              : 0;
            return (
              <div
                className="item-tile"
                key={item._id}
                role="button"
                tabIndex={0}
                onClick={() => tapTile(item)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && tapTile(item)}
              >
                {item.image && <img className="item-tile-image" src={item.image} alt="" />}
                {item.pinned && (
                  <span className="tile-pin" title="Pinned">
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                      <path d="M9.5 1.5l5 5-1.4 1.4-.9-.3-2.6 2.6.3 2.5L8.5 14 5.6 11.1 2 14.7l-.7-.7 3.6-3.6L2 7.5l1.3-1.4 2.5.3 2.6-2.6-.3-.9z" />
                    </svg>
                    <span className="visually-hidden">Pinned</span>
                  </span>
                )}
                {(isPopular(item) || !!item.tags?.length) && (
                  <span className="tile-tags">
                    {isPopular(item) && <span className="tile-tag popular">Popular</span>}
                    {item.tags?.map((t) => <span className="tile-tag" key={t}>{t}</span>)}
                  </span>
                )}
                <span className="name">{item.name}</span>
                {item.isCombo && !!item.comboItems?.length && (
                  <span className="combo-contents">{comboContentsSummary(item.comboItems, menu)}</span>
                )}
                {item.variants?.length ? (
                  expandedTile === item._id ? (
                    <span className="variant-row">
                      {item.variants.map((v) => (
                        <button
                          type="button"
                          key={v.name}
                          onClick={(e) => {
                            e.stopPropagation();
                            pickVariant(item, v.name, v.price);
                          }}
                        >
                          {v.name} ${v.price.toFixed(2)}
                        </button>
                      ))}
                    </span>
                  ) : (
                    <span className="price num">from ${Math.min(...item.variants.map((v) => v.price)).toFixed(2)}</span>
                  )
                ) : comboSeparateTotal > item.price ? (
                  <span className="price num combo-price">
                    <span className="combo-strike">${comboSeparateTotal.toFixed(2)}</span>
                    ${item.price.toFixed(2)}
                  </span>
                ) : (
                  <span className="price num">${item.price.toFixed(2)}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="ledger-sheet">
        {heldOrders.length > 0 && (
          <div className="held-orders">
            {heldOrders.map((held) => (
              <div className="held-order-chip" key={held.id}>
                <button type="button" className="ghost" onClick={() => resumeOrder(held)}>{held.label}</button>
                <button type="button" className="icon" aria-label="Discard held order" onClick={() => setDiscardTarget(held)}>×</button>
              </div>
            ))}
          </div>
        )}

        <div className="ledger-sheet-header">
          <h2>Order</h2>
          {/* Status only — the control lives with the other order options below. */}
          {urgent && <span className="urgent-tag">Urgent</span>}
          {cart.length > 0 && (
            <span className="order-summary">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
          )}
        </div>

        <div className="option-row compact order-type-row" role="group" aria-label="Order type">
          {(['dine-in', 'takeout', 'delivery'] as const).map((type) => (
            <button
              type="button"
              key={type}
              className={orderType === type ? 'active' : ''}
              aria-pressed={orderType === type}
              onClick={() => setOrderType(type)}
            >
              {type === 'dine-in' ? 'Dine-in' : type === 'takeout' ? 'Takeout' : 'Delivery'}
            </button>
          ))}
        </div>

        <div className="ledger-lines">
          {cart.length === 0 && <p className="empty">Tap a menu item to start an order.</p>}
          {cart.map((line) => (
            <div className="ledger-line" key={line.name}>
              <div className="ledger-line-row">
                <span className="qty-controls">
                  <button type="button" className="icon" aria-label={`Decrease ${line.name}`} onClick={() => changeQty(line.name, -1)}>−</button>
                  <input
                    className="qty-input num"
                    type="number"
                    min={1}
                    aria-label={`Quantity of ${line.name}`}
                    value={line.qty}
                    onChange={(e) => setQty(line.name, Number(e.target.value))}
                  />
                  <button type="button" className="icon" aria-label={`Increase ${line.name}`} onClick={() => changeQty(line.name, 1)}>+</button>
                </span>
                <span className="name">{line.name}</span>
                <span className="line-total num">${(line.price * line.qty).toFixed(2)}</span>
                <button
                  type="button"
                  className={`icon note-btn${line.note ? ' active' : ''}`}
                  aria-label={`Note for ${line.name}`}
                  onClick={() => setOpenNoteFor(openNoteFor === line.name ? null : line.name)}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                    <path d="M2.5 3.5h11M2.5 7h11M2.5 10.5h7" strokeLinecap="round" />
                  </svg>
                </button>
                <button type="button" className="remove-btn" onClick={() => removeLine(line.name)} aria-label={`Remove ${line.name}`}>×</button>
              </div>
              {(openNoteFor === line.name || line.note) && (
                <input
                  className="note-input"
                  placeholder="note (e.g. no onions)"
                  aria-label={`Note for ${line.name}`}
                  autoFocus={openNoteFor === line.name}
                  value={line.note ?? ''}
                  onChange={(e) => setNote(line.name, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <div className="cart-options-row">
            <button type="button" className="ghost more-toggle" onClick={() => setShowMore(true)}>
              ⋯ More {(discountType || orderNote) && <span className="more-dot" aria-label="options set" />}
            </button>
            <button type="button" className="ghost" aria-pressed={urgent} onClick={() => setUrgent((u) => !u)}>
              ⚑ {urgent ? 'Remove urgent' : 'Mark urgent'}
            </button>
          </div>
        )}

        <div className="totals-block">
          <div className="totals-row">
            <span>Subtotal</span>
            <span className="num">${subtotal.toFixed(2)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="totals-row">
              <span>Discount</span>
              <span className="num">−${discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="total-row">
            <span>Total</span>
            <span className="num">${total.toFixed(2)}</span>
          </div>
        </div>

        <div className="checkout-row">
          <button type="button" className="ghost" disabled={cart.length === 0} onClick={holdOrder}>
            Hold order
          </button>
          <button type="button" className="primary" style={{ flex: 1 }} disabled={!canPay} onClick={() => setShowPay(true)}>
            Pay
          </button>
        </div>
      </div>

      {showMore && (
        <Modal title="More options" className="more-modal" onClose={() => setShowMore(false)}>
          <input
            className="order-note-input"
            placeholder="Order note (e.g. customer waiting outside)"
            aria-label="Order note"
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value)}
          />

          <div className="discount-block">
            <div className="section-header">Discount</div>
            <div className="option-row" role="group" aria-label="Discount type">
              <button
                type="button"
                className={discountType === 'percent' ? 'active' : ''}
                aria-pressed={discountType === 'percent'}
                onClick={() => setDiscountType(discountType === 'percent' ? null : 'percent')}
              >
                Percent
              </button>
              <button
                type="button"
                className={discountType === 'flat' ? 'active' : ''}
                aria-pressed={discountType === 'flat'}
                onClick={() => setDiscountType(discountType === 'flat' ? null : 'flat')}
              >
                Flat $
              </button>
            </div>
            {discountType && (
              <div className="discount-value">
                <span className={`discount-unit-field${discountError ? ' invalid' : ''}`}>
                  {discountType === 'flat' && <span className="discount-unit">$</span>}
                  <input
                    type="number"
                    min="0"
                    max={discountType === 'percent' ? 100 : undefined}
                    className="num"
                    autoFocus
                    aria-label="Discount amount"
                    placeholder={discountType === 'percent' ? '10' : '5.00'}
                    value={discountValue}
                    onChange={(e) => isMoneyInput(e.target.value) && setDiscountValue(e.target.value)}
                  />
                  {discountType === 'percent' && <span className="discount-unit">%</span>}
                </span>
                <input
                  className="discount-reason-input"
                  placeholder="Reason (e.g. staff discount)"
                  aria-label="Discount reason"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                />
              </div>
            )}
            {discountError && <p className="field-error">{discountError}</p>}
          </div>

          <button type="button" className="primary" style={{ marginTop: 14, width: '100%' }} onClick={() => setShowMore(false)}>
            Done
          </button>
        </Modal>
      )}

      {showPay && <PayModal total={total} onConfirm={checkout} onClose={() => setShowPay(false)} />}

      {discardTarget && (
        <ConfirmModal
          title="Discard held order?"
          danger
          confirmLabel="Discard"
          cancelLabel="Keep it"
          message={<p>"{discardTarget.label}" is only saved on this till. Discarding it can't be undone.</p>}
          onClose={() => setDiscardTarget(null)}
          onConfirm={() => discardHeld(discardTarget.id)}
        />
      )}

      {placedOrder && (
        <OrderDetailModal order={placedOrder} onClose={() => setPlacedOrder(null)} confirmed closeLabel="New order" />
      )}
    </div>
  );
}
