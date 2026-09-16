const { test } = require('node:test');
const assert = require('node:assert/strict');
const { summarize, parseDay } = require('./reportsController');

const at = (hour) => new Date(2026, 8, 16, hour, 30).toISOString();
const orders = [
  { status: 'completed', total: 10, subtotal: 10, paymentMethod: 'cash', orderType: 'dine-in', createdAt: at(12), items: [{ name: 'Burger', qty: 2 }] },
  { status: 'pending', total: 9, subtotal: 10, discount: { type: 'flat', value: 1 }, paymentMethod: 'card', orderType: 'takeout', createdAt: at(12), items: [{ name: 'Burger', qty: 1 }, { name: 'Fries', qty: 3 }] },
  { status: 'voided', total: 50, subtotal: 50, paymentMethod: 'cash', orderType: 'delivery', createdAt: at(18), items: [{ name: 'Pizza', qty: 5 }] },
];

test('summarize excludes voided orders from revenue and counts them separately', () => {
  const s = summarize(orders);
  assert.equal(s.orderCount, 2);
  assert.equal(s.revenue, 19);
  assert.equal(s.avgOrder, 9.5);
  assert.equal(s.discountTotal, 1);
  assert.equal(s.voidedCount, 1);
  assert.equal(s.voidedTotal, 50);
  assert.deepEqual(s.topItems, [{ name: 'Burger', qty: 3 }, { name: 'Fries', qty: 3 }]);
  assert.deepEqual(s.byPaymentMethod, { cash: { count: 1, revenue: 10 }, card: { count: 1, revenue: 9 } });
  assert.deepEqual(s.byOrderType, { 'dine-in': { count: 1, revenue: 10 }, takeout: { count: 1, revenue: 9 } });
  assert.equal(s.byHour.length, 24);
  assert.deepEqual(s.byHour[12], { count: 2, revenue: 19 });
  assert.deepEqual(s.byHour[18], { count: 0, revenue: 0 });
});

test('summarize of no orders is all zeros', () => {
  const s = summarize([]);
  assert.equal(s.orderCount, 0);
  assert.equal(s.avgOrder, 0);
  assert.deepEqual(s.topItems, []);
});

test('parseDay parses YYYY-MM-DD as local midnight and rejects anything else', () => {
  const d = parseDay('2026-09-16');
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()], [2026, 8, 16, 0]);
  assert.equal(parseDay('nope'), null);
  assert.equal(parseDay(undefined), null);
  assert.equal(parseDay('2026-13-40'), null);
});
