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
