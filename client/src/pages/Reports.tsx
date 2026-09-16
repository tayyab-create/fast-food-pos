import { useEffect, useState } from 'react';
import { getSummaryReport } from '../api/reports';
import { getOrders } from '../api/orders';
import { ActiveFilters } from '../components/ActiveFilters';
import { Chart } from '../components/Chart';
import { DateRangePicker, formatDisplay, formatRange, isoDateToLocalDate, toISODate, type DateRange } from '../components/DatePicker';
import { MultiSelectDropdown } from '../components/Dropdown';
import { LedgerTable } from '../components/LedgerTable';
import { OrderDetailModal } from '../components/OrderDetailModal';
import { downloadCsv } from '../csv';
import type { SummaryReport, Order, OrderStatus, OrderType, ReportBucket } from '../types';

const STATUSES: OrderStatus[] = ['pending', 'preparing', 'ready', 'completed', 'voided'];
const ORDER_TYPES: OrderType[] = ['dine-in', 'takeout', 'delivery'];
const DAY_MS = 24 * 60 * 60 * 1000;
const TODAY = toISODate(new Date());
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ALL_TIME: DateRange = { from: '', to: '' };

type Tab = 'overview' | 'items' | 'payments' | 'history';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'items', label: 'Items' },
  { id: 'payments', label: 'Payments & voids' },
  { id: 'history', label: 'Order history' },
];

