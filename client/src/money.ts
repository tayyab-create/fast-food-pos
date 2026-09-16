/** Accepts what a user may type into a money field: digits with at most two
 * decimals (or an in-progress "5." / ""). Mirrors isMoney() in lib/money.js. */
export function isMoneyInput(value: string): boolean {
  return /^\d*(\.\d{0,2})?$/.test(value);
}

/** Round to cents; the EPSILON nudge stops 1.005 rounding down to 1.00.
 * Mirrors roundMoney() in lib/money.js so client previews match stored totals. */
export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
