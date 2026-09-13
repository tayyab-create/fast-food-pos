import { useEffect, useState } from 'react';
import { createMenuItem, deleteMenuItem, getMenu, updateMenuItem } from '../api/menu';
import { LedgerTable } from '../components/LedgerTable';
import type { MenuItem, Variant } from '../types';

interface FormState {
  name: string;
  category: string;
  price: string;
  hasVariants: boolean;
  variants: Variant[];
  isCombo: boolean;
  comboItems: string[];
}

const EMPTY_FORM: FormState = {
  name: '',
  category: '',
  price: '',
  hasVariants: false,
  variants: [],
  isCombo: false,
  comboItems: [],
};

function describe(item: MenuItem): string {
  if (item.variants?.length) return `${item.variants.length} size${item.variants.length > 1 ? 's' : ''}`;
  if (item.isCombo) return item.comboItems?.length ? item.comboItems.join(' + ') : 'Combo';
  return '—';
}

type Mode = 'view' | 'edit' | 'add' | null;

export function Menu() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [comboSearch, setComboSearch] = useState('');

  function load() {
    return getMenu().then(setItems);
  }

  useEffect(load, []);

  const selected = items.find((i) => i._id === selectedId) ?? null;

  function selectItem(item: MenuItem) {
    setSelectedId(item._id);
    setMode('view');
  }

  function openAdd() {
    setSelectedId(null);
    setForm(EMPTY_FORM);
    setMode('add');
  }

  function openEdit(item: MenuItem) {
    setForm({
      name: item.name,
      category: item.category,
      price: String(item.price),
      hasVariants: !!item.variants?.length,
      variants: item.variants ?? [],
      isCombo: !!item.isCombo,
      comboItems: item.comboItems ?? [],
    });
    setMode('edit');
  }

  function cancelForm() {
    setMode(selectedId ? 'view' : null);
  }

  function addVariantRow() {
    setForm((f) => ({ ...f, variants: [...f.variants, { name: '', price: 0 }] }));
  }

  function updateVariantRow(index: number, field: 'name' | 'price', value: string) {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, i) =>
        i === index ? { ...v, [field]: field === 'price' ? Number(value) || 0 : value } : v
      ),
    }));
  }

  function removeVariantRow(index: number) {
    setForm((f) => ({ ...f, variants: f.variants.filter((_, i) => i !== index) }));
  }

  function comboEntryFor(candidate: MenuItem): string | undefined {
    return form.comboItems.find((entry) =>
      candidate.variants?.length ? entry.startsWith(`${candidate.name} (`) : entry === candidate.name
    );
  }

  function toggleComboItem(candidate: MenuItem) {
    const existing = comboEntryFor(candidate);
    if (existing) {
      setForm((f) => ({ ...f, comboItems: f.comboItems.filter((n) => n !== existing) }));
      return;
    }
    const entry = candidate.variants?.length
      ? `${candidate.name} (${candidate.variants[0].name})`
      : candidate.name;
    setForm((f) => ({ ...f, comboItems: [...f.comboItems, entry] }));
  }

  function setComboVariant(candidate: MenuItem, variantName: string) {
    const existing = comboEntryFor(candidate);
    const entry = `${candidate.name} (${variantName})`;
    setForm((f) => ({
      ...f,
      comboItems: existing ? f.comboItems.map((n) => (n === existing ? entry : n)) : [...f.comboItems, entry],
    }));
  }

  async function save() {
    if (!form.name || !form.price) return;
    const payload = {
      name: form.name,
      price: Number(form.price),
      category: form.category || 'Other',
      variants: form.hasVariants ? form.variants.filter((v) => v.name) : [],
      isCombo: form.isCombo,
      comboItems: form.isCombo ? form.comboItems : [],
    };
    const saved = mode === 'edit' && selectedId
      ? await updateMenuItem(selectedId, payload)
      : await createMenuItem(payload);
    await load();
    setSelectedId(saved._id);
    setMode('view');
  }

  async function confirmDelete(item: MenuItem) {
    if (!window.confirm(`Delete "${item.name}"? This can't be undone.`)) return;
    await deleteMenuItem(item._id);
    if (selectedId === item._id) {
      setSelectedId(null);
      setMode(null);
    }
    load();
  }

  const categories = ['All', ...new Set(items.map((i) => i.category))];
  const filteredItems = items
    .filter((i) => categoryFilter === 'All' || i.category === categoryFilter)
    .filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  const comboCandidates = items
    .filter((i) => !i.isCombo && i._id !== selectedId)
    .filter((i) => i.name.toLowerCase().includes(comboSearch.toLowerCase()));

  return (
    <div className="pos-layout">
      <div className="pos-menu">
        <div className="list-header">
          <div className="section-header">Menu items</div>
          <button className="primary" onClick={openAdd}>+ Add item</button>
        </div>

        <div className="filter-bar">
          <input
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <LedgerTable
          columns={[
            { header: 'Item', render: (i: MenuItem) => i.name },
            { header: 'Category', render: (i: MenuItem) => i.category },
            {
              header: 'Price',
              numeric: true,
              render: (i: MenuItem) =>
                i.variants?.length
                  ? `from $${Math.min(...i.variants.map((v) => v.price)).toFixed(2)}`
                  : `$${i.price.toFixed(2)}`,
            },
            { header: 'Details', render: describe },
          ]}
          rows={filteredItems}
          rowKey={(i) => i._id}
          onRowClick={selectItem}
          isRowSelected={(i) => i._id === selectedId}
          emptyMessage="No items match."
        />
      </div>

      <div className="ledger-sheet">
        {mode === 'add' || mode === 'edit' ? (
          <>
            <h2>{mode === 'edit' ? 'Edit item' : 'Add item'}</h2>

            <div className="field-grid">
              <label>
                Name
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label>
                Category
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </label>
              <label>
                {form.hasVariants ? 'Base price' : form.isCombo ? 'Combo price' : 'Price'}
                <input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </label>
            </div>

            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={form.hasVariants}
                onChange={(e) => setForm({ ...form, hasVariants: e.target.checked })}
              />
              This item has sizes / variants
            </label>
            {form.hasVariants && (
              <div className="variant-editor">
                {form.variants.map((v, i) => (
                  <div className="variant-editor-row" key={i}>
                    <input
                      placeholder="Size name (e.g. Large)"
                      value={v.name}
                      onChange={(e) => updateVariantRow(i, 'name', e.target.value)}
                    />
                    <input
                      placeholder="Price"
                      type="number"
                      step="0.01"
                      value={v.price || ''}
                      onChange={(e) => updateVariantRow(i, 'price', e.target.value)}
                    />
                    <button className="remove-btn" onClick={() => removeVariantRow(i)} aria-label="Remove size">×</button>
                  </div>
                ))}
                <button className="ghost" onClick={addVariantRow}>+ Add size</button>
              </div>
            )}

            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={form.isCombo}
                onChange={(e) => setForm({ ...form, isCombo: e.target.checked })}
              />
              This is a combo
            </label>
            {form.isCombo && (
              <div className="combo-picker">
                <div className="hint">Select the items included in this combo</div>
                <input
                  className="search-input"
                  placeholder="Search items to add…"
                  value={comboSearch}
                  onChange={(e) => setComboSearch(e.target.value)}
                />
                <div className="combo-picker-list">
                  {comboCandidates.length === 0 && <p className="empty">No items match.</p>}
                  {comboCandidates.map((i) => {
                    const entry = comboEntryFor(i);
                    const selectedVariant = entry?.match(/\(([^)]+)\)$/)?.[1] ?? i.variants?.[0]?.name;
                    return (
                      <div className="combo-picker-row" key={i._id} onClick={() => toggleComboItem(i)}>
                        <input type="checkbox" checked={!!entry} readOnly />
                        <span className="combo-picker-name">{i.name}</span>
                        {i.variants?.length ? (
                          <select
                            value={selectedVariant}
                            disabled={!entry}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setComboVariant(i, e.target.value)}
                          >
                            {i.variants.map((v) => (
                              <option key={v.name} value={v.name}>{v.name} (${v.price.toFixed(2)})</option>
                            ))}
                          </select>
                        ) : (
                          <span className="num">${i.price.toFixed(2)}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="form-actions">
              <button className="primary" onClick={save}>Save</button>
              <button className="ghost" onClick={cancelForm}>Cancel</button>
            </div>
          </>
        ) : selected ? (
          <>
            <h2>{selected.name}</h2>
            <div className="detail-row"><span>Category</span><span>{selected.category}</span></div>
            {selected.variants?.length ? (
              <>
                <div className="section-header">Sizes</div>
                {selected.variants.map((v) => (
                  <div className="detail-row" key={v.name}>
                    <span>{v.name}</span>
                    <span className="num">${v.price.toFixed(2)}</span>
                  </div>
                ))}
              </>
            ) : (
              <div className="detail-row"><span>Price</span><span className="num">${selected.price.toFixed(2)}</span></div>
            )}
            {selected.isCombo && (
              <>
                <div className="section-header">Includes</div>
                <p className="hint">{selected.comboItems?.length ? selected.comboItems.join(' + ') : 'No items selected'}</p>
              </>
            )}
            <div className="form-actions">
              <button className="ghost" onClick={() => openEdit(selected)}>Edit</button>
              <button className="ghost danger" onClick={() => confirmDelete(selected)}>Delete</button>
            </div>
          </>
        ) : (
          <>
            <h2>Item details</h2>
            <p className="empty">Select an item from the list to view or edit it.</p>
          </>
        )}
      </div>
    </div>
  );
}
