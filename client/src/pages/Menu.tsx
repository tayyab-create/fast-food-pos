import { useEffect, useState } from 'react';
import {
  createMenuItem,
  deleteMenuItem,
  deleteMenuItemImage,
  getMenu,
  updateMenuItem,
  uploadMenuItemImage,
} from '../api/menu';
import { LedgerTable } from '../components/LedgerTable';
import type { MenuItem, Variant } from '../types';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImageFlag, setRemoveImageFlag] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    return getMenu().then(setItems);
  }

  useEffect(() => {
    load();
  }, []);

  const selected = items.find((i) => i._id === selectedId) ?? null;

  // Combo entries reference items by name (or "Name (Variant)"), so renaming/deleting
  // an item can silently orphan a combo's reference — warn using already-loaded items.
  function combosReferencing(itemName: string): string[] {
    return items
      .filter((i) => i.isCombo && i.comboItems?.some((entry) => entry === itemName || entry.startsWith(`${itemName} (`)))
      .map((i) => i.name);
  }

  function selectItem(item: MenuItem) {
    setSelectedId(item._id);
    setMode('view');
  }

  function resetImageState(existingImage?: string) {
    setImageFile(null);
    setImagePreview(existingImage ?? null);
    setRemoveImageFlag(false);
    setImageError(null);
  }

  function openAdd() {
    setSelectedId(null);
    setForm(EMPTY_FORM);
    resetImageState();
    setFormError(null);
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
    resetImageState(item.image);
    setFormError(null);
    setMode('edit');
  }

  function pickImage(file: File | null) {
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError('Only JPEG, PNG, or WebP images are allowed.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Image must be 5MB or smaller.');
      return;
    }
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    setImageError(null);
    setRemoveImageFlag(false);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setRemoveImageFlag(true);
    setImageError(null);
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
    setFormError(null);
    const name = form.name.trim();
    if (!name) return setFormError('Name is required.');
    if (!(Number(form.price) > 0)) return setFormError('Price must be a positive number.');
    if (form.hasVariants) {
      for (const v of form.variants) {
        if (!v.name.trim()) return setFormError('Each size needs a name.');
        if (!(v.price > 0)) return setFormError(`Size "${v.name}" needs a positive price.`);
      }
    }

    if (mode === 'edit' && selected && selected.name !== name) {
      const affected = combosReferencing(selected.name);
      if (affected.length) {
        const proceed = window.confirm(
          `"${selected.name}" is used in: ${affected.join(', ')}. Renaming won't update those combos — continue?`
        );
        if (!proceed) return;
      }
    }

    const payload = {
      name,
      price: Number(form.price),
      category: form.category || 'Other',
      variants: form.hasVariants ? form.variants.filter((v) => v.name) : [],
      isCombo: form.isCombo,
      comboItems: form.isCombo ? form.comboItems : [],
    };
    try {
      const saved = mode === 'edit' && selectedId
        ? await updateMenuItem(selectedId, payload)
        : await createMenuItem(payload);

      if (imageFile) {
        await uploadMenuItemImage(saved._id, imageFile);
      } else if (removeImageFlag) {
        await deleteMenuItemImage(saved._id);
      }

      await load();
      setSelectedId(saved._id);
      setMode('view');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save item.');
    }
  }

  async function confirmDelete(item: MenuItem) {
    const affected = combosReferencing(item.name);
    const message = affected.length
      ? `"${item.name}" is used in: ${affected.join(', ')}. Deleting it won't update those combos. Delete anyway?`
      : `Delete "${item.name}"? This can't be undone.`;
    if (!window.confirm(message)) return;
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
    <div className="pos-layout menu-layout">
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
            {
              header: '',
              render: (i: MenuItem) =>
                i.image ? <img className="menu-avatar" src={i.image} alt="" /> : <span className="menu-avatar-empty" />,
            },
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

            <div className="image-field">
              {imagePreview && <img className="image-preview" src={imagePreview} alt="" />}
              <div className="image-field-controls">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
                />
                {imagePreview && (
                  <button className="ghost" onClick={clearImage}>Remove image</button>
                )}
              </div>
              {imageError && <p className="field-error">{imageError}</p>}
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

            {formError && <p className="field-error">{formError}</p>}
            <div className="form-actions">
              <button className="primary" onClick={save}>Save</button>
              <button className="ghost" onClick={cancelForm}>Cancel</button>
            </div>
          </>
        ) : selected ? (
          <>
            <h2>{selected.name}</h2>
            {selected.image && <img className="image-preview" src={selected.image} alt="" />}
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
