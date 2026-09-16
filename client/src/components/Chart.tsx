import { useState } from 'react';

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
  /** Renders a value for the on-chart labels, e.g. money. */
  format?: (v: number) => string;
  /** Renders the axis steps; defaults to `format`. Use it for rounder axis figures. */
  axisFormat?: (v: number) => string;
}

const STYLE_KEY = 'pos.chartStyle.';
const GRID_STEPS = 4;
const H = 160;

function readStyle(name: string): Style {
  try {
    return localStorage.getItem(STYLE_KEY + name) === 'line' ? 'line' : 'bars';
  } catch {
    return 'bars';
  }
}

/** Smallest "round" step (1, 2, 2.5, 5 × 10ⁿ) whose 4 multiples cover `peak`. */
function niceStep(peak: number): number {
  const raw = peak / GRID_STEPS;
  const mag = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= raw) return m * mag;
  return 10 * mag;
}

/** Bars or a line over the same points, on a ruled grid with a labelled
 * value axis. Values are written on the chart wherever there's room. The
 * style toggle sits in the corner and is remembered per chart.
 *
 * Hover uses a custom tooltip (never the `title` attribute — the browser's
 * native tooltip has a ~1s delay before it appears), positioned in the same
 * percentage coordinate space as the bars/points so it never has to measure
 * the DOM. */
export function Chart({ points, name, emptyMessage, format = (v) => String(v), axisFormat = format }: ChartProps) {
  const [style, setStyleState] = useState<Style>(() => readStyle(name));
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const peak = Math.max(0, ...points.map((p) => p.value));
  if (peak === 0) return <p className="hint">{emptyMessage}</p>;

  function setStyle(next: Style) {
    setStyleState(next);
    try {
      localStorage.setItem(STYLE_KEY + name, next);
    } catch {
      /* per-viewer convenience only */
    }
  }

  const step = niceStep(peak);
  const top = step * GRID_STEPS;
  const gridLines = Array.from({ length: GRID_STEPS + 1 }, (_, i) => i * step);
  const pctOf = (v: number) => (v / top) * 100;

  // Write a value when there's room: every bar up to 16 points, thinned beyond that, the peak always.
  const every = points.length > 16 ? Math.ceil(points.length / 16) : 1;
  const showValue = (p: ChartPoint, i: number) => p.value > 0 && (i % every === 0 || p.value === peak);

  const W = 100;
  const x = (i: number) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W);
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${(H - (p.value / top) * H).toFixed(2)}`).join(' ');

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  // Anchor point for the tooltip, in the plot's own percentage coordinates.
  const hoverPos = hoverIndex !== null
    ? { left: style === 'bars' ? ((hoverIndex + 0.5) / points.length) * 100 : x(hoverIndex), bottom: pctOf(points[hoverIndex].value) }
    : null;

  return (
    <figure className={`chart ${style}`} aria-label={name}>
      <div className="chart-style" role="group" aria-label="Chart style">
        <button type="button" className={style === 'bars' ? 'active' : ''} aria-pressed={style === 'bars'} onClick={() => setStyle('bars')} title="Bars">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="0" y="5" width="3" height="7" /><rect x="4.5" y="1" width="3" height="11" /><rect x="9" y="7" width="3" height="5" /></svg>
        </button>
        <button type="button" className={style === 'line' ? 'active' : ''} aria-pressed={style === 'line'} onClick={() => setStyle('line')} title="Line">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M0.5 9.5l3.5-4 3 2 4.5-6" /></svg>
        </button>
      </div>

      <div className="chart-axis" aria-hidden="true">
        {gridLines.map((v) => (
          <span key={v} style={{ bottom: `${pctOf(v)}%` }}>{axisFormat(v)}</span>
        ))}
      </div>

      <div className="chart-plot" style={{ height: H }} onMouseLeave={() => setHoverIndex(null)}>
        <div className="chart-grid" aria-hidden="true">
          {gridLines.map((v) => <span key={v} style={{ bottom: `${pctOf(v)}%` }} />)}
        </div>

        {style === 'bars' ? (
          <ol className="chart-bars">
            {points.map((p, i) => (
              <li key={i} onMouseEnter={() => setHoverIndex(i)}>
                <span className="chart-bar" style={{ height: `${pctOf(p.value)}%` }}>
                  {showValue(p, i) && <span className="chart-value">{format(p.value)}</span>}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <>
            <svg className="chart-line" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
              <path d={`${linePath} L${W},${H} L0,${H} Z`} className="chart-area" />
              <path d={linePath} className="chart-path" vectorEffect="non-scaling-stroke" />
            </svg>
            {points.map((p, i) => (
              <span
                key={i}
                className="chart-dot"
                style={{ left: `${x(i)}%`, bottom: `${pctOf(p.value)}%` }}
                onMouseEnter={() => setHoverIndex(i)}
              >
                {showValue(p, i) && <span className="chart-value">{format(p.value)}</span>}
              </span>
            ))}
          </>
        )}

        {hovered && hoverPos && (
          <span className="chart-tooltip" role="tooltip" style={{ left: `${hoverPos.left}%`, bottom: `${hoverPos.bottom}%` }}>
            {hovered.title}
          </span>
        )}
      </div>

      <div className="chart-labels" aria-hidden="true">
        {points.map((p, i) =>
          style === 'bars' ? (
            <span key={i} className="chart-label-slot">{p.label}</span>
          ) : (
            <span key={i} className="chart-label-point" style={{ left: `${x(i)}%` }}>{p.label}</span>
          ),
        )}
      </div>
    </figure>
  );
}
