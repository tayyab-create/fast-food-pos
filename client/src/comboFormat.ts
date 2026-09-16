import type { ComboEntry, MenuItem } from './types';

function findItem(entry: ComboEntry, menu: MenuItem[]): MenuItem | undefined {
  return menu.find((i) => i._id === entry.itemId);
}

/** "2× Fries (Large)" — or null if the referenced item is no longer in the
 * catalog. Must produce the same strings as describeComboContents() in
 * controllers/ordersController.js, which writes the order-time snapshot. */
export function comboEntryLabel(entry: ComboEntry, menu: MenuItem[]): string | null {
  const item = findItem(entry, menu);
  if (!item) return null;
  const name = entry.variant ? `${item.name} (${entry.variant})` : item.name;
  return entry.qty > 1 ? `${entry.qty}× ${name}` : name;
}

/** Today's catalog price for one unit of the entry (0 if the item or size is gone). */
export function comboEntryUnitPrice(entry: ComboEntry, menu: MenuItem[]): number {
  const item = findItem(entry, menu);
  if (!item) return 0;
  if (entry.variant) return item.variants?.find((v) => v.name === entry.variant)?.price ?? 0;
  return item.price;
}

/** What the combo's contents would cost bought separately at today's prices. */
export function comboItemsTotal(entries: ComboEntry[], menu: MenuItem[]): number {
  return entries.reduce((sum, e) => sum + comboEntryUnitPrice(e, menu) * e.qty, 0);
}

/** "2× Cheeseburger + Fries (Large)" for tiles, tickets, and detail views. */
export function comboContentsSummary(entries: ComboEntry[], menu: MenuItem[]): string {
  return entries.map((e) => comboEntryLabel(e, menu)).filter(Boolean).join(' + ');
}
