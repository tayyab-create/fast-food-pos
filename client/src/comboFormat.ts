import type { ComboEntry, MenuItem } from './types';

/** "2× Cheeseburger" if qty > 1, else just the name — matches the backend's
 * Order.items[].comboItems snapshot format (ordersController.js). */
export function formatComboEntry(entry: ComboEntry): string {
  return entry.qty > 1 ? `${entry.qty}× ${entry.name}` : entry.name;
}

/** Resolves a combo entry's current catalog price (its name follows the same
 * "Base (Variant)" convention as cart/order lines) — always today's price,
 * not a stale snapshot, since combo entries don't store their own price.
 * Checks an exact plain-item match first, same as the backend's resolveItem,
 * so an item whose own name contains parentheses (e.g. "Pepsi (250ml)") isn't
 * misread as "Base (Variant)". */
export function priceForComboEntry(entry: ComboEntry, menu: MenuItem[]): number {
  const exact = menu.find((i) => i.name === entry.name && !i.variants?.length);
  if (exact) return exact.price;

  const match = entry.name.match(/^(.+) \(([^)]+)\)$/);
  if (match) {
    const [, baseName, variantName] = match;
    const base = menu.find((i) => i.name === baseName);
    return base?.variants?.find((v) => v.name === variantName)?.price ?? 0;
  }
  return 0;
}

/** Sum of qty × resolved price across a combo's entries — what the items
 * would cost bought separately at today's catalog prices. */
export function comboItemsTotal(entries: ComboEntry[], menu: MenuItem[]): number {
  return entries.reduce((sum, e) => sum + priceForComboEntry(e, menu) * e.qty, 0);
}
