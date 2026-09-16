import { useEffect, useRef, useState } from 'react';

interface ComboboxProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * A text input with type-ahead suggestions from `options`, but never forces a
 * match — whatever text is in the field is the value. Shows all options on
 * focus, narrows by substring as the user types, and hides entirely (not an
 * empty list) once nothing matches, so a brand-new value can be typed freely.
 */
export function Combobox({ value, options, onChange, placeholder, className }: ComboboxProps) {
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

  const query = value.trim().toLowerCase();
  const matches = query
    ? options.filter((o) => o.toLowerCase().includes(query) && o.toLowerCase() !== query)
    : options;

  return (
    <div className="combobox" ref={ref}>
      <input
        className={className}
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
      />
      {open && matches.length > 0 && (
        <ul className="dropdown-list combobox-list" role="listbox">
          {matches.map((opt) => (
            <li
              key={opt}
              role="option"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
