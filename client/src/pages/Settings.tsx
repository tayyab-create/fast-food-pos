import { useEffect, useState } from 'react';
import { createLabel, deleteLabel, getLabels, renameLabel } from '../api/labels';
import { getSettings, updateSettings } from '../api/settings';
import { ConfirmModal, ConfirmWarning } from '../components/ConfirmModal';
import { LedgerTable } from '../components/LedgerTable';
import { useToast } from '../components/Toast';
import type { Label, LabelKind } from '../types';

const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 500;
const MAX_PAGE_SIZE_OPTIONS = 8;

const COPY: Record<LabelKind, { title: string; singular: string; hint: string; onDelete: string; max: number }> = {
  category: {
    title: 'Categories',
    singular: 'category',
    hint: 'Categories are the tabs on the Cashier grid. One stays here even when no item uses it.',
    onDelete: 'Items in it move to "Other". The items themselves are untouched.',
    max: 40,
  },
  tag: {
    title: 'Tags',
    singular: 'tag',
    hint: 'Tags are the small labels on Cashier tiles. One stays here even when no item wears it.',
    onDelete: 'It comes off every item that has it. The items themselves are untouched.',
    max: 16,
  },
};

/** One editable list of labels: add, rename in place, delete with a confirm. */
function LabelSection({ kind }: { kind: LabelKind }) {
  const copy = COPY[kind];
  const toast = useToast();
  const [labels, setLabels] = useState<Label[] | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Label | null>(null);

  async function load() {
    try {
      setLabels(await getLabels(kind));
    } catch (err) {
      toast(err instanceof Error ? err.message : `Could not load ${copy.title.toLowerCase()}.`, { kind: 'error' });
      setLabels([]);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per kind
  }, [kind]);

  async function add() {
    const name = draft.trim();
    if (!name || adding) return;
    setAdding(true);
    try {
      await createLabel(kind, name);
      setDraft('');
      await load();
      toast(`${name} added`);
    } catch (err) {
      toast(err instanceof Error ? err.message : `Could not add the ${copy.singular}.`, { kind: 'error' });
    } finally {
      setAdding(false);
    }
  }

  async function commitRename() {
    if (!editing || saving) return;
    const current = labels?.find((l) => l._id === editing.id);
    const name = editing.name.trim();
    if (!current || !name || name === current.name) {
      setEditing(null);
      return;
    }
    setSaving(true);
    try {
      await renameLabel(kind, editing.id, name);
      setEditing(null);
      await load();
      toast(current.itemCount ? `Renamed on ${current.itemCount} item${current.itemCount === 1 ? '' : 's'}` : `Renamed to ${name}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not rename.', { kind: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-section">
      <div className="list-header">
        <div className="section-header">{copy.title}</div>
        <form
          className="settings-add"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            placeholder={`New ${copy.singular}`}
            aria-label={`New ${copy.singular}`}
            maxLength={copy.max}
            value={draft}
            disabled={adding}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className="primary" disabled={!draft.trim() || adding}>
            {adding && <span className="spinner" aria-hidden="true" />}
            Add
          </button>
        </form>
      </div>
      <p className="hint">{copy.hint}</p>

      <LedgerTable
        columns={[
          {
            header: 'Name',
            render: (l) =>
              editing?.id === l._id ? (
                <input
                  className="settings-rename"
                  autoFocus
                  maxLength={copy.max}
                  aria-label={`Rename ${l.name}`}
                  value={editing.name}
                  disabled={saving}
                  onChange={(e) => setEditing({ id: l._id, name: e.target.value })}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditing(null);
                  }}
                />
              ) : (
                l.name
              ),
            sortValue: (l) => l.name.toLowerCase(),
          },
          {
            header: 'Items',
            numeric: true,
            render: (l) => (l.itemCount === 0 ? <span className="muted-text">unused</span> : l.itemCount),
            sortValue: (l) => l.itemCount,
          },
          {
            header: '',
            render: (l) => (
              <span className="settings-actions">
                <button type="button" className="ghost" disabled={saving} onClick={() => setEditing({ id: l._id, name: l.name })}>Rename</button>
                <button type="button" className="ghost danger" disabled={saving} onClick={() => setDeleteTarget(l)}>Delete</button>
              </span>
            ),
          },
        ]}
        rows={labels ?? []}
        rowKey={(l) => l._id}
        loading={labels === null}
        emptyMessage={`No ${copy.title.toLowerCase()} yet.`}
      />

      {deleteTarget && (
        <ConfirmModal
          title={`Delete ${deleteTarget.name}?`}
          danger
          confirmLabel={`Delete ${copy.singular}`}
          cancelLabel="Keep it"
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await deleteLabel(kind, deleteTarget._id);
            await load();
            toast(`${deleteTarget.name} deleted`);
          }}
          message={
            <>
              <p>
                {deleteTarget.itemCount === 0
                  ? `No item uses this ${copy.singular}.`
                  : `${deleteTarget.itemCount} item${deleteTarget.itemCount === 1 ? ' uses' : 's use'} this ${copy.singular}. ${copy.onDelete}`}
              </p>
              <ConfirmWarning>This can't be undone.</ConfirmWarning>
            </>
          }
        />
      )}
    </section>
  );
}

/** Editable list of "Rows:" choices offered on every paginated table. A
 * plain number list, not a full CRUD table like LabelSection — chips with
 * one add field, matching how filters already show a removable selection. */
function PaginationSection() {
  const toast = useToast();
  const [options, setOptions] = useState<number[] | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setOptions((await getSettings()).pageSizeOptions);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not load pagination settings.', { kind: 'error' });
      setOptions([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function save(next: number[]) {
    if (saving) return;
    setSaving(true);
    const sorted = [...next].sort((a, b) => a - b);
    try {
      await updateSettings({ pageSizeOptions: sorted });
      setOptions(sorted);
      toast('Pagination options saved');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save.', { kind: 'error' });
    } finally {
      setSaving(false);
    }
  }

  function add() {
    const n = Number(draft);
    if (!options || saving || !draft.trim()) return;
    if (!Number.isInteger(n) || n < MIN_PAGE_SIZE || n > MAX_PAGE_SIZE) {
      toast(`Enter a whole number between ${MIN_PAGE_SIZE} and ${MAX_PAGE_SIZE}`, { kind: 'error' });
      return;
    }
    if (options.includes(n)) {
      toast(`${n} is already in the list`, { kind: 'error' });
      return;
    }
    if (options.length >= MAX_PAGE_SIZE_OPTIONS) {
      toast(`At most ${MAX_PAGE_SIZE_OPTIONS} page sizes`, { kind: 'error' });
      return;
    }
    setDraft('');
    save([...options, n]);
  }

  function remove(n: number) {
    if (!options || saving) return;
    if (options.length <= 1) {
      toast('At least one page size is required', { kind: 'error' });
      return;
    }
    save(options.filter((o) => o !== n));
  }

  return (
    <section className="settings-section">
      <div className="list-header">
        <div className="section-header">Pagination</div>
        <form
          className="settings-add"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            type="number"
            min={MIN_PAGE_SIZE}
            max={MAX_PAGE_SIZE}
            placeholder="New page size"
            aria-label="New page size"
            value={draft}
            disabled={saving || options === null}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className="primary" disabled={!draft.trim() || saving || options === null}>
            {saving && <span className="spinner" aria-hidden="true" />}
            Add
          </button>
        </form>
      </div>
      <p className="hint">
        Choices offered in every table's "Rows:" picker (Menu, Kitchen, Reports). Every table still defaults to 10 rows regardless of what's offered here.
      </p>
      {options === null ? (
        <p className="hint">Loading…</p>
      ) : options.length === 0 ? (
        <p className="empty">No page sizes yet — add one above.</p>
      ) : (
        <div className="active-filters" role="list" aria-label="Page size options">
          {options.map((n) => (
            <span className="filter-chip" role="listitem" key={n}>
              {n}
              <button type="button" aria-label={`Remove ${n}`} disabled={saving} onClick={() => remove(n)}>×</button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

export function Settings() {
  return (
    <div className="settings-page">
      <LabelSection kind="category" />
      <LabelSection kind="tag" />
      <PaginationSection />
    </div>
  );
}
