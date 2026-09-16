import { useRef, useState } from 'react';

export interface ChartPoint {
  /** Short text under the point; '' leaves the slot unlabelled. */
  label: string;
  value: number;
  /** Tooltip. */
  title: string;
}

type Style = 'bars' | 'line';

interface ChartProps {
  points: ChartPoint[];
  /** Accessible name for the chart; also keys the remembered style. */
  name: string;
  emptyMessage: string;
  /** Renders a value for the on-chart labels, e.g. money. Defaults to the plain number. */
  format?: (v: number) => string;
}

const STYLE_KEY = 'pos.chartStyle.';
const H = 140;
const LINE_PAD = 14;

function readStyle(name: string): Style {
  try {
    return localStorage.getItem(STYLE_KEY + name) === 'line' ? 'line' : 'bars';
  } catch {
    return 'bars';
  }
}

/** Bars or a line over the same points, with the values written on the
 * chart wherever there's room. The style toggle sits in the chart's corner
 * and is remembered per chart. */
export function Chart({ points, name, emptyMessage, format = (v) => String(v) }: ChartProps) {
  const [style, setStyleState] = useState<Style>(() => readStyle(name));
  const ref = useRef<HTMLDivElement>(null);
  const peak = Math.max(0, ...points.map((p) => p.value));

  function setStyle(next: Style) {
    setStyleState(next);
    try {
      localStorage.setItem(STYLE_KEY + name, next);
    } catch {
      /* per-viewer convenience only */
    }
  }

  if (peak === 0) return <p className="hint">{emptyMessage}</p>;

  // Label a bar when it's tall enough to matter and bars aren't too crowded.
  const labelEvery = points.length > 16 ? Math.ceil(points.length / 16) : 1;
  const showValue = (p: ChartPoint, i: number) => p.value > 0 && (points.length <= 16 || i % labelEvery === 0 || p.value === peak);

  const toggle = (
    <div className="chart-style" role="group" aria-label="Chart style">
      <button type="button" className={style === 'bars' ? 'active' : ''} aria-pressed={style === 'bars'} onClick={() => setStyle('bars')} title="Bars">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="0" y="5" width="3" height="7" /><rect x="4.5" y="1" width="3" height="11" /><rect x="9" y="7" width="3" height="5" /></svg>
      </button>
      <button type="button" className={style === 'line' ? 'active' : ''} aria-pressed={style === 'line'} onClick={() => setStyle('line')} title="Line">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M0.5 9.5l3.5-4 3 2 4.5-6" /></svg>
      </button>
    </div>
  );

  if (style === 'line') {
    const W = 100;
    const x = (i: number) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W);
    const y = (v: number) => LINE_PAD + (1 - v / peak) * (H - LINE_PAD * 2);
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(' ');
    return (
      <div className="chart" ref={ref}>
        {toggle}
        <svg className="chart-line" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={name}>
          <path d={`${path} L${W},${H} L0,${H} Z`} className="chart-area" />
          <path d={path} className="chart-path" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="chart-overlay">
          {points.map((p, i) => (
            <span
              key={i}
              className="chart-dot"
              style={{ left: `${x(i)}%`, top: `${(y(p.value) / H) * 100}%` }}
              title={p.title}
            >
              {showValue(p, i) && <span className="chart-value">{format(p.value)}</span>}
            </span>
          ))}
        </div>
        <div className="chart-labels">
          {points.map((p, i) => <span key={i} style={{ left: `${x(i)}%` }}>{p.label}</span>)}
        </div>
      </div>
    );
  }

  return (
    <div className="chart" ref={ref}>
      {toggle}
      <ol className="chart-bars" aria-label={name}>
        {points.map((p, i) => (
          <li key={i} title={p.title}>
            {showValue(p, i) && <span className="chart-value">{format(p.value)}</span>}
            <span className="chart-bar" style={{ height: `${(p.value / peak) * 100}%` }} />
            <span className="chart-label">{p.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
