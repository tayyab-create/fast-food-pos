import { useEffect, useMemo, useState } from 'react';
import { getMenu } from '../api/menu';
import { createOrder } from '../api/orders';
import { OrderDetailModal } from '../components/OrderDetailModal';
import type { Discount, MenuItem, Order, OrderItem, OrderType, PaymentMethod } from '../types';

const ALL = 'All';

interface HeldOrder {
  id: string;
  label: string;
  cart: OrderItem[];
  discountType: Discount['type'] | null;
  discountValue: string;
  discountReason: string;
  urgent: boolean;
  orderNote: string;
}

function emptyCartState() {
  return {
    cart: [] as OrderItem[],
    discountType: null as Discount['type'] | null,
    discountValue: '',
    discountReason: '',
    urgent: false,
    orderNote: '',
  };
}

const HELD_ORDERS_KEY = 'pos.heldOrders';

function loadHeldOrders(): HeldOrder[] {
  try {
    const raw = localStorage.getItem(HELD_ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function Cashier() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>(ALL);
  const [search, setSearch] = useState('');
  const [expandedTile, setExpandedTile] = useState<string | null>(null);
  const [openNoteFor, setOpenNoteFor] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState<Discount['type'] | null>(null);
  const [discountValue, setDiscountValue] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [orderNote, setOrderNote] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('takeout');
  const [showMore, setShowMore] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [tenderedStr, setTenderedStr] = useState('');
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>(loadHeldOrders);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  useEffect(() => {
    getMenu().then(setMenu);
  }, []);

  useEffect(() => {
    localStorage.setItem(HELD_ORDERS_KEY, JSON.stringify(heldOrders));
  }, [heldOrders]);

  useEffect(() => {
    if (showPay) {
      setPayMethod('cash');
      setTenderedStr('');
    }
  }, [showPay]);

  const categories = useMemo(() => [ALL, ...new Set(menu.map((i) => i.category))], [menu]);

  const visibleItems = menu
    .filter((i) => i.available !== false)
    .filter((i) => activeCategory === ALL || i.category === activeCategory)
    .filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

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
    addLine(item.name, item.price, item.isCombo ? item.comboItems : undefined);
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
      { id: crypto.randomUUID(), label, cart, discountType, discountValue, discountReason, urgent, orderNote },
    ]);
    const empty = emptyCartState();
    setCart(empty.cart);
    setDiscountType(empty.discountType);
    setDiscountValue(empty.discountValue);
    setDiscountReason(empty.discountReason);
    setUrgent(empty.urgent);
    setOrderNote(empty.orderNote);
    setOrderType('takeout');
    setShowMore(false);
  }

  function resumeOrder(held: HeldOrder) {
    setCart(held.cart);
    setDiscountType(held.discountType);
    setDiscountValue(held.discountValue);
    setDiscountReason(held.discountReason);
    setUrgent(held.urgent);
    setOrderNote(held.orderNote);
    setOrderType('takeout');
    setHeldOrders((prev) => prev.filter((h) => h.id !== held.id));
  }

  function discardHeld(id: string) {
    if (!window.confirm('Discard this held order?')) return;
    setHeldOrders((prev) => prev.filter((h) => h.id !== id));
  }

  const itemCount = cart.reduce((sum, i) => sum + i.qty, 0);
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
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

  const discountAmount = !discountType || !discountValueNum || discountError ? 0
    : discountType === 'percent' ? subtotal * (discountValueNum / 100)
    : discountValueNum;
  const total = Math.max(0, subtotal - discountAmount);
  const discount: Discount | undefined = discountType && discountValueNum && !discountError
    ? { type: discountType, value: discountValueNum, reason: discountReason || undefined }
    : undefined;

  const tenderedNum = Number(tenderedStr) || 0;
  const changeDue = tenderedNum - total;
  const isTenderedSufficient = tenderedStr !== '' && tenderedNum >= total;

  async function checkout(method: PaymentMethod, amountTendered?: number) {
    if (discountError) return;
    const order = await createOrder(cart, {
      discount, urgent, note: orderNote || undefined, paymentMethod: method, orderType, amountTendered,
    });
    setCart([]);
    setDiscountType(null);
    setDiscountValue('');
    setDiscountReason('');
    setUrgent(false);
    setOrderNote('');
    setOrderType('takeout');
    setShowMore(false);
    setShowPay(false);
    setPlacedOrder(order);
  }

  function startNewOrder() {
    setPlacedOrder(null);
  }

  useEffect(() => {
    // Only fires outside a text field, so Enter while typing a note/search/discount
    // value does its normal job (confirm the field) instead of opening Pay.
    // The confirmation modal has its own Enter/Escape handling (OrderDetailModal).
    function onKeyDown(e: KeyboardEvent) {
      if (placedOrder) return;
      if (e.key === 'Escape' && (showPay || showMore)) {
        setShowPay(false);
        setShowMore(false);
        return;
      }
      if (e.key !== 'Enter' || showMore) return;
      const target = e.target as HTMLElement;
      // Buttons already handle their own Enter via the native click; only INPUT/
      // TEXTAREA need excluding to keep typing safe, and BUTTON to avoid a double-fire
      // when focus happens to be on the Pay button itself.
      const handlesOwnEnter = ['INPUT', 'TEXTAREA', 'BUTTON'].includes(target.tagName);
      if (showPay) {
        // The tendered field is itself an input, but Enter there should confirm
        // the payment (the expected next step), not be swallowed like other fields.
        if (handlesOwnEnter && !target.classList.contains('tendered-input')) return;
        if (payMethod === 'cash' && !isTenderedSufficient) return;
        e.preventDefault();
        checkout(payMethod, payMethod === 'cash' ? tenderedNum : undefined);
      } else if (!handlesOwnEnter && cart.length > 0 && !discountError) {
        e.preventDefault();
        setShowPay(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [placedOrder, cart, discountError, discount, urgent, orderNote, orderType, showPay, showMore, payMethod, isTenderedSufficient, tenderedNum]);

  return (
    <div className="pos-layout">
      <div className="pos-menu">
        <input
          className="search-input"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="category-tabs">
          {categories.map((cat) => (
            <button
              key={cat}
              className={cat === activeCategory ? 'active' : ''}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="item-grid">
          {visibleItems.map((item) => (
            <div
              className="item-tile"
              key={item._id}
              role="button"
              tabIndex={0}
              onClick={() => tapTile(item)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && tapTile(item)}
            >
              {item.image && <img className="item-tile-image" src={item.image} alt="" />}
              <span className="name">{item.name}</span>
              {item.isCombo && item.comboItems?.length && (
                <span className="combo-contents">{item.comboItems.join(' + ')}</span>
              )}
              {item.variants?.length ? (
                expandedTile === item._id ? (
                  <span className="variant-row">
                    {item.variants.map((v) => (
                      <button
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
              ) : (
                <span className="price num">${item.price.toFixed(2)}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="ledger-sheet">
        {heldOrders.length > 0 && (
          <div className="held-orders">
            {heldOrders.map((held) => (
              <div className="held-order-chip" key={held.id}>
                <button className="ghost" onClick={() => resumeOrder(held)}>{held.label}</button>
                <button className="icon" aria-label="Discard held order" onClick={() => discardHeld(held.id)}>×</button>
              </div>
            ))}
          </div>
        )}

        <div className="ledger-sheet-header">
          <h2>Order</h2>
          {cart.length > 0 && (
            <span className="order-summary">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
          )}
        </div>

        <div className="option-row compact order-type-row">
          <button
            className={orderType === 'dine-in' ? 'active' : ''}
            onClick={() => setOrderType('dine-in')}
          >
            Dine-in
          </button>
          <button
            className={orderType === 'takeout' ? 'active' : ''}
            onClick={() => setOrderType('takeout')}
          >
            Takeout
          </button>
          <button
            className={orderType === 'delivery' ? 'active' : ''}
            onClick={() => setOrderType('delivery')}
          >
            Delivery
          </button>
        </div>

        <div className="ledger-lines">
          {cart.length === 0 && <p className="empty">Tap a menu item to start an order.</p>}
          {cart.map((line) => (
            <div className="ledger-line" key={line.name}>
              <div className="ledger-line-row">
                <span className="qty-controls">
                  <button className="icon" onClick={() => changeQty(line.name, -1)}>−</button>
                  <input
                    className="qty-input num"
                    type="number"
                    min={1}
                    value={line.qty}
                    onChange={(e) => setQty(line.name, Number(e.target.value))}
                  />
                  <button className="icon" onClick={() => changeQty(line.name, 1)}>+</button>
                </span>
                <span className="name">{line.name}</span>
                <span className="line-total num">${(line.price * line.qty).toFixed(2)}</span>
                <button
                  className={`icon note-btn${line.note ? ' active' : ''}`}
                  aria-label="Add note"
                  onClick={() => setOpenNoteFor(openNoteFor === line.name ? null : line.name)}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <path d="M2.5 3.5h11M2.5 7h11M2.5 10.5h7" strokeLinecap="round" />
                  </svg>
                </button>
                <button className="remove-btn" onClick={() => removeLine(line.name)} aria-label="Remove item">×</button>
              </div>
              {(openNoteFor === line.name || line.note) && (
                <input
                  className="note-input"
                  placeholder="note (e.g. no onions)"
                  autoFocus={openNoteFor === line.name}
                  value={line.note ?? ''}
                  onChange={(e) => setNote(line.name, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <button className="ghost more-toggle" onClick={() => setShowMore(true)}>
            ⋯ More {(urgent || discountType || orderNote) && <span className="more-dot" />}
          </button>
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
          <button className="ghost" disabled={cart.length === 0} onClick={holdOrder}>
            Hold order
          </button>
          <button
            className="primary"
            style={{ flex: 1 }}
            disabled={cart.length === 0 || !!discountError}
            onClick={() => setShowPay(true)}
          >
            Pay
          </button>
        </div>
      </div>

      {showMore && (
        <div className="modal-overlay" onClick={() => setShowMore(false)}>
          <div className="modal more-modal" onClick={(e) => e.stopPropagation()}>
            <h2>More options</h2>
            <label className="checkbox-line">
              <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
              Mark order urgent
            </label>

            <input
              className="order-note-input"
              placeholder="Order note (e.g. customer waiting outside)"
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
            />

            <div className="discount-block">
              <div className="section-header">Discount</div>
              <div className="option-row">
                <button
                  className={discountType === 'percent' ? 'active' : ''}
                  onClick={() => setDiscountType(discountType === 'percent' ? null : 'percent')}
                >
                  Percent
                </button>
                <button
                  className={discountType === 'flat' ? 'active' : ''}
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
                      placeholder={discountType === 'percent' ? '10' : '5.00'}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                    />
                    {discountType === 'percent' && <span className="discount-unit">%</span>}
                  </span>
                  <input
                    className="discount-reason-input"
                    placeholder="Reason (e.g. staff discount)"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                  />
                </div>
              )}
              {discountError && <p className="field-error">{discountError}</p>}
            </div>

            <button className="primary" style={{ marginTop: 14, width: '100%' }} onClick={() => setShowMore(false)}>
              Done
            </button>
          </div>
        </div>
      )}

      {showPay && (
        <div className="modal-overlay" onClick={() => setShowPay(false)}>
          <div className="modal pay-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Take payment</h2>

            <div className="pay-total-display">
              <span>Amount due</span>
              <span className="pay-total-amount">${total.toFixed(2)}</span>
            </div>

            <div className="pay-tabs">
              <button
                className={payMethod === 'cash' ? 'active' : ''}
                onClick={() => setPayMethod('cash')}
              >
                Cash
              </button>
              <button
                className={payMethod === 'card' ? 'active' : ''}
                onClick={() => setPayMethod('card')}
              >
                Card
              </button>
            </div>

            {payMethod === 'cash' ? (
              <div className="pay-cash-section">
                <span className="pay-amount-field">
                  <span className="discount-unit">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="num tendered-input"
                    autoFocus
                    placeholder="0.00"
                    value={tenderedStr}
                    onChange={(e) => setTenderedStr(e.target.value)}
                  />
                </span>
                <div className={`pay-change-row${tenderedStr ? (isTenderedSufficient ? ' positive' : ' negative') : ''}`}>
                  <span>Change due</span>
                  <span className="num">${tenderedStr ? Math.max(0, changeDue).toFixed(2) : '0.00'}</span>
                </div>
                <button
                  className="primary"
                  disabled={!isTenderedSufficient}
                  onClick={() => checkout('cash', tenderedNum)}
                >
                  Confirm payment
                </button>
              </div>
            ) : (
              <div className="pay-card-section">
                <p className="hint">Process the card on the terminal, then confirm here.</p>
                <button className="primary" onClick={() => checkout('card')}>
                  Confirm payment
                </button>
              </div>
            )}

            <button className="ghost" onClick={() => setShowPay(false)}>Cancel</button>
          </div>
        </div>
      )}

      {placedOrder && (
        <OrderDetailModal order={placedOrder} onClose={startNewOrder} confirmed closeLabel="New order" />
      )}
    </div>
  );
}
