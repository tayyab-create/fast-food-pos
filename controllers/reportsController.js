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

const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function tally(map, key, amount) {
  const entry = map[key] ?? (map[key] = { count: 0, revenue: 0 });
  entry.count += 1;
  entry.revenue = roundMoney(entry.revenue + amount);
}

/** Pure aggregation over a set of orders (voided ones included — they are
 * counted separately and excluded from every revenue figure). */
function summarize(orders) {
  const live = orders.filter((o) => o.status !== 'voided');
  const voided = orders.filter((o) => o.status === 'voided');

  const revenue = roundMoney(live.reduce((sum, o) => sum + o.total, 0));
  const discountTotal = roundMoney(live.reduce((sum, o) => sum + (o.discount ? o.subtotal - o.total : 0), 0));
  const itemStats = {};
  const byPaymentMethod = {};
  const byOrderType = {};
  const byDayMap = {};
  const discountsByReason = {};
  const byHour = Array.from({ length: 24 }, () => ({ count: 0, revenue: 0 }));
  const byWeekday = Array.from({ length: 7 }, () => ({ count: 0, revenue: 0 }));
  let cashTendered = 0;
  let changeGiven = 0;
  let comboLines = 0;
  let totalLines = 0;

  for (const o of live) {
    for (const i of o.items) {
      const stat = itemStats[i.name] ?? (itemStats[i.name] = { name: i.name, qty: 0, revenue: 0, orders: 0 });
      stat.qty += i.qty;
      stat.revenue = roundMoney(stat.revenue + i.price * i.qty);
      stat.orders += 1;
      totalLines += 1;
      if (i.comboItems?.length) comboLines += 1;
    }
    tally(byPaymentMethod, o.paymentMethod ?? 'cash', o.total);
    tally(byOrderType, o.orderType ?? 'takeout', o.total);
    const at = new Date(o.createdAt);
    tally(byDayMap, isoDay(at), o.total);
    byHour[at.getHours()].count += 1;
    byHour[at.getHours()].revenue = roundMoney(byHour[at.getHours()].revenue + o.total);
    byWeekday[at.getDay()].count += 1;
    byWeekday[at.getDay()].revenue = roundMoney(byWeekday[at.getDay()].revenue + o.total);
    if (o.paymentMethod === 'cash' && o.amountTendered !== undefined) {
      cashTendered = roundMoney(cashTendered + o.amountTendered);
      changeGiven = roundMoney(changeGiven + (o.amountTendered - o.total));
    }
    if (o.discount) tally(discountsByReason, o.discount.reason?.trim() || '(no reason)', o.subtotal - o.total);
  }

  const items = Object.values(itemStats).sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);
  const bucketList = (map, key) => Object.entries(map).map(([k, v]) => ({ [key]: k, ...v })).sort((a, b) => (a[key] < b[key] ? -1 : 1));

  return {
    orderCount: live.length,
    revenue,
    avgOrder: live.length ? roundMoney(revenue / live.length) : 0,
    discountTotal,
    voidedCount: voided.length,
    voidedTotal: roundMoney(voided.reduce((sum, o) => sum + o.total, 0)),
    topItems: items.map(({ name, qty }) => ({ name, qty })),
    items: items.map((i) => ({ ...i, orderShare: live.length ? i.orders / live.length : 0 })),
    byPaymentMethod,
    byOrderType,
    byHour,
    byWeekday,
    byDay: bucketList(byDayMap, 'date'),
    cashTendered,
    changeGiven,
    comboShare: totalLines ? comboLines / totalLines : 0,
    discountsByReason: bucketList(discountsByReason, 'reason').sort((a, b) => b.revenue - a.revenue)
      .map(({ reason, count, revenue: amount }) => ({ reason, count, amount })),
    voids: voided
      .map((o) => ({
        _id: o._id,
        orderNumber: o.orderNumber,
        total: o.total,
        reason: o.voidReason ?? '',
        at: o.statusHistory?.find((h) => h.status === 'voided')?.at ?? o.createdAt,
      }))
      .sort((a, b) => new Date(b.at) - new Date(a.at)),
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
