import { useEffect, useMemo, useState } from 'react';
import { getMenu } from '../api/menu';
import { createOrder } from '../api/orders';
import type { Discount, MenuItem, OrderItem } from '../types';

const ALL = 'All';

export function Cashier() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>(ALL);
  const [search, setSearch] = useState('');
  const [expandedTile, setExpandedTile] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState<Discount['type'] | null>(null);
  const [discountValue, setDiscountValue] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [orderNote, setOrderNote] = useState('');

  useEffect(() => {
    getMenu().then(setMenu);
  }, []);

  const categories = useMemo(() => [ALL, ...new Set(menu.map((i) => i.category))], [menu]);

  const visibleItems = menu
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

  function removeLine(name: string) {
    setCart((prev) => prev.filter((i) => i.name !== name));
  }

  function setNote(name: string, note: string) {
    setCart((prev) => prev.map((i) => (i.name === name ? { ...i, note } : i)));
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

  async function checkout() {
    if (discountError) return;
    await createOrder(cart, { discount, urgent, note: orderNote || undefined });
    setCart([]);
    setDiscountType(null);
    setDiscountValue('');
    setDiscountReason('');
    setUrgent(false);
    setOrderNote('');
    alert('Order placed!');
  }

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
        <div className="ledger-sheet-header">
          <h2>Order</h2>
          {cart.length > 0 && (
            <span className="order-summary">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="ledger-lines">
          {cart.length === 0 && <p className="empty">Tap a menu item to start an order.</p>}
          {cart.map((line) => (
            <div className="ledger-line" key={line.name}>
              <div className="ledger-line-row">
                <span className="qty-controls">
                  <button className="icon" onClick={() => changeQty(line.name, -1)}>−</button>
                  <span className="num">{line.qty}</span>
                  <button className="icon" onClick={() => changeQty(line.name, 1)}>+</button>
                </span>
                <span className="name">{line.name}</span>
                <span className="line-total num">${(line.price * line.qty).toFixed(2)}</span>
                <button className="remove-btn" onClick={() => removeLine(line.name)} aria-label="Remove item">×</button>
              </div>
              <input
                className="note-input"
                placeholder="note (e.g. no onions)"
                value={line.note ?? ''}
                onChange={(e) => setNote(line.name, e.target.value)}
              />
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <div className="order-options">
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
          </div>
        )}

        {cart.length > 0 && (
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
                <input
                  type="number"
                  min="0"
                  max={discountType === 'percent' ? 100 : undefined}
                  className={discountError ? 'invalid' : undefined}
                  placeholder={discountType === 'percent' ? 'e.g. 10' : 'e.g. 5.00'}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                />
              </div>
            )}
            {discountError && <p className="field-error">{discountError}</p>}
            {discountType && (
              <input
                className="discount-reason-input"
                placeholder="Reason (e.g. staff discount)"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
              />
            )}
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

        <button className="primary" style={{ width: '100%', marginTop: 14 }} disabled={cart.length === 0 || !!discountError} onClick={checkout}>
          Checkout
        </button>
      </div>
    </div>
  );
}