const money = (n: number) => `$${n.toFixed(2)}`;
/** Axis steps are round dollars: $2,000 rather than $2000.00. */
const axisMoney = (n: number) => `${Math.round(n).toLocaleString()}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** The span of equal length immediately before `range`, or null when the
 * range is open-ended (nothing well-defined to compare against). */
function previousRange(range: DateRange): DateRange | null {
  const from = isoDateToLocalDate(range.from);
  const to = isoDateToLocalDate(range.to);
  if (!from || !to) return null;
  const days = Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
  const prevTo = new Date(from.getTime() - DAY_MS);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * DAY_MS);
  return { from: toISODate(prevFrom), to: toISODate(prevTo) };
}

function rangeLabel(range: DateRange): string {
  if (range.from === TODAY && range.to === TODAY) return 'today';
  return formatRange(range).toLowerCase() || 'all time';
}

interface StatCardProps {
  label: string;
  value: number;
  previous?: number;
  format?: (n: number) => string;
  /** When true, an increase is bad (voids, discounts). */
  inverse?: boolean;
}

/** A stat line with the change against the previous period, when there is one. */
function StatCard({ label, value, previous, format = String, inverse }: StatCardProps) {
  let delta: { text: string; tone: 'good' | 'bad' | 'flat'; arrow: string } | null = null;
  if (previous !== undefined) {
    const diff = value - previous;
    const rel = previous === 0 ? null : diff / previous;
    const text = diff === 0 ? 'no change' : `${diff > 0 ? '+' : '−'}${rel === null ? format(Math.abs(diff)) : pct(Math.abs(rel))}`;
    const good = inverse ? diff < 0 : diff > 0;
    delta = { text, tone: diff === 0 ? 'flat' : good ? 'good' : 'bad', arrow: diff > 0 ? '▲' : '▼' };
  }
  return (
    <div className="stat">
      <div className="value">{format(value)}</div>
      <div className="label">{label}</div>
      {delta && (
        <div className={`stat-delta ${delta.tone}`} title="Against the previous period of the same length">
          {delta.tone !== 'flat' && <span aria-hidden="true">{delta.arrow} </span>}
          {delta.text}
        </div>
      )}
    </div>
  );
}

type BucketRow = { key: string; label: string; count: number; revenue: number };
const bucketRows = (buckets: Partial<Record<string, ReportBucket>>, label: (k: string) => string): BucketRow[] =>
  Object.entries(buckets).map(([key, b]) => ({ key, label: label(key), count: b!.count, revenue: b!.revenue }));

const BUCKET_COLUMNS = (first: string) => [
  { header: first, render: (r: BucketRow) => r.label, sortValue: (r: BucketRow) => r.label },
  { header: 'Orders', numeric: true, render: (r: BucketRow) => r.count, sortValue: (r: BucketRow) => r.count },
  { header: 'Revenue', numeric: true, render: (r: BucketRow) => money(r.revenue), sortValue: (r: BucketRow) => r.revenue },
];

export function Reports() {
  const [tab, setTab] = useState<Tab>('overview');
  /** Range the summary tabs cover; both ends empty = all time. */
  const [range, setRange] = useState<DateRange>(() => ({ from: TODAY, to: TODAY }));
  const [report, setReport] = useState<SummaryReport | null>(null);
  const [previous, setPrevious] = useState<SummaryReport | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Order history has its own filters, independent of the summary range.
  const [search, setSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [historyRange, setHistoryRange] = useState<DateRange>(ALL_TIME);

  async function load() {
    try {
      const prev = previousRange(range);
      const [current, before, all] = await Promise.all([
        getSummaryReport(range.from, range.to),
        prev ? getSummaryReport(prev.from, prev.to) : Promise.resolve(null),
        getOrders(),
      ]);
      setReport(current);
      setPrevious(before);
      setOrders([...all].sort((a, b) => b.orderNumber - a.orderNumber));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load reports.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load reads range; refetch when it changes
  }, [range]);

  const fromTime = isoDateToLocalDate(historyRange.from)?.getTime() ?? -Infinity;
  const toTime = (isoDateToLocalDate(historyRange.to)?.getTime() ?? Infinity) + DAY_MS;
  const filtered = orders.filter((o) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      String(o.orderNumber).includes(q) ||
      o.items.some((i) => i.name.toLowerCase().includes(q)) ||
      o.discount?.reason?.toLowerCase().includes(q) ||
      o.voidReason?.toLowerCase().includes(q);
    const matchesStatus = statusFilters.length === 0 || statusFilters.includes(o.status);
    const matchesType = typeFilters.length === 0 || typeFilters.includes(o.orderType ?? 'takeout');
    const createdAtTime = new Date(o.createdAt).getTime();
    return matchesSearch && matchesStatus && matchesType && createdAtTime >= fromTime && createdAtTime < toTime;
  });
  const historyRangeActive = !!(historyRange.from || historyRange.to);
  const filtersActive = statusFilters.length > 0 || typeFilters.length > 0 || historyRangeActive;

  const label = rangeLabel(range);
  const fileStem = `pos-${range.from && range.to ? `${range.from}_${range.to}` : 'all-time'}`;
  const prevRange = previousRange(range);
  const p = previous ?? undefined;

  if (loadError) return <p className="field-error" role="alert">{loadError}</p>;

  const header = (
    <>
      <div className="reports-tabs" role="tablist">
        {TABS.map((t) => (
          <button type="button" role="tab" key={t.id} aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab !== 'history' && (
        <div className="list-header reports-range-row">
          <div className="section-header">{TABS.find((t) => t.id === tab)!.label} · {label}</div>
          <div className="reports-tools">
            <DateRangePicker value={range} onChange={setRange} max={TODAY} placeholder="All time" />
            <button type="button" className="ghost" onClick={() => window.print()}>Print</button>
          </div>
        </div>
      )}
    </>
  );

  if (!report) {
    return (
      <div className="reports-page" aria-busy="true">
        {header}
        <div className="stats-row">
          {Array.from({ length: 5 }, (_, i) => (
            <div className="stat" key={i} aria-hidden="true">
              <span className="skeleton skeleton-stat" />
              <span className="skeleton" style={{ width: '60%', marginTop: '8px' }} />
            </div>
          ))}
        </div>
        <LedgerTable columns={[{ header: 'Item', render: () => null }, { header: 'Qty', numeric: true, render: () => null }]} rows={[]} rowKey={() => ''} loading />
      </div>
    );
  }

  // Fill the quiet days of a closed range so the strip keeps its true shape.
  const days = (() => {
    const from = isoDateToLocalDate(range.from);
    const to = isoDateToLocalDate(range.to);
    if (!from || !to) return report.byDay;
    const byDate = new Map(report.byDay.map((d) => [d.date, d]));
    const out: typeof report.byDay = [];
    for (let t = from.getTime(); t <= to.getTime(); t += DAY_MS) {
      const date = toISODate(new Date(t));
      out.push(byDate.get(date) ?? { date, count: 0, revenue: 0 });
    }
    return out;
  })();
  const multiDay = days.length > 1;
  const weekSpan = !range.from || !range.to || days.length > 7;

  return (
    <div className="reports-page">
      {header}

      {tab === 'overview' && (
        <>
          <div className="stats-row">
            <StatCard label="Orders" value={report.orderCount} previous={p?.orderCount} />
            <StatCard label="Revenue" value={report.revenue} previous={p?.revenue} format={money} />
            <StatCard label="Avg order" value={report.avgOrder} previous={p?.avgOrder} format={money} />
            <StatCard label="Discounts given" value={report.discountTotal} previous={p?.discountTotal} format={money} inverse />
            <StatCard label="Voided" value={report.voidedCount} previous={p?.voidedCount} inverse />
          </div>
          <p className="hint reports-compare-note">
            {prevRange
              ? `Changes are against ${prevRange.from === prevRange.to ? formatDisplay(prevRange.from) : formatRange(prevRange)}.`
              : 'Pick a closed date range to compare against the period before it.'}
          </p>

          <div className="reports-columns">
            <div className="reports-col reports-col-narrow">
              <div className="section-header">Top items</div>
              <LedgerTable
                columns={[
                  { header: 'Item', render: (i) => i.name, sortValue: (i) => i.name },
                  { header: 'Qty', numeric: true, render: (i) => i.qty, sortValue: (i) => i.qty },
                ]}
                rows={report.topItems.slice(0, 10)}
                rowKey={(i) => i.name}
                emptyMessage={`No sales ${label}.`}
              />
              <div className="section-header">By order type</div>
              <LedgerTable columns={BUCKET_COLUMNS('Type')} rows={bucketRows(report.byOrderType, (k) => k)} rowKey={(r) => r.key} emptyMessage={`No sales ${label}.`} />
            </div>

            <div className="reports-col reports-col-wide">
              <div className="section-header">Orders by hour</div>
              <Chart
                name="Orders by hour"
                emptyMessage={`No sales ${label}.`}
                points={report.byHour.map((h, hour) => ({
                  label: hour % 6 === 0 ? String(hour) : '',
                  value: h.count,
                  title: `${hour}:00 — ${h.count} order${h.count === 1 ? '' : 's'}, ${money(h.revenue)}`,
                }))}
              />
              {multiDay && (
                <>
                  <div className="section-header">Revenue by day</div>
                  <Chart
                    name="Revenue by day"
                    emptyMessage={`No sales ${label}.`}
                    format={money}
                    axisFormat={axisMoney}
                    points={days.map((d, i) => ({
                      label: i === 0 || i === days.length - 1 || i % Math.ceil(days.length / 6) === 0 ? formatDisplay(d.date, false) : '',
                      value: d.revenue,
                      title: `${formatDisplay(d.date)} — ${d.count} order${d.count === 1 ? '' : 's'}, ${money(d.revenue)}`,
                    }))}
                  />
                </>
              )}
              {weekSpan && (
                <>
                  <div className="section-header">Revenue by day of week</div>
                  <Chart
                    name="Revenue by day of week"
                    emptyMessage={`No sales ${label}.`}
                    format={money}
                    axisFormat={axisMoney}
                    points={report.byWeekday.map((d, i) => ({
                      label: WEEKDAYS[i],
                      value: d.revenue,
                      title: `${WEEKDAYS[i]} — ${d.count} order${d.count === 1 ? '' : 's'}, ${money(d.revenue)}`,
                    }))}
                  />
                </>
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'items' && (
        <>
          <div className="list-header">
            <p className="hint">
              {report.items.length} item{report.items.length === 1 ? '' : 's'} sold · combos were {pct(report.comboShare)} of order lines
              {p && ` (${pct(p.comboShare)} before)`}.
            </p>
            <button
              type="button"
              className="ghost"
              onClick={() => downloadCsv(`${fileStem}-items.csv`, [
                ['Item', 'Qty', 'Revenue', 'Orders', 'Share of orders', 'Qty previous period'],
                ...report.items.map((i) => [i.name, i.qty, i.revenue.toFixed(2), i.orders, pct(i.orderShare), p?.items.find((x) => x.name === i.name)?.qty ?? '']),
              ])}
            >
              Download CSV
            </button>
          </div>
          <LedgerTable
            columns={[
              { header: 'Item', render: (i) => i.name, sortValue: (i) => i.name.toLowerCase() },
              { header: 'Qty', numeric: true, render: (i) => i.qty, sortValue: (i) => i.qty },
              {
                header: 'vs previous',
                numeric: true,
                render: (i) => {
                  if (!p) return <span className="muted-text">—</span>;
                  const before = p.items.find((x) => x.name === i.name)?.qty ?? 0;
                  const diff = i.qty - before;
                  return <span className={`stat-delta ${diff > 0 ? 'good' : diff < 0 ? 'bad' : 'flat'}`}>{diff === 0 ? '—' : `${diff > 0 ? '+' : '−'}${Math.abs(diff)}`}</span>;
                },
                sortValue: (i) => i.qty - (p?.items.find((x) => x.name === i.name)?.qty ?? 0),
              },
              { header: 'Revenue', numeric: true, render: (i) => money(i.revenue), sortValue: (i) => i.revenue },
              { header: 'In orders', numeric: true, render: (i) => `${i.orders} · ${pct(i.orderShare)}`, sortValue: (i) => i.orderShare },
            ]}
            rows={report.items}
            rowKey={(i) => i.name}
            emptyMessage={`No sales ${label}.`}
            pageSize={25}
            pageSizeOptions={[25, 50, 100]}
          />
        </>
      )}

      {tab === 'payments' && (
        <>
          <div className="list-header">
            <p className="hint">Cash tendered {money(report.cashTendered)} · change given {money(report.changeGiven)} · net cash {money(report.cashTendered - report.changeGiven)}.</p>
            <button
              type="button"
              className="ghost"
              onClick={() => downloadCsv(`${fileStem}-payments.csv`, [
                ['Section', 'Key', 'Orders', 'Amount'],
                ...bucketRows(report.byPaymentMethod, (k) => k).map((r) => ['Payment', r.label, r.count, r.revenue.toFixed(2)]),
                ['Cash', 'Tendered', '', report.cashTendered.toFixed(2)],
                ['Cash', 'Change given', '', report.changeGiven.toFixed(2)],
                ...report.discountsByReason.map((d) => ['Discount', d.reason, d.count, d.amount.toFixed(2)]),
                ...report.voids.map((v) => ['Void', `#${v.orderNumber} ${v.reason}`, new Date(v.at).toLocaleString(), v.total.toFixed(2)]),
              ])}
            >
              Download CSV
            </button>
          </div>
          <div className="reports-columns">
            <div className="reports-col reports-col-narrow">
              <div className="section-header">By payment method</div>
              <LedgerTable columns={BUCKET_COLUMNS('Method')} rows={bucketRows(report.byPaymentMethod, (k) => (k === 'cash' ? 'Cash' : 'Card'))} rowKey={(r) => r.key} emptyMessage={`No sales ${label}.`} />
              <div className="section-header">Discounts by reason</div>
              <LedgerTable
                columns={[
                  { header: 'Reason', render: (d) => d.reason, sortValue: (d) => d.reason },
                  { header: 'Orders', numeric: true, render: (d) => d.count, sortValue: (d) => d.count },
                  { header: 'Amount', numeric: true, render: (d) => money(d.amount), sortValue: (d) => d.amount },
                ]}
                rows={report.discountsByReason}
                rowKey={(d) => d.reason}
                emptyMessage={`No discounts ${label}.`}
              />
            </div>
            <div className="reports-col reports-col-wide">
              <div className="section-header">Voided orders · {money(report.voidedTotal)}</div>
              <LedgerTable
                columns={[
                  { header: 'Order #', width: '100px', render: (v) => `#${v.orderNumber}`, sortValue: (v) => v.orderNumber },
                  { header: 'Voided at', width: '190px', render: (v) => new Date(v.at).toLocaleString(), sortValue: (v) => v.at },
                  { header: 'Reason', render: (v) => v.reason || <span className="muted-text">—</span>, sortValue: (v) => v.reason },
                  { header: 'Total', numeric: true, render: (v) => money(v.total), sortValue: (v) => v.total },
                ]}
                rows={report.voids}
                rowKey={(v) => v._id}
                onRowClick={(v) => setSelectedOrder(orders.find((o) => o._id === v._id) ?? null)}
                emptyMessage={`No voided orders ${label}.`}
                pageSize={10}
                pageSizeOptions={[10, 25, 50]}
              />
            </div>
          </div>
        </>
      )}

      {tab === 'history' && (
        <>
          <div className="list-header">
            <div className="section-header">Order history</div>
            <input
              type="text"
              placeholder="Search by order #, item, discount or void reason…"
              aria-label="Search order history"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="reports-filter-bar">
            <MultiSelectDropdown values={statusFilters} options={STATUSES} onChange={setStatusFilters} placeholder="All statuses" />
            <MultiSelectDropdown values={typeFilters} options={ORDER_TYPES} onChange={setTypeFilters} placeholder="All order types" />
            <DateRangePicker value={historyRange} onChange={setHistoryRange} max={TODAY} placeholder="All time" />
            <button
              type="button"
              className="ghost"
              style={{ marginLeft: 'auto' }}
              disabled={filtered.length === 0}
              onClick={() => downloadCsv('pos-orders.csv', [
                ['Order #', 'Time', 'Type', 'Status', 'Items', 'Subtotal', 'Discount', 'Total', 'Payment', 'Void reason'],
                ...filtered.map((o) => [
                  o.orderNumber, new Date(o.createdAt).toLocaleString(), o.orderType ?? '', o.status,
                  o.items.map((i) => `${i.qty}× ${i.name}`).join('; '), o.subtotal.toFixed(2), (o.subtotal - o.total).toFixed(2),
                  o.total.toFixed(2), o.paymentMethod, o.voidReason ?? '',
                ]),
              ])}
            >
              Download CSV
            </button>
          </div>

          <ActiveFilters
            filters={[
              ...statusFilters.map((s) => ({ label: `Status: ${s}`, onRemove: () => setStatusFilters(statusFilters.filter((x) => x !== s)) })),
              ...typeFilters.map((t) => ({ label: `Type: ${t}`, onRemove: () => setTypeFilters(typeFilters.filter((x) => x !== t)) })),
              ...(historyRangeActive ? [{ label: `Dates: ${formatRange(historyRange)}`, onRemove: () => setHistoryRange(ALL_TIME) }] : []),
            ]}
            onClearAll={() => {
              setStatusFilters([]);
              setTypeFilters([]);
              setHistoryRange(ALL_TIME);
            }}
          />

          <LedgerTable
            columns={[
              { header: 'Order #', width: '110px', render: (o) => `#${o.orderNumber}`, sortValue: (o) => o.orderNumber },
              { header: 'Time', width: '190px', render: (o) => new Date(o.createdAt).toLocaleString(), sortValue: (o) => o.createdAt },
              {
                header: 'Items',
                render: (o) => <span className="order-items-cell">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</span>,
                sortValue: (o) => o.items.length,
              },
              {
                header: 'Discount',
                render: (o) =>
                  o.discount ? (
                    <span className="discount-cell">
                      {o.discount.type === 'percent' ? `${o.discount.value}%` : money(o.discount.value)}
                      {o.discount.reason && <span className="muted-text"> — {o.discount.reason}</span>}
                    </span>
                  ) : (
                    <span className="muted-text">—</span>
                  ),
                sortValue: (o) => (o.discount ? o.subtotal - o.total : -1),
              },
              { header: 'Type', width: '90px', render: (o) => o.orderType ?? '—', sortValue: (o) => o.orderType ?? '' },
              { header: 'Status', render: (o) => <span className={`status-pill ${o.status}`}>{o.status}</span>, sortValue: (o) => o.status },
              { header: 'Total', numeric: true, render: (o) => money(o.total), sortValue: (o) => o.total },
            ]}
            rows={filtered}
            rowKey={(o) => o._id}
            onRowClick={setSelectedOrder}
            emptyMessage={filtersActive || search ? 'No orders match.' : 'No orders yet.'}
            pageSize={10}
            pageSizeOptions={[10, 25, 50]}
          />
        </>
      )}

      {selectedOrder && (
        <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onVoided={load} />
      )}
    </div>
  );
}
