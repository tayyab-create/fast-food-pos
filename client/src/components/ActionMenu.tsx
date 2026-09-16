import { useRef, useState, type ReactNode } from 'react';
import { useDismissable } from '../hooks/useDismissable';
import { useFlipUp } from '../hooks/useFlipUp';

export interface ActionMenuItem {
  key: string;
  label: string;
  onSelect: () => void;
  /** Colours the row like the app's semantic ghost buttons. */
  tone?: 'danger' | 'caution' | 'success';
  /** Starts a new visual group (a rule above the row). */
  startGroup?: boolean;
  disabled?: boolean;
}

interface ActionMenuProps {
  label: string;
  items: ActionMenuItem[];
  disabled?: boolean;
}

/** A single "Actions ▾" button that opens the app's standard dropdown list —
 * used instead of a row of loose buttons when there are more actions than a
 * toolbar can hold calmly. Each item fires and closes the menu; it never
 * holds a selected value the way `Dropdown` does. */
export function ActionMenu({ label, items, disabled }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  useDismissable(ref, open, () => setOpen(false));
  const openUp = useFlipUp(ref, listRef, open);

  return (
    <div className={`dropdown action-menu${disabled ? ' disabled' : ''}`} ref={ref} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="dropdown-toggle primary" disabled={disabled} aria-haspopup="menu" aria-expanded={open} onClick={() => !disabled && setOpen((v) => !v)}>
        <span>{label}</span>
        <svg className={`dropdown-caret${open ? ' open' : ''}`} width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M2 3.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className={`dropdown-list${openUp ? ' open-up' : ''}`} role="menu" ref={listRef}>
          {items.map((item) => (
            <li key={item.key} className={item.startGroup ? 'action-menu-group-start' : undefined}>
              <button
                type="button"
                role="menuitem"
                className={item.tone}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A labelled text input attached to an ActionMenu item that needs a value
 * (category, tag) — rendered by the caller in place of the menu once that
 * item is picked, so the bar itself never grows a permanent input. */
export function ActionMenuInlineForm({
  label,
  children,
  onSubmit,
  onCancel,
  submitLabel = 'Apply',
  submitDisabled,
  busy,
}: {
  label: string;
  children: ReactNode;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
  busy?: boolean;
}) {
  return (
    <form
      className="bulk-inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <span className="bulk-inline-form-label">{label}</span>
      {children}
      <button type="submit" className="primary" disabled={submitDisabled || busy}>
        {busy && <span className="spinner" aria-hidden="true" />}
        {submitLabel}
      </button>
      <button type="button" className="ghost" disabled={busy} onClick={onCancel}>Cancel</button>
    </form>
  );
}
