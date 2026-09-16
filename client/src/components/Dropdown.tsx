import { useRef, useState } from 'react';
import { useFlipUp } from '../hooks/useFlipUp';
import { useDismissable } from '../hooks/useDismissable';

function DropdownCaret({ open }: { open: boolean }) {
  return (
    <svg
      className={`dropdown-caret${open ? ' open' : ''}`}
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M2 3.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface DropdownOption<T> {
  value: T;
  label: string;
}

interface DropdownProps<T> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Shown in the toggle instead of the matched option's label (e.g. a "Custom…" state). */
  displayLabel?: string;
  className?: string;
}

/** Single-select listbox replacing native <select>. Options are real buttons,
 * so Tab/Enter/Space work without any extra key handling. */
export function Dropdown<T extends string | number>({
  value,
  options,
  onChange,
  disabled,
  displayLabel,
  className,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  useDismissable(ref, open, () => setOpen(false));
  const openUp = useFlipUp(ref, listRef, open);

  const label = displayLabel ?? options.find((o) => o.value === value)?.label ?? String(value);

  return (
    <div
      className={`dropdown${className ? ` ${className}` : ''}${disabled ? ' disabled' : ''}`}
      ref={ref}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="dropdown-toggle"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span>{label}</span>
        <DropdownCaret open={open} />
      </button>
      {open && (
        <ul className={`dropdown-list${openUp ? ' open-up' : ''}`} role="listbox" ref={listRef}>
          {options.map((opt) => (
            <li key={String(opt.value)}>
              <button
                type="button"
                role="option"
                aria-selected={opt.value === value}
                className={opt.value === value ? 'selected' : undefined}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Convenience wrapper for the common case: options are plain strings, used as both value and label. */
export function SimpleDropdown({
  value,
  options,
  onChange,
  className,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <Dropdown
      value={value}
      options={options.map((o) => ({ value: o, label: o }))}
      onChange={onChange}
      className={className}
    />
  );
}

interface MultiSelectDropdownProps {
  values: string[];
  options: string[];
  onChange: (values: string[]) => void;
  /** Shown in the toggle when nothing is selected. */
  placeholder?: string;
  className?: string;
}

/** Same listbox as Dropdown, but checkbox-style options that toggle in place
 * without closing the list — for filters where more than one value can
 * apply at once (e.g. "show these categories"). */
export function MultiSelectDropdown({ values, options, onChange, placeholder = 'All', className }: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  useDismissable(ref, open, () => setOpen(false));
  const openUp = useFlipUp(ref, listRef, open);

  function toggle(opt: string) {
    onChange(values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt]);
  }

  const label = values.length === 0 ? placeholder : values.length === 1 ? values[0] : `${values.length} selected`;

  return (
    <div className={`dropdown${className ? ` ${className}` : ''}`} ref={ref}>
      <button
        type="button"
        className="dropdown-toggle"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{label}</span>
        <DropdownCaret open={open} />
      </button>
      {open && (
        <ul className={`dropdown-list${openUp ? ' open-up' : ''}`} role="listbox" aria-multiselectable="true" ref={listRef}>
          {options.map((opt) => {
            const checked = values.includes(opt);
            return (
              <li key={opt}>
                <button type="button" role="option" aria-selected={checked} onClick={() => toggle(opt)}>
                  <span className={`dropdown-check${checked ? ' checked' : ''}`} aria-hidden="true" />
                  {opt}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
