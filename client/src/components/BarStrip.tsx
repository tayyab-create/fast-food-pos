export interface Bar {
  /** Short text under the bar; '' leaves the slot unlabelled. */
  label: string;
  value: number;
  /** Tooltip. */
  title: string;
}

interface BarStripProps {
  bars: Bar[];
  /** Accessible name for the strip. */
  name: string;
  emptyMessage: string;
}

/** A row of thin bars scaled to the tallest — orders by hour, revenue by day,
 * and the like. Pure CSS heights; hover for the exact figure. */
export function BarStrip({ bars, name, emptyMessage }: BarStripProps) {
  const peak = Math.max(0, ...bars.map((b) => b.value));
  if (peak === 0) return <p className="hint">{emptyMessage}</p>;
  return (
    <ol className="hour-bars" aria-label={name}>
      {bars.map((b, i) => (
        <li key={i} title={b.title}>
          <span className="hour-bar" style={{ height: `${(b.value / peak) * 100}%` }} />
          <span className="hour-label">{b.label}</span>
        </li>
      ))}
    </ol>
  );
}
