const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveItem, applyDiscount } = require('./ordersController');

const menu = [
  { _id: 'cb', name: 'Cheeseburger', price: 5.99 },
  { _id: 'nug', name: 'Chicken Nuggets (6pc)', price: 4.99 },
  { _id: 'fries', name: 'Fries', price: 0, variants: [{ name: 'Small', price: 2.49 }, { name: 'Large', price: 3.49 }] },
  { _id: 'combo', name: 'Combo Meal', price: 8.99, isCombo: true, comboItems: [{ itemId: 'cb', qty: 2 }, { itemId: 'fries', variant: 'Large', qty: 1 }] },
  { _id: 'pizza', name: 'Pizza', price: 0, variants: [{ name: 'Medium', price: 7.99 }, { name: 'Large', price: 9.99 }] },
  { _id: 'sob', name: 'Sold Out Burger', price: 6.99, available: false },
  { _id: 'sop', name: 'Sold Out Pizza', price: 0, available: false, variants: [{ name: 'Medium', price: 7.99 }] },
  { _id: 'combo-86', name: 'Sold Out Combo', price: 9.99, isCombo: true, comboItems: [{ itemId: 'cb', qty: 1 }, { itemId: 'sob', qty: 1 }] },
  { _id: 'combo-gone', name: 'Ghost Combo', price: 9.99, isCombo: true, comboItems: [{ itemId: 'cb', qty: 1 }, { itemId: 'deleted', qty: 1 }] },
];

test('resolveItem resolves a plain menu item at the catalog price, ignoring a spoofed price', () => {
  const { item, error } = resolveItem({ name: 'Cheeseburger', price: 0.01, qty: 2 }, menu);
  assert.equal(error, undefined);
  assert.equal(item.price, 5.99);
  assert.equal(item.qty, 2);
});

test('resolveItem matches an item whose own name contains parentheses', () => {
  const { item, error } = resolveItem({ name: 'Chicken Nuggets (6pc)', qty: 1 }, menu);
  assert.equal(error, undefined);
  assert.equal(item.price, 4.99);
});

test('resolveItem resolves "Base (Variant)" against the variant price', () => {
  const { item, error } = resolveItem({ name: 'Pizza (Large)', qty: 1 }, menu);
  assert.equal(error, undefined);
  assert.equal(item.price, 9.99);
});

test('resolveItem resolves a combo\'s item ids into named, quantified contents; plain items carry none', () => {
  const combo = resolveItem({ name: 'Combo Meal', qty: 1 }, menu).item;
  assert.deepEqual(combo.comboItems, ['2× Cheeseburger', 'Fries (Large)']);
  const plain = resolveItem({ name: 'Cheeseburger', qty: 1 }, menu).item;
  assert.equal(plain.comboItems, undefined);
});

test('resolveItem rejects a combo whose contents include an unavailable item', () => {
  const { error } = resolveItem({ name: 'Sold Out Combo', qty: 1 }, menu);
  assert.match(error, /includes "Sold Out Burger", which is currently unavailable/);
});

test('resolveItem skips a combo entry whose item no longer exists rather than failing', () => {
  const { item, error } = resolveItem({ name: 'Ghost Combo', qty: 1 }, menu);
  assert.equal(error, undefined);
  assert.deepEqual(item.comboItems, ['Cheeseburger']);
});

test('resolveItem rejects zero, negative, and non-integer quantities', () => {
  assert.ok(resolveItem({ name: 'Cheeseburger', qty: 0 }, menu).error);
  assert.ok(resolveItem({ name: 'Cheeseburger', qty: -1 }, menu).error);
  assert.ok(resolveItem({ name: 'Cheeseburger', qty: 1.5 }, menu).error);
});

test('resolveItem rejects an unknown item name', () => {
  const { error } = resolveItem({ name: 'Nonexistent Item', qty: 1 }, menu);
  assert.match(error, /Unknown menu item/);
});

test('resolveItem rejects an unknown variant of a known item', () => {
  const { error } = resolveItem({ name: 'Pizza (Small)', qty: 1 }, menu);
  assert.match(error, /Unknown menu item/);
});

test('resolveItem rejects an item marked unavailable, plain or variant', () => {
  assert.match(resolveItem({ name: 'Sold Out Burger', qty: 1 }, menu).error, /unavailable/);
  assert.match(resolveItem({ name: 'Sold Out Pizza (Medium)', qty: 1 }, menu).error, /unavailable/);
});

test('resolveItem truncates a note to 200 chars and drops a non-string note', () => {
  const long = resolveItem({ name: 'Cheeseburger', qty: 1, note: 'x'.repeat(300) }, menu).item;
  assert.equal(long.note.length, 200);
  const noNote = resolveItem({ name: 'Cheeseburger', qty: 1, note: 42 }, menu).item;
  assert.equal(noNote.note, undefined);
});

test('applyDiscount with no discount returns the subtotal as total', () => {
  const result = applyDiscount(undefined, 20);
  assert.equal(result.discountAmount, 0);
  assert.equal(result.total, 20);
});

test('applyDiscount computes a percent discount correctly', () => {
  const result = applyDiscount({ type: 'percent', value: 10 }, 20);
  assert.equal(result.discountAmount, 2);
  assert.equal(result.total, 18);
});

test('applyDiscount computes a flat discount correctly', () => {
  const result = applyDiscount({ type: 'flat', value: 5 }, 20);
  assert.equal(result.discountAmount, 5);
  assert.equal(result.total, 15);
});

test('applyDiscount rejects a percent discount over 100', () => {
  const result = applyDiscount({ type: 'percent', value: 101 }, 20);
  assert.match(result.error, /cannot exceed 100/);
});

test('applyDiscount rejects a flat discount larger than the subtotal', () => {
  const result = applyDiscount({ type: 'flat', value: 25 }, 20);
  assert.match(result.error, /cannot exceed the subtotal/);
});

test('applyDiscount rejects a zero or negative discount value', () => {
  assert.ok(applyDiscount({ type: 'flat', value: 0 }, 20).error);
  assert.ok(applyDiscount({ type: 'flat', value: -5 }, 20).error);
});

test('applyDiscount rejects an unknown discount type', () => {
  const result = applyDiscount({ type: 'bogo', value: 1 }, 20);
  assert.match(result.error, /Invalid discount/);
});

test('applyDiscount never lets total go negative', () => {
  // A flat discount exactly equal to the subtotal must not push total below zero.
  const result = applyDiscount({ type: 'flat', value: 20 }, 20);
  assert.equal(result.total, 0);
});

test('applyDiscount rounds a percent discount and the total to cents', () => {
  // 10% of 5.99 is 0.599 — must land on 0.60 / 5.39, never carry a third decimal.
  const result = applyDiscount({ type: 'percent', value: 10 }, 5.99);
  assert.equal(result.discountAmount, 0.6);
  assert.equal(result.total, 5.39);
});

test('applyDiscount rejects a value with more than two decimal places', () => {
  assert.match(applyDiscount({ type: 'flat', value: 1.005 }, 20).error, /two decimal/);
  assert.match(applyDiscount({ type: 'percent', value: 12.345 }, 20).error, /two decimal/);
  assert.equal(applyDiscount({ type: 'percent', value: 12.5 }, 20).error, undefined);
});

test('applyDiscount truncates a discount reason to 100 chars', () => {
  const result = applyDiscount({ type: 'flat', value: 1, reason: 'x'.repeat(150) }, 20);
  assert.equal(result.reason.length, 100);
});
