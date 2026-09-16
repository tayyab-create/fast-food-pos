const { test } = require('node:test');
const assert = require('node:assert/strict');
const { summarize, parseDay } = require('./reportsController');

const at = (hour) => new Date(2026, 8, 16, hour, 30).toISOString();
const orders = [
  { status: 'completed', total: 10, subtotal: 10, paymentMethod: 'cash', amountTendered: 20, orderType: 'dine-in', createdAt: at(12), items: [{ name: 'Burger', price: 5, qty: 2, comboItems: ['Fries'] }] },
  { status: 'pending', total: 9, subtotal: 10, discount: { type: 'flat', value: 1, reason: 'Staff' }, paymentMethod: 'card', orderType: 'takeout', createdAt: at(12), items: [{ name: 'Burger', price: 5, qty: 1 }, { name: 'Fries', price: 1, qty: 3 }] },
  { status: 'voided', orderNumber: 7, total: 50, subtotal: 50, paymentMethod: 'cash', orderType: 'delivery', voidReason: 'Wrong table', createdAt: at(18), statusHistory: [{ status: 'pending', at: at(18) }, { status: 'voided', at: at(19) }], items: [{ name: 'Pizza', price: 10, qty: 5 }] },
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

test('summarize reports items, days, weekdays, cash handling, combos, discounts and voids', () => {
  const s = summarize(orders);
  assert.deepEqual(s.items[0], { name: 'Burger', qty: 3, revenue: 15, orders: 2, orderShare: 1 });
  assert.deepEqual(s.items[1], { name: 'Fries', qty: 3, revenue: 3, orders: 1, orderShare: 0.5 });
  assert.deepEqual(s.byDay, [{ date: '2026-09-16', count: 2, revenue: 19 }]);
  assert.equal(s.byWeekday.length, 7);
  assert.deepEqual(s.byWeekday[new Date(2026, 8, 16).getDay()], { count: 2, revenue: 19 });
  assert.equal(s.cashTendered, 20);
  assert.equal(s.changeGiven, 10);
  assert.equal(s.comboShare, 1 / 3);
  assert.deepEqual(s.discountsByReason, [{ reason: 'Staff', count: 1, amount: 1 }]);
  assert.equal(s.voids.length, 1);
  assert.equal(s.voids[0].orderNumber, 7);
  assert.equal(s.voids[0].reason, 'Wrong table');
  assert.equal(s.voids[0].at, at(19));
});
