const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveItem, applyDiscount } = require('./ordersController');

const menu = [
  { name: 'Cheeseburger', price: 5.99 },
  { name: 'Chicken Nuggets (6pc)', price: 4.99 },
  { name: 'Combo Meal', price: 8.99, isCombo: true, comboItems: [{ name: 'Cheeseburger', qty: 2 }, { name: 'Fries (Large)', qty: 1 }] },
  { name: 'Pizza', price: 0, variants: [{ name: 'Medium', price: 7.99 }, { name: 'Large', price: 9.99 }] },
  { name: 'Sold Out Burger', price: 6.99, available: false },
  { name: 'Sold Out Pizza', price: 0, available: false, variants: [{ name: 'Medium', price: 7.99 }] },
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

test('resolveItem carries comboItems for a combo, formatted with quantities, not for a plain item', () => {
  const combo = resolveItem({ name: 'Combo Meal', qty: 1 }, menu).item;
  assert.deepEqual(combo.comboItems, ['2× Cheeseburger', 'Fries (Large)']);
  const plain = resolveItem({ name: 'Cheeseburger', qty: 1 }, menu).item;
  assert.equal(plain.comboItems, undefined);
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

test('applyDiscount truncates a discount reason to 100 chars', () => {
  const result = applyDiscount({ type: 'flat', value: 1, reason: 'x'.repeat(150) }, 20);
  assert.equal(result.reason.length, 100);
});
