const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validatePageSizeOptions } = require('./settingsController');

test('validatePageSizeOptions accepts a well-formed list', () => {
  assert.equal(validatePageSizeOptions([10, 25, 50]), null);
  assert.equal(validatePageSizeOptions([1]), null);
  assert.equal(validatePageSizeOptions([500]), null);
});

test('validatePageSizeOptions rejects an empty, missing, or oversized list', () => {
  assert.ok(validatePageSizeOptions(undefined));
  assert.ok(validatePageSizeOptions([]));
  assert.ok(validatePageSizeOptions('10'));
  assert.ok(validatePageSizeOptions(Array.from({ length: 9 }, (_, i) => i + 1)));
});

test('validatePageSizeOptions rejects non-integers, non-positive, out-of-range and duplicate values', () => {
  assert.ok(validatePageSizeOptions([10, 25.5]));
  assert.ok(validatePageSizeOptions([0, 10]));
  assert.ok(validatePageSizeOptions([-5, 10]));
  assert.ok(validatePageSizeOptions([10, 501]));
  assert.ok(validatePageSizeOptions([10, 10, 25]));
});
