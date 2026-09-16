import { useEffect, useRef, useState } from 'react';

interface DatePickerProps {
  /** ISO date string "YYYY-MM-DD", or "" for no date selected. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toISODate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseISODate(value: string): { year: number; month: number; day: number } | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

function formatDisplay(value: string): string {
  const parsed = parseISODate(value);
  if (!parsed) return '';
  return `${MONTH_NAMES[parsed.month].slice(0, 3)} ${parsed.day}, ${parsed.year}`;
}

/** Ledger-styled calendar dropdown, replacing the native <input type="date">
 * whose popup can't be restyled with CSS in any browser. */
export function DatePicker({ value, onChange, placeholder = 'mm/dd/yyyy', className }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const selected = parseISODate(value);
  const [viewYear, setViewYear] = useState(selected?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.month ?? today.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Re-sync the visible month to the current value each time it opens —
    // deliberately not reacting to `value` while closed.
    const parsed = parseISODate(value);
    setViewYear(parsed?.year ?? today.getFullYear());
    setViewMonth(parsed?.month ?? today.getMonth());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
  }, [open]);

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

  function changeMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const cells: { day: number; iso: string; inMonth: boolean }[] = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ day, iso: toISODate(y, m, day), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, iso: toISODate(viewYear, viewMonth, day), inMonth: true });
  }
  let nextDay = 1;
  const m = viewMonth === 11 ? 0 : viewMonth + 1;
  const y = viewMonth === 11 ? viewYear + 1 : viewYear;
  while (cells.length % 7 !== 0) {
    cells.push({ day: nextDay, iso: toISODate(y, m, nextDay), inMonth: false });
    nextDay++;
  }

  const todayISO = toISODate(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className={`date-picker${className ? ` ${className}` : ''}`} ref={ref}>
      <button type="button" className="date-picker-toggle" onClick={() => setOpen((v) => !v)}>
        <span className={value ? undefined : 'placeholder'}>{value ? formatDisplay(value) : placeholder}</span>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
          <rect x="2" y="3" width="12" height="11" rx="1.5" />
          <path d="M2 6.5h12M5 2v2.5M11 2v2.5" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="date-picker-panel">
          <div className="date-picker-header">
            <span className="date-picker-title">{MONTH_NAMES[viewMonth]} {viewYear}</span>
            <div className="date-picker-nav">
              <button type="button" className="icon" aria-label="Previous month" onClick={() => changeMonth(-1)}>‹</button>
              <button type="button" className="icon" aria-label="Next month" onClick={() => changeMonth(1)}>›</button>
            </div>
          </div>
          <div className="date-picker-grid date-picker-weekdays">
            {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
          </div>
          <div className="date-picker-grid">
            {cells.map((cell, i) => (
              <button
                type="button"
                key={i}
                className={[
                  cell.inMonth ? '' : 'muted',
                  cell.iso === value ? 'selected' : '',
                  cell.iso === todayISO ? 'today' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => {
                  onChange(cell.iso);
                  setOpen(false);
                }}
              >
                {cell.day}
              </button>
            ))}
          </div>
          <div className="date-picker-footer">
            <button type="button" className="ghost" onClick={() => { onChange(''); setOpen(false); }}>Clear</button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                onChange(todayISO);
                setOpen(false);
              }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
