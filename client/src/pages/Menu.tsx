import { useEffect, useState } from 'react';
import {
  createMenuItem,
  deleteMenuItem,
  deleteMenuItemImage,
  getMenu,
  updateMenuItem,
  uploadMenuItemImage,
} from '../api/menu';
import { comboContentsSummary, comboItemsTotal } from '../comboFormat';
import { Combobox } from '../components/Combobox';
import { ComboPicker } from '../components/ComboPicker';
import { MultiSelectDropdown } from '../components/Dropdown';
import { LedgerTable } from '../components/LedgerTable';
import { isMoneyInput } from '../money';
import type { ComboEntry, MenuItem, Variant } from '../types';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const COMBO_CATEGORY = 'Combo';

interface FormState {
  name: string;
  category: string;
  price: string;
  /** Once the user types a price, stop auto-filling it from the combo sum. */
  priceEdited: boolean;
  hasVariants: boolean;
  variants: Variant[];
  isCombo: boolean;
  comboItems: ComboEntry[];
  available: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  category: '',
  price: '',
  priceEdited: false,
  hasVariants: false,
  variants: [],
  isCombo: false,
  comboItems: [],
  available: true,
};

type Mode = 'view' | 'edit' | 'add' | null;

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function Menu() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImageFlag, setRemoveImageFlag] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; category?: string; price?: string; variants?: Record<number, string> }>({});

  async function load() {
    try {
      setItems(await getMenu());
      setListError(null);
    } catch (err) {
      setListError(errorMessage(err, 'Could not load the menu.'));
    }
  }

  useEffect(() => {
    load();
  }, []);

  const selected = items.find((i) => i._id === selectedId) ?? null;

  function describe(item: MenuItem): string {
    if (item.variants?.length) return `${item.variants.length} size${item.variants.length > 1 ? 's' : ''}`;
    if (item.isCombo) return item.comboItems?.length ? comboContentsSummary(item.comboItems, items) : 'Combo';
    return '—';
  }

  function combosContaining(item: MenuItem): string[] {
    return items
      .filter((i) => i.isCombo && i.comboItems?.some((entry) => entry.itemId === item._id))
      .map((i) => i.name);
  }

  function selectItem(item: MenuItem) {
    setSelectedId(item._id);
    setMode('view');
  }

  function resetImageState(existingImage?: string) {
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
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
    setFieldErrors({});
    setMode('add');
  }

  function openEdit(item: MenuItem) {
    setForm({
      name: item.name,
      category: item.category,
      price: String(item.price),
      priceEdited: true,
      hasVariants: !!item.variants?.length,
      variants: item.variants ?? [],
      isCombo: !!item.isCombo,
      comboItems: item.comboItems ?? [],
      available: item.available !== false,
    });
    resetImageState(item.image);
    setFormError(null);
    setFieldErrors({});
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
    resetImageState(selected?.image);
    setMode(selectedId ? 'view' : null);
  }

  function addVariantRow() {
    setForm((f) => ({ ...f, variants: [...f.variants, { name: '', price: 0 }] }));
  }

  function updateVariantRow(index: number, field: 'name' | 'price', value: string) {
    if (field === 'price' && !isMoneyInput(value)) return;
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

  // Refreshes the combo's contents and — unless the user has typed their own
  // price — the price field from the new sum, so it starts out correct but
  // never fights a deliberate manual edit.
  function setComboItems(comboItems: ComboEntry[]) {
    setForm((f) => ({
      ...f,
      comboItems,
      price: f.priceEdited ? f.price : comboItemsTotal(comboItems, items).toFixed(2),
    }));
  }

  const comboSum = comboItemsTotal(form.comboItems, items);

  function validateForm(name: string): boolean {
    const errors: typeof fieldErrors = {};
    if (!name) errors.name = 'Name is required.';
    if (!form.category.trim()) errors.category = 'Category is required.';
    if (!(Number(form.price) > 0)) errors.price = 'Must be a positive number.';
    else if (!isMoneyInput(form.price)) errors.price = 'Use at most two decimal places.';
    if (form.hasVariants) {
      const variantErrors: Record<number, string> = {};
      form.variants.forEach((v, i) => {
        if (!v.name.trim()) variantErrors[i] = 'Name required.';
        else if (!(v.price > 0)) variantErrors[i] = 'Positive price required.';
      });
      if (Object.keys(variantErrors).length) errors.variants = variantErrors;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function save() {
    setFormError(null);
    const name = form.name.trim();
    if (!validateForm(name)) return;

    const payload = {
      name,
      price: Number(form.price),
      category: form.category || 'Other',
      variants: form.hasVariants ? form.variants.filter((v) => v.name) : [],
      isCombo: form.isCombo,
      comboItems: form.isCombo ? form.comboItems : [],
      available: form.available,
    };

    let saved: MenuItem;
    try {
      saved = mode === 'edit' && selectedId
        ? await updateMenuItem(selectedId, payload)
        : await createMenuItem(payload);
    } catch (err) {
      setFormError(errorMessage(err, 'Failed to save item.'));
      return;
    }

    // The item itself is saved at this point, so an image failure must not
    // leave the list stale — refresh regardless, then report the image error.
    let imageFailure: string | null = null;
    try {
      if (imageFile) await uploadMenuItemImage(saved._id, imageFile);
      else if (removeImageFlag) await deleteMenuItemImage(saved._id);
    } catch (err) {
      imageFailure = errorMessage(err, 'The item was saved, but its image could not be updated.');
    }

    await load();
    setSelectedId(saved._id);
    if (imageFailure) {
      setFormError(imageFailure);
    } else {
      resetImageState(undefined);
      setMode('view');
    }
  }

  async function toggleAvailable(item: MenuItem) {
    try {
      await updateMenuItem(item._id, { available: item.available === false });
      await load();
    } catch (err) {
      setListError(errorMessage(err, 'Could not update the item.'));
    }
  }

  async function confirmDelete(item: MenuItem) {
    const affected = combosContaining(item);
    const message = affected.length
      ? `"${item.name}" is part of: ${affected.join(', ')}. Deleting it will remove it from those combos. Delete anyway?`
      : `Delete "${item.name}"? This can't be undone.`;
    if (!window.confirm(message)) return;
    try {
      await deleteMenuItem(item._id);
    } catch (err) {
      setListError(errorMessage(err, 'Could not delete the item.'));
      return;
    }
    if (selectedId === item._id) {
      setSelectedId(null);
      setMode(null);
    }
    await load();
  }

  const distinctCategories = [...new Set(items.map((i) => i.category))];
  const filteredItems = items
    .filter((i) => categoryFilters.length === 0 || categoryFilters.includes(i.category))
    .filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
  const comboCandidates = items.filter((i) => !i.isCombo && i._id !== selectedId);
  const selectedSeparateTotal = selected?.isCombo && selected.comboItems?.length
    ? comboItemsTotal(selected.comboItems, items)
    : 0;

  return (
    <div className="pos-layout menu-layout">
      <div className="pos-menu">
        <div className="list-header">
          <div className="section-header">Menu items</div>
          <button type="button" className="primary" onClick={openAdd}>+ Add item</button>
        </div>

        <div className="filter-bar">
          <input
            placeholder="Search items…"
            aria-label="Search items"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <MultiSelectDropdown values={categoryFilters} options={distinctCategories} onChange={setCategoryFilters} placeholder="All categories" />
        </div>

        {listError && <p className="field-error" role="alert">{listError}</p>}

        <LedgerTable
          columns={[
            {
              header: '',
              render: (i: MenuItem) =>
                i.image ? <img className="menu-avatar" src={i.image} alt="" /> : <span className="menu-avatar-empty" />,
            },
            {
              header: 'Item',
              render: (i: MenuItem) => (
                <>
                  {i.name}
                  {i.available === false && <span className="muted-text"> (86'd)</span>}
                </>
              ),
            },
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
          pageSize={10}
          pageSizeOptions={[10, 25, 50]}
        />
      </div>

      <div className="ledger-sheet">
        {mode === 'add' || mode === 'edit' ? (
          <>
            <h2>{mode === 'edit' ? 'Edit item' : 'Add item'}</h2>

            <div className="field-grid">
              <label>
                Name
                <input
                  className={fieldErrors.name ? 'invalid' : undefined}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                {fieldErrors.name && <p className="field-error">{fieldErrors.name}</p>}
              </label>
              <label>
                Category
                {form.isCombo ? (
                  <input value={COMBO_CATEGORY} disabled readOnly />
                ) : (
                  <Combobox
                    className={fieldErrors.category ? 'invalid' : undefined}
                    value={form.category}
                    options={distinctCategories}
                    onChange={(category) => setForm({ ...form, category })}
                  />
                )}
                {fieldErrors.category && <p className="field-error">{fieldErrors.category}</p>}
              </label>
              <label>
                {form.hasVariants ? 'Base price' : form.isCombo ? 'Combo price' : 'Price'}
                <input
                  type="number"
                  step="0.01"
                  className={fieldErrors.price ? 'invalid' : undefined}
                  value={form.price}
                  onChange={(e) => isMoneyInput(e.target.value) && setForm({ ...form, price: e.target.value, priceEdited: true })}
                />
                {form.isCombo && form.comboItems.length > 0 && (
                  <span className="hint">Sum of items: ${comboSum.toFixed(2)}</span>
                )}
                {fieldErrors.price && <p className="field-error">{fieldErrors.price}</p>}
              </label>
            </div>

            <div className="image-field">
              <span className="field-label">Photo</span>
              {/* The native input stays in the tab order but off-screen; the label is
                  the visible control (a drop zone that becomes the preview). The value
                  is cleared after each pick so re-choosing the same file after
                  "Remove" still fires onChange. */}
              <input
                id="menu-item-photo"
                type="file"
                className="visually-hidden"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  pickImage(e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
              />
              <label
                htmlFor="menu-item-photo"
                className={`photo-drop${imagePreview ? ' has-photo' : ''}${dragOver ? ' drag-over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  pickImage(e.dataTransfer.files?.[0] ?? null);
                }}
              >
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="" />
                    <span className="photo-drop-overlay">Change photo</span>
                  </>
                ) : (
                  <>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="14" rx="1.5" />
                      <circle cx="8.5" cy="10" r="1.5" />
                      <path d="M21 16l-5-5-8 8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>Add a photo</span>
                    <span className="photo-drop-hint">Click or drop · JPEG, PNG, WebP · up to 5 MB</span>
                  </>
                )}
              </label>
              {imagePreview && (
                <button type="button" className="link-btn" onClick={clearImage}>Remove photo</button>
              )}
              {imageError && <p className="field-error">{imageError}</p>}
            </div>

            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={form.available}
                onChange={(e) => setForm({ ...form, available: e.target.checked })}
              />
              Available for sale
            </label>
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
                  <div className="variant-editor-row-wrap" key={i}>
                    <div className="variant-editor-row">
                      <input
                        placeholder="Size name (e.g. Large)"
                        aria-label="Size name"
                        className={fieldErrors.variants?.[i] ? 'invalid' : undefined}
                        value={v.name}
                        onChange={(e) => updateVariantRow(i, 'name', e.target.value)}
                      />
                      <span className={`discount-unit-field${fieldErrors.variants?.[i] ? ' invalid' : ''}`}>
                        <span className="discount-unit">$</span>
                        <input
                          placeholder="0.00"
                          aria-label="Size price"
                          type="number"
                          step="0.01"
                          className="num"
                          value={v.price || ''}
                          onChange={(e) => updateVariantRow(i, 'price', e.target.value)}
                        />
                      </span>
                      <button type="button" className="remove-btn" onClick={() => removeVariantRow(i)} aria-label="Remove size">×</button>
                    </div>
                    {fieldErrors.variants?.[i] && <p className="field-error">{fieldErrors.variants[i]}</p>}
                  </div>
                ))}
                <button type="button" className="ghost" onClick={addVariantRow}>+ Add size</button>
              </div>
            )}

            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={form.isCombo}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    isCombo: e.target.checked,
                    category: e.target.checked ? COMBO_CATEGORY : f.category === COMBO_CATEGORY ? '' : f.category,
                  }))
                }
              />
              This is a combo
            </label>
            {form.isCombo && (
              <ComboPicker value={form.comboItems} onChange={setComboItems} candidates={comboCandidates} />
            )}

            {formError && <p className="field-error" role="alert">{formError}</p>}
            <div className="form-actions">
              <button type="button" className="primary" onClick={save}>Save</button>
              <button type="button" className="ghost" onClick={cancelForm}>Cancel</button>
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
                <p className="hint">{selected.comboItems?.length ? comboContentsSummary(selected.comboItems, items) : 'No items selected'}</p>
                {selectedSeparateTotal > selected.price && (
                  <div className="detail-row">
                    <span>Bought separately</span>
                    <span className="num combo-strike">${selectedSeparateTotal.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}
            <div className="form-actions">
              <button type="button" className="ghost" onClick={() => openEdit(selected)}>Edit</button>
              <button type="button" className="ghost" onClick={() => toggleAvailable(selected)}>
                {selected.available === false ? 'Mark available' : "Mark 86'd"}
              </button>
              <button type="button" className="ghost danger" onClick={() => confirmDelete(selected)}>Delete</button>
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
