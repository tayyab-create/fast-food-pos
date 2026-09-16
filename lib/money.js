// Money is stored as a JS number of dollars, so two rules keep it honest:
// inputs may never carry more than two decimals, and anything we compute is
// rounded to cents before it's compared or saved.

// True for a finite number with at most two decimal places (5, 5.9, 5.99).
function isMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
}

// Round to cents. The EPSILON nudge stops 1.005 rounding down to 1.00.
function roundMoney(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

module.exports = { isMoney, roundMoney };
