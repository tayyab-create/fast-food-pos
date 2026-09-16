import { useState } from 'react';
import { comboItemsTotal } from '../comboFormat';
import { Dropdown } from './Dropdown';
import type { ComboEntry, MenuItem } from '../types';

interface ComboPickerProps {
  value: ComboEntry[];
  onChange: (value: ComboEntry[]) => void;
  /** Items eligible to go in the combo (already excludes combos and the item being edited). */
  candidates: MenuItem[];
}

/** Searchable checklist for building a combo's contents: a real checkbox per
 * candidate (so it's keyboard-usable as-is), a qty field and size picker once
 * selected, and a running "bought separately" sum. Entries reference items by
 * id, so nothing here depends on names staying stable. */
export function ComboPicker({ value, onChange, candidates }: ComboPickerProps) {
  const [search, setSearch] = useState('');

  const entryFor = (item: MenuItem) => value.find((e) => e.itemId === item._id);

  function toggle(item: MenuItem) {
    if (entryFor(item)) {
      onChange(value.filter((e) => e.itemId !== item._id));
      return;
    }
    const variant = item.variants?.[0]?.name;
    onChange([...value, { itemId: item._id, qty: 1, ...(variant ? { variant } : {}) }]);
  }

  function patch(item: MenuItem, changes: Partial<ComboEntry>) {
    onChange(value.map((e) => (e.itemId === item._id ? { ...e, ...changes } : e)));
  }

  const shown = candidates.filter((i) => i.name.toLowerCase().includes(search.trim().toLowerCase()));
  const sum = comboItemsTotal(value, candidates);

  return (
    <div className="combo-picker">
      <div className="hint">Select the items included in this combo</div>
      <input
        className="search-input"
        placeholder="Search items to add…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="combo-picker-list">
        {shown.length === 0 && <p className="empty">No items match.</p>}
        {shown.map((item) => {
          const entry = entryFor(item);
          const checkboxId = `combo-pick-${item._id}`;
          return (
            <div className="combo-picker-row" key={item._id}>
              <input type="checkbox" id={checkboxId} checked={!!entry} onChange={() => toggle(item)} />
              <label htmlFor={checkboxId} className="combo-picker-name">{item.name}</label>
              {entry && (
                <input
                  type="number"
                  min={1}
                  className="num combo-qty-input"
                  aria-label={`Quantity of ${item.name}`}
                  value={entry.qty}
                  onChange={(e) => {
                    const qty = Number(e.target.value);
                    if (qty > 0) patch(item, { qty });
                  }}
                />
              )}
              {item.variants?.length ? (
                <Dropdown
                  value={entry?.variant ?? item.variants[0].name}
                  disabled={!entry}
                  options={item.variants.map((v) => ({ value: v.name, label: `${v.name} ($${v.price.toFixed(2)})` }))}
                  onChange={(variant) => patch(item, { variant })}
                />
              ) : (
                <span className="num">${item.price.toFixed(2)}</span>
              )}
            </div>
          );
        })}
      </div>
      {value.length > 0 && (
        <div className="combo-sum">
          <span>Sum of selected items</span>
          <span className="num">${sum.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}
