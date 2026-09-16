import { useEffect, useState } from 'react';
import { createLabel, deleteLabel, getLabels, renameLabel } from '../api/labels';
import { ConfirmModal, ConfirmWarning } from '../components/ConfirmModal';
import { LedgerTable } from '../components/LedgerTable';
import { useToast } from '../components/Toast';
import type { Label, LabelKind } from '../types';

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

export function Settings() {
  return (
    <div className="settings-page">
      <LabelSection kind="category" />
      <LabelSection kind="tag" />
    </div>
  );
}
