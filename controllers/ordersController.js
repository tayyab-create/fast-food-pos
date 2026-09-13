const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Counter = require('../models/Counter');

const STATUSES = ['pending', 'preparing', 'ready', 'completed'];

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
    return { item: buildItem(name, exact.price, qty, exact.isCombo ? exact.comboItems : undefined, rawItem?.note) };
  }

  // Otherwise try "Base (Variant)" — how the Cashier names variant cart lines.
  const variantMatch = name.match(/^(.+) \(([^)]+)\)$/);
  if (variantMatch) {
    const [, baseName, variantName] = variantMatch;
    const menuItem = menu.find((m) => m.name === baseName);
    const variant = menuItem?.variants?.find((v) => v.name === variantName);
    if (variant) {
      return { item: buildItem(name, variant.price, qty, undefined, rawItem?.note) };
    }
  }

  return { error: `Unknown menu item "${name}"` };
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

async function create(req, res) {
  const { items: rawItems, discount, urgent, note } = req.body;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return res.status(400).json({ error: 'Order must have at least one item' });
  }

  const menu = await MenuItem.find();
  const items = [];
  for (const rawItem of rawItems) {
    const { item, error } = resolveItem(rawItem, menu);
    if (error) return res.status(400).json({ error });
    items.push(item);
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  if (discount) {
    if (!['percent', 'flat'].includes(discount.type) || !(discount.value > 0)) {
      return res.status(400).json({ error: 'Invalid discount' });
    }
    if (discount.type === 'percent' && discount.value > 100) {
      return res.status(400).json({ error: 'Percent discount cannot exceed 100' });
    }
    if (discount.type === 'flat' && discount.value > subtotal) {
      return res.status(400).json({ error: 'Flat discount cannot exceed the subtotal' });
    }
  }
  const discountAmount = !discount ? 0
    : discount.type === 'percent' ? subtotal * (discount.value / 100)
    : discount.value;
  const total = Math.max(0, subtotal - discountAmount);
  if (discount && typeof discount.reason === 'string') {
    discount.reason = discount.reason.slice(0, 100);
  }
  const counter = await Counter.findOneAndUpdate(
    { _id: 'orderNumber' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const orderNumber = counter.seq;
  const order = await Order.create({ items, subtotal, discount, total, orderNumber, urgent, note });
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
  const order = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { returnDocument: 'after' });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
}

module.exports = { create, list, updateStatus };
