import { useRef, useState } from 'react';
import { useFlipUp } from '../hooks/useFlipUp';
import { useDismissable } from '../hooks/useDismissable';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseISODate(value: string): { year: number; month: number; day: number } | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

/** Midnight *local time* on the given "YYYY-MM-DD" — unlike `new Date(iso)`,
 * which parses a bare date as UTC and shifts it by the timezone offset. */
export function isoDateToLocalDate(value: string): Date | null {
  const parsed = parseISODate(value);
  return parsed ? new Date(parsed.year, parsed.month, parsed.day) : null;
}

export function formatDisplay(value: string, withYear = true): string {
  const parsed = parseISODate(value);
  if (!parsed) return '';
  return `${MONTH_NAMES[parsed.month].slice(0, 3)} ${parsed.day}${withYear ? `, ${parsed.year}` : ''}`;
}

const todayISO = () => toISODate(new Date());

interface CalendarProps {
  /** Dates to mark as chosen; one for a single pick, two for a range's ends. */
  selected: string[];
  /** Inclusive range to tint between (the ends come from `selected`). */
  rangeStart?: string;
  rangeEnd?: string;
  /** Last pickable date (ISO); later days are disabled. */
  max?: string;
  onPick: (iso: string) => void;
  onHover?: (iso: string | null) => void;
  /** Month to show first: the earliest selected date, else this month. */
  initial?: string;
}

