const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateFields } = require('./menuController');

test('validateFields accepts a well-formed item', () => {
  assert.equal(validateFields({ name: 'Cheeseburger', price: 5.99, category: 'Burgers' }), null);
});

test('validateFields rejects an empty or whitespace-only name', () => {
  assert.ok(validateFields({ name: '' }));
  assert.ok(validateFields({ name: '   ' }));
});

test('validateFields rejects a non-positive price', () => {
  assert.ok(validateFields({ price: 0 }));
  assert.ok(validateFields({ price: -5 }));
});

test('validateFields rejects prices with more than two decimal places', () => {
  assert.ok(validateFields({ price: 5.999 }));
  assert.ok(validateFields({ price: '4.125' }));
  assert.equal(validateFields({ price: 5.9 }), null);
  assert.ok(validateFields({ variants: [{ name: 'Large', price: 9.999 }] }));
  assert.equal(validateFields({ variants: [{ name: 'Large', price: 9.99 }] }), null);
});

test('validateFields rejects an empty category', () => {
  assert.ok(validateFields({ category: '' }));
});

test('validateFields skips fields that are absent (partial update)', () => {
  assert.equal(validateFields({ price: 5.99 }), null);
});

test('validateFields rejects a variant with no name or a non-positive price', () => {
  assert.ok(validateFields({ variants: [{ name: '', price: 5 }] }));
  assert.ok(validateFields({ variants: [{ name: 'Large', price: 0 }] }));
});

test('validateFields accepts well-formed variants', () => {
  assert.equal(validateFields({ variants: [{ name: 'Large', price: 9.99 }] }), null);
});

test('validateFields rejects variants that are not a list', () => {
  assert.ok(validateFields({ variants: { name: 'Large', price: 9.99 } }));
  assert.ok(validateFields({ variants: 'Large' }));
});

test('validateFields accepts well-formed combo items and rejects bad ids, quantities, and variants', () => {
  const id = '6aa669010dd66c8d26936a37';
  assert.equal(validateFields({ comboItems: [{ itemId: id, qty: 2 }, { itemId: id, variant: 'Large', qty: 1 }] }), null);
  assert.equal(validateFields({ comboItems: [] }), null);
  assert.ok(validateFields({ comboItems: [{ itemId: 'not-an-id', qty: 1 }] }));
  assert.ok(validateFields({ comboItems: [{ itemId: id, qty: 0 }] }));
  assert.ok(validateFields({ comboItems: [{ itemId: id, qty: -1 }] }));
  assert.ok(validateFields({ comboItems: [{ itemId: id, qty: 1.5 }] }));
  assert.ok(validateFields({ comboItems: [{ itemId: id, qty: 1, variant: 7 }] }));
  assert.ok(validateFields({ comboItems: { itemId: id, qty: 1 } }));
});
