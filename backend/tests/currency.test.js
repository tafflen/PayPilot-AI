const test = require('node:test');
const assert = require('node:assert/strict');
const {
  toMinorUnits,
  toMajorUnitsString,
  compareMinorUnits,
  formatCurrency,
} = require('../src/utils/currency');

test('Currency Utilities - toMinorUnits conversion', () => {
  // Standard 2-decimal USD conversion
  assert.equal(toMinorUnits(10.50, 'USD'), 1050);
  assert.equal(toMinorUnits('19.99', 'USD'), 1999);
  assert.equal(toMinorUnits(0, 'USD'), 0);
  assert.equal(toMinorUnits(0.01, 'USD'), 1);
  assert.equal(toMinorUnits(1250.75, 'USD'), 125075);

  // Floating point precision artifact elimination (0.1 + 0.2 in JS equals 0.30000000000000004)
  const sum = 0.1 + 0.2;
  assert.equal(toMinorUnits(sum, 'USD'), 30);

  // Zero-decimal currency (JPY)
  assert.equal(toMinorUnits(1500, 'JPY'), 1500);
});

test('Currency Utilities - toMajorUnitsString conversion', () => {
  assert.equal(toMajorUnitsString(1050, 'USD'), '10.50');
  assert.equal(toMajorUnitsString(1999, 'USD'), '19.99');
  assert.equal(toMajorUnitsString(5, 'USD'), '0.05');
  assert.equal(toMajorUnitsString(0, 'USD'), '0.00');
  assert.equal(toMajorUnitsString(-2500, 'USD'), '-25.00');
  assert.equal(toMajorUnitsString(1500, 'JPY'), '1500');
});

test('Currency Utilities - compareMinorUnits', () => {
  assert.equal(compareMinorUnits(1000, 1000), 0);
  assert.equal(compareMinorUnits(500, 1000), -1);
  assert.equal(compareMinorUnits(1500, 1000), 1);
  assert.equal(compareMinorUnits('1000', 1000), 0);
});

test('Currency Utilities - formatCurrency', () => {
  const formattedUSD = formatCurrency(125050, 'USD');
  assert.match(formattedUSD, /\$1,250\.50/);

  const formattedEUR = formatCurrency(5000, 'EUR');
  assert.match(formattedEUR, /50\.00/);
});
