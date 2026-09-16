const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isMoney, roundMoney } = require('../lib/money');

test('isMoney accepts up to two decimals, as a number or numeric string', () => {
  for (const ok of [0, 5, 5.9, 5.99, '5.99', '12', 1234.5]) assert.ok(isMoney(ok), String(ok));
});

test('isMoney rejects a third decimal, non-numbers, and non-finite values', () => {
  for (const bad of [5.999, '5.999', 0.001, 'abc', NaN, Infinity, undefined]) assert.ok(!isMoney(bad), String(bad));
});

test('roundMoney rounds to cents and does not round 1.005 down', () => {
  assert.equal(roundMoney(0.599), 0.6);
  assert.equal(roundMoney(17.970000000000002), 17.97);
  assert.equal(roundMoney(1.005), 1.01);
  assert.equal(roundMoney(5.39), 5.39);
});