/** The month grid shared by `DatePicker` and `DateRangePicker`. */
function Calendar({ selected, rangeStart, rangeEnd, max, onPick, onHover, initial }: CalendarProps) {
  const start = parseISODate(initial ?? '') ?? { year: new Date().getFullYear(), month: new Date().getMonth() };
  const [viewYear, setViewYear] = useState(start.year);
  const [viewMonth, setViewMonth] = useState(start.month);
  /** Year grid shown in place of the month; `yearPage` is its first year. */
  const [yearPage, setYearPage] = useState<number | null>(null);
  const maxYear = max ? Number(max.slice(0, 4)) : Infinity;

  function changeMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  const cells: { day: number; iso: string; inMonth: boolean }[] = [];
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  for (let i = firstWeekday; i > 0; i--) {
    const d = new Date(viewYear, viewMonth, 1 - i);
    cells.push({ day: d.getDate(), iso: toISODate(d), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, iso: toISODate(new Date(viewYear, viewMonth, day)), inMonth: true });
  }
  for (let day = 1; cells.length % 7 !== 0; day++) {
    const d = new Date(viewYear, viewMonth + 1, day);
    cells.push({ day: d.getDate(), iso: toISODate(d), inMonth: false });
  }

  const today = todayISO();
  const inRange = (iso: string) => !!rangeStart && !!rangeEnd && iso > rangeStart && iso < rangeEnd;

  return (
    <>
      {yearPage !== null ? (
        <>
          <div className="date-picker-header">
            <span className="date-picker-title">{yearPage} – {yearPage + 11}</span>
            <div className="date-picker-nav">
              <button type="button" className="icon" aria-label="Earlier years" onClick={() => setYearPage(yearPage - 12)}>‹</button>
              <button type="button" className="icon" aria-label="Later years" disabled={yearPage + 12 > maxYear} onClick={() => setYearPage(yearPage + 12)}>›</button>
            </div>
          </div>
          <div className="date-picker-years">
            {Array.from({ length: 12 }, (_, i) => yearPage + i).map((y) => (
              <button
                type="button"
                key={y}
                className={y === viewYear ? 'selected' : undefined}
                disabled={y > maxYear}
                onClick={() => {
                  setViewYear(y);
                  // Keep the month inside the allowed range when landing on the max year.
                  if (max && y === maxYear) setViewMonth(Math.min(viewMonth, Number(max.slice(5, 7)) - 1));
                  setYearPage(null);
                }}
              >
                {y}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
      <div className="date-picker-header">
        <button type="button" className="date-picker-title date-picker-title-btn" title="Choose a year" onClick={() => setYearPage(viewYear - 11)}>
          {MONTH_NAMES[viewMonth]} {viewYear}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M2 3.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="date-picker-nav">
          <button type="button" className="icon" aria-label="Previous month" onClick={() => changeMonth(-1)}>‹</button>
          <button
            type="button"
            className="icon"
            aria-label="Next month"
            disabled={!!max && toISODate(new Date(viewYear, viewMonth + 1, 1)) > max}
            onClick={() => changeMonth(1)}
          >
            ›
          </button>
        </div>
      </div>
      <div className="date-picker-grid date-picker-weekdays" aria-hidden="true">
        {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
      </div>
      <div className="date-picker-grid" onMouseLeave={() => onHover?.(null)}>
        {cells.map((cell) => {
          const disabled = !!max && cell.iso > max;
          const isSelected = selected.includes(cell.iso);
          return (
            <button
              type="button"
              key={cell.iso}
              className={[
                cell.inMonth ? '' : 'muted',
                isSelected ? 'selected' : '',
                inRange(cell.iso) ? 'in-range' : '',
                cell.iso === today ? 'today' : '',
              ].filter(Boolean).join(' ') || undefined}
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => onPick(cell.iso)}
              onMouseEnter={() => !disabled && onHover?.(cell.iso)}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
        </>
      )}
    </>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <rect x="2" y="3" width="12" height="11" rx="1.5" />
      <path d="M2 6.5h12M5 2v2.5M11 2v2.5" strokeLinecap="round" />
    </svg>
  );
}

interface DatePickerProps {
  /** ISO date string "YYYY-MM-DD", or "" for no date selected. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Last pickable date (ISO). */
  max?: string;
}

/** Ledger-styled calendar dropdown, replacing the native <input type="date">
 * whose popup can't be restyled with CSS in any browser. */
export function DatePicker({ value, onChange, placeholder = 'Any date', className, max }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useDismissable(ref, open, () => setOpen(false));
  const openUp = useFlipUp(ref, panelRef, open);

  function pick(iso: string) {
    onChange(iso);
    setOpen(false);
  }

  return (
    <div className={`date-picker${className ? ` ${className}` : ''}`} ref={ref}>
      <button type="button" className="date-picker-toggle" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className={value ? undefined : 'placeholder'}>{value ? formatDisplay(value) : placeholder}</span>
        <CalendarIcon />
      </button>
      {open && (
        <div className={`date-picker-panel${openUp ? ' open-up' : ''}`} role="dialog" aria-label="Choose a date" ref={panelRef}>
          <Calendar selected={value ? [value] : []} max={max} onPick={pick} initial={value || undefined} />
          <div className="date-picker-footer">
            <button type="button" className="ghost" onClick={() => pick('')}>Clear</button>
            <button type="button" className="ghost" onClick={() => pick(todayISO())}>Today</button>
          </div>
        </div>
      )}
    </div>
  );
}

export interface DateRange {
  /** ISO dates, inclusive; both "" means no limit. */
  from: string;
  to: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
  /** Shown when both ends are empty. */
  placeholder?: string;
  className?: string;
  max?: string;
}

/** Shifts today by `days` and returns the ISO date. */
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toISODate(d);
}

export function formatRange(range: DateRange): string {
  if (!range.from && !range.to) return '';
  if (range.from === range.to) return formatDisplay(range.from);
  if (!range.to) return `From ${formatDisplay(range.from)}`;
  if (!range.from) return `Up to ${formatDisplay(range.to)}`;
  const sameYear = range.from.slice(0, 4) === range.to.slice(0, 4);
  return `${formatDisplay(range.from, !sameYear)} – ${formatDisplay(range.to)}`;
}

/** Same calendar, two clicks: the first sets the start, the second the end
 * (either order), with the days between tinted as you hover. Presets cover
 * the common spans; "All time" clears both ends. */
export function DateRangePicker({ value, onChange, placeholder = 'All time', className, max }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  /** Start of a range whose end hasn't been clicked yet. */
  const [pending, setPending] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useDismissable(ref, open, () => { setOpen(false); setPending(null); });
  const openUp = useFlipUp(ref, panelRef, open);

  function pick(iso: string) {
    if (pending === null) {
      setPending(iso);
      return;
    }
    const [from, to] = [pending, iso].sort();
    onChange({ from, to });
    setPending(null);
    setOpen(false);
  }

  function preset(range: DateRange) {
    onChange(range);
    setPending(null);
    setOpen(false);
  }

  const today = todayISO();
  // While the second click is pending, preview the span to the hovered day.
  const [previewStart, previewEnd] = pending !== null
    ? [pending, hover ?? pending].sort()
    : [value.from, value.to];
  const selected = pending !== null ? [pending] : [value.from, value.to].filter(Boolean);
  const label = formatRange(value);

  return (
    <div className={`date-picker${className ? ` ${className}` : ''}`} ref={ref}>
      <button type="button" className="date-picker-toggle" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className={label ? undefined : 'placeholder'}>{label || placeholder}</span>
        <CalendarIcon />
      </button>
      {open && (
        <div className={`date-picker-panel${openUp ? ' open-up' : ''}`} role="dialog" aria-label="Choose a date range" ref={panelRef}>
          <p className="date-picker-hint">{pending ? `From ${formatDisplay(pending)} — now pick the end` : 'Pick a start day, then an end day'}</p>
          <Calendar
            selected={selected}
            rangeStart={previewStart}
            rangeEnd={previewEnd}
            max={max}
            onPick={pick}
            onHover={setHover}
            initial={value.from || value.to || undefined}
          />
          <div className="date-picker-footer">
            <button type="button" className="ghost" onClick={() => preset({ from: today, to: today })}>Today</button>
            <button type="button" className="ghost" onClick={() => preset({ from: daysAgo(6), to: today })}>Last 7 days</button>
            <button type="button" className="ghost" onClick={() => preset({ from: today.slice(0, 8) + '01', to: today })}>This month</button>
            <button type="button" className="ghost" onClick={() => preset({ from: '', to: '' })}>All time</button>
          </div>
        </div>
      )}
    </div>
  );
}
