const Order = require('../models/Order');
const { roundMoney } = require('../lib/money');

const DAY_MS = 24 * 60 * 60 * 1000;
const POPULAR_DAYS = 7;
const POPULAR_COUNT = 5;

/** Local midnight of a `YYYY-MM-DD` string, or null when absent/invalid
 * (including a month or day that doesn't exist — no rollover). */
function parseDay(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr ?? '');
  if (!m) return null;
  const [year, month, day] = m.slice(1).map(Number);
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day ? d : null;
}

function tally(map, key, order) {
  const entry = map[key] ?? (map[key] = { count: 0, revenue: 0 });
  entry.count += 1;
  entry.revenue = roundMoney(entry.revenue + order.total);
}

/** Pure aggregation over a set of orders (voided ones included — they are
 * counted separately and excluded from every revenue figure). */
function summarize(orders) {
  const live = orders.filter((o) => o.status !== 'voided');
  const voided = orders.filter((o) => o.status === 'voided');

  const revenue = roundMoney(live.reduce((sum, o) => sum + o.total, 0));
  const discountTotal = roundMoney(live.reduce((sum, o) => sum + (o.discount ? o.subtotal - o.total : 0), 0));
  const itemCounts = {};
  const byPaymentMethod = {};
  const byOrderType = {};
  const byHour = Array.from({ length: 24 }, () => ({ count: 0, revenue: 0 }));
  for (const o of live) {
    for (const i of o.items) itemCounts[i.name] = (itemCounts[i.name] || 0) + i.qty;
    tally(byPaymentMethod, o.paymentMethod ?? 'cash', o);
    tally(byOrderType, o.orderType ?? 'takeout', o);
    const h = new Date(o.createdAt).getHours();
    byHour[h].count += 1;
    byHour[h].revenue = roundMoney(byHour[h].revenue + o.total);
  }
  const topItems = Object.entries(itemCounts)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty);

  return {
    orderCount: live.length,
    revenue,
    avgOrder: live.length ? roundMoney(revenue / live.length) : 0,
    discountTotal,
    voidedCount: voided.length,
    voidedTotal: roundMoney(voided.reduce((sum, o) => sum + o.total, 0)),
    topItems,
    byPaymentMethod,
    byOrderType,
    byHour,
  };
}

/** `?from=YYYY-MM-DD&to=YYYY-MM-DD`, both optional and inclusive (local
 * days). No bounds = all time. */
async function summary(req, res) {
  const from = parseDay(req.query.from);
  const to = parseDay(req.query.to);
  if ((req.query.from && !from) || (req.query.to && !to)) return res.status(400).json({ error: 'Dates must be YYYY-MM-DD' });
  const createdAt = {};
  if (from) createdAt.$gte = from;
  if (to) createdAt.$lt = new Date(to.getTime() + DAY_MS);
  const orders = await Order.find(Object.keys(createdAt).length ? { createdAt } : {});
  res.json(summarize(orders));
}

/** Names of the best-selling items over the last week — the Cashier marks
 * these tiles "Popular". */
async function popular(req, res) {
  const since = new Date(Date.now() - POPULAR_DAYS * DAY_MS);
  const orders = await Order.find({ createdAt: { $gte: since }, status: { $ne: 'voided' } });
  res.json(summarize(orders).topItems.slice(0, POPULAR_COUNT).map((i) => i.name));
}

module.exports = { summary, popular, summarize, parseDay };
