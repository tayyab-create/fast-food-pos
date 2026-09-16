const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateName } = require('./labelsController');

test('validateName trims, requires a name, and caps length per kind', () => {
  assert.deepEqual(validateName('category', '  Drinks '), { name: 'Drinks' });
  assert.deepEqual(validateName('tag', ''), { error: 'Name is required' });
  assert.deepEqual(validateName('tag', '   '), { error: 'Name is required' });
  assert.deepEqual(validateName('tag', 'x'.repeat(17)), { error: 'Name must be 16 characters or fewer' });
  assert.deepEqual(validateName('category', 'x'.repeat(41)), { error: 'Name must be 40 characters or fewer' });
  assert.deepEqual(validateName('category', 'x'.repeat(40)), { name: 'x'.repeat(40) });
});
