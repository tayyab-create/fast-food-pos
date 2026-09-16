import { useEffect, useRef, useState } from 'react';

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

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

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
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span>{label}</span>
        <span className={`dropdown-caret${open ? ' open' : ''}`}>▾</span>
      </button>
      {open && (
        <ul className="dropdown-list" role="listbox">
          {options.map((opt) => (
            <li
              key={String(opt.value)}
              role="option"
              aria-selected={opt.value === value}
              className={opt.value === value ? 'selected' : ''}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
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

/**
 * Same listbox as Dropdown, but checkbox-style options that toggle in place
 * without closing the list — for filters where more than one value can
 * apply at once (e.g. "show these categories").
 */
export function MultiSelectDropdown({ values, options, onChange, placeholder = 'All', className }: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function toggle(opt: string) {
    onChange(values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt]);
  }

  const label = values.length === 0 ? placeholder : values.length === 1 ? values[0] : `${values.length} selected`;

  return (
    <div className={`dropdown${className ? ` ${className}` : ''}`} ref={ref}>
      <button type="button" className="dropdown-toggle" onClick={() => setOpen((v) => !v)}>
        <span>{label}</span>
        <span className={`dropdown-caret${open ? ' open' : ''}`}>▾</span>
      </button>
      {open && (
        <ul className="dropdown-list" role="listbox">
          {options.map((opt) => (
            <li key={opt} role="option" aria-selected={values.includes(opt)} onClick={() => toggle(opt)}>
              <span className={`dropdown-check${values.includes(opt) ? ' checked' : ''}`} />
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
