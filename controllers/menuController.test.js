const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateFields, isPrivateAddress } = require('./menuController');

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

test('validateFields enforces tag shape, count and length', () => {
  assert.equal(validateFields({ tags: ['New', 'Spicy'] }), null);
  assert.equal(validateFields({ tags: 'New' }), 'Tags must be a list of words');
  assert.equal(validateFields({ tags: ['a', 'b', 'c', 'd'] }), 'At most 3 tags');
  assert.equal(validateFields({ tags: ['   '] }), 'Each tag must be 1–16 characters');
  assert.equal(validateFields({ tags: ['x'.repeat(17)] }), 'Each tag must be 1–16 characters');
});

test('isPrivateAddress blocks loopback, link-local and RFC 1918 ranges only', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.9', '172.16.0.1', '172.31.255.255', '169.254.1.1', '0.0.0.0']) assert.equal(isPrivateAddress(ip, 4), true, ip);
  for (const ip of ['8.8.8.8', '172.32.0.1', '11.0.0.1', '193.168.0.1']) assert.equal(isPrivateAddress(ip, 4), false, ip);
  assert.equal(isPrivateAddress('::1', 6), true);
  assert.equal(isPrivateAddress('fd00::1', 6), true);
  assert.equal(isPrivateAddress('2606:4700::1111', 6), false);
});

test('isPrivateAddress unwraps IPv4-mapped IPv6 and checks the embedded address', () => {
  assert.equal(isPrivateAddress('::ffff:127.0.0.1', 6), true);
  assert.equal(isPrivateAddress('::ffff:10.0.0.5', 6), true);
  assert.equal(isPrivateAddress('::ffff:8.8.8.8', 6), false);
});
