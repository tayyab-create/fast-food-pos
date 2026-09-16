const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Counter = require('../models/Counter');

const STATUSES = ['pending', 'preparing', 'ready', 'completed', 'voided'];

// Prices and combo contents are always re-derived from the menu catalog here —
// never trust price/qty as sent by the client, or an order's total can be
// tampered with (e.g. a negative-qty line to zero out the real total).
function resolveItem(rawItem, menu) {
  const qty = Number(rawItem?.qty);
  const name = String(rawItem?.name ?? '');
  if (!Number.isInteger(qty) || qty <= 0) {
    return { error: `Invalid quantity for "${name}"` };
  }

  // Exact match first — covers plain items and combos, including item names
  // that themselves contain parentheses (e.g. "Chicken Nuggets (6pc)").
  const exact = menu.find((m) => m.name === name && !m.variants?.length);
  if (exact) {
    if (exact.available === false) return { error: `"${name}" is currently unavailable` };
    const comboItems = exact.isCombo ? exact.comboItems?.map(formatComboEntry) : undefined;
    return { item: buildItem(name, exact.price, qty, comboItems, rawItem?.note) };
  }

  // Otherwise try "Base (Variant)" — how the Cashier names variant cart lines.
  const variantMatch = name.match(/^(.+) \(([^)]+)\)$/);
  if (variantMatch) {
    const [, baseName, variantName] = variantMatch;
    const menuItem = menu.find((m) => m.name === baseName);
    const variant = menuItem?.variants?.find((v) => v.name === variantName);
    if (variant) {
      if (menuItem.available === false) return { error: `"${name}" is currently unavailable` };
      return { item: buildItem(name, variant.price, qty, undefined, rawItem?.note) };
    }
  }

  return { error: `Unknown menu item "${name}"` };
}

// Formats a MenuItem combo entry { name, qty } into the display string an
// order's item.comboItems snapshot stores (e.g. "2x Cheeseburger").
function formatComboEntry(entry) {
  return entry.qty > 1 ? `${entry.qty}× ${entry.name}` : entry.name;
}

function buildItem(name, price, qty, comboItems, note) {
  return {
    name,
    price,
    qty,
    note: typeof note === 'string' ? note.slice(0, 200) : undefined,
    comboItems,
  };
}

// Pure — validates a discount against a subtotal and returns { error } or
// { discountAmount, total, reason }. No I/O, so this is unit-testable directly.
function applyDiscount(discount, subtotal) {
  if (!discount) return { discountAmount: 0, total: Math.max(0, subtotal) };
  if (!['percent', 'flat'].includes(discount.type) || !(discount.value > 0)) {
    return { error: 'Invalid discount' };
  }
  if (discount.type === 'percent' && discount.value > 100) {
    return { error: 'Percent discount cannot exceed 100' };
  }
  if (discount.type === 'flat' && discount.value > subtotal) {
    return { error: 'Flat discount cannot exceed the subtotal' };
  }
  const discountAmount = discount.type === 'percent' ? subtotal * (discount.value / 100) : discount.value;
  const reason = typeof discount.reason === 'string' ? discount.reason.slice(0, 100) : discount.reason;
  return { discountAmount, total: Math.max(0, subtotal - discountAmount), reason };
}

const PAYMENT_METHODS = ['cash', 'card'];
const ORDER_TYPES = ['dine-in', 'takeout', 'delivery'];

async function create(req, res) {
  const { items: rawItems, discount, urgent, note, paymentMethod, orderType, amountTendered } = req.body;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return res.status(400).json({ error: 'Order must have at least one item' });
  }
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ error: 'Payment method must be cash or card' });
  }
  if (orderType !== undefined && !ORDER_TYPES.includes(orderType)) {
    return res.status(400).json({ error: 'Invalid order type' });
  }
  if (amountTendered !== undefined && !(Number(amountTendered) >= 0)) {
    return res.status(400).json({ error: 'Invalid amount tendered' });
  }

  const menu = await MenuItem.find();
  const items = [];
  for (const rawItem of rawItems) {
    const { item, error } = resolveItem(rawItem, menu);
    if (error) return res.status(400).json({ error });
    items.push(item);
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const { error: discountError, total, reason } = applyDiscount(discount, subtotal);
  if (discountError) return res.status(400).json({ error: discountError });
  if (discount) discount.reason = reason;
  if (paymentMethod === 'cash' && amountTendered !== undefined && Number(amountTendered) < total) {
    return res.status(400).json({ error: 'Amount tendered is less than the total' });
  }
  const counter = await Counter.findOneAndUpdate(
    { _id: 'orderNumber' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const orderNumber = counter.seq;
  const order = await Order.create({
    items, subtotal, discount, total, orderNumber, urgent, note, paymentMethod, orderType,
    amountTendered: paymentMethod === 'cash' ? amountTendered : undefined,
    statusHistory: [{ status: 'pending' }],
  });
  res.status(201).json(order);
}

async function list(req, res) {
  const status = req.query.status;
  const filter = typeof status === 'string' && STATUSES.includes(status) ? { status } : {};
  res.json(await Order.find(filter).sort({ createdAt: 1 }));
}

async function updateStatus(req, res) {
  if (!STATUSES.includes(req.body.status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status, $push: { statusHistory: { status: req.body.status } } },
    { returnDocument: 'after' }
  );
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
}

module.exports = { create, list, updateStatus, resolveItem, applyDiscount };
