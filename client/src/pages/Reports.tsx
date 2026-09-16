import { useEffect, useState } from 'react';
import { getSummaryReport } from '../api/reports';
import { getOrders } from '../api/orders';
import { ActiveFilters } from '../components/ActiveFilters';
import { DateRangePicker, formatRange, isoDateToLocalDate, toISODate, type DateRange } from '../components/DatePicker';
import { MultiSelectDropdown } from '../components/Dropdown';
import { LedgerTable } from '../components/LedgerTable';
import { OrderDetailModal } from '../components/OrderDetailModal';
import type { SummaryReport, Order, OrderStatus, OrderType, ReportBucket } from '../types';

const STATUSES: OrderStatus[] = ['pending', 'preparing', 'ready', 'completed', 'voided'];
const ORDER_TYPES: OrderType[] = ['dine-in', 'takeout', 'delivery'];
const DAY_MS = 24 * 60 * 60 * 1000;
const TODAY = toISODate(new Date());

export function Reports() {
  const [report, setReport] = useState<SummaryReport | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  /** Range the whole page covers — the summary and the history table alike. Both ends empty = all time. */
  const [range, setRange] = useState<DateRange>(() => ({ from: TODAY, to: TODAY }));
  /** Order history has its own range, independent of the summary's; default all time. */
  const [historyRange, setHistoryRange] = useState<DateRange>({ from: '', to: '' });

  async function load() {
    try {
      const [daily, all] = await Promise.all([getSummaryReport(range.from, range.to), getOrders()]);
      setReport(daily);
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

  // Inclusive whole days in *local* time: from local midnight of fromDate up
  // to (not including) local midnight the day after toDate.
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
    const matchesRange = createdAtTime >= fromTime && createdAtTime < toTime;
    return matchesSearch && matchesStatus && matchesType && matchesRange;
  });

  const historyRangeActive = !!(historyRange.from || historyRange.to);
  const filtersActive = statusFilters.length > 0 || typeFilters.length > 0 || historyRangeActive;

  if (loadError) return <p className="field-error" role="alert">{loadError}</p>;
  if (!report) {
    return (
      <div className="reports-page" aria-busy="true">
        <div className="list-header">
          <div className="section-header">Summary</div>
          <DateRangePicker value={range} onChange={setRange} max={TODAY} placeholder="All time" />
        </div>
        <div className="stats-row">
          {Array.from({ length: 5 }, (_, i) => (
            <div className="stat" key={i} aria-hidden="true">
              <span className="skeleton skeleton-stat" />
              <span className="skeleton" style={{ width: '60%', marginTop: '8px' }} />
            </div>
          ))}
        </div>
        <div className="reports-columns">
          <div className="reports-col reports-col-narrow">
            <div className="section-header">Top items</div>
            <LedgerTable columns={[{ header: 'Item', render: () => null }, { header: 'Qty', numeric: true, render: () => null }]} rows={[]} rowKey={() => ''} loading />
          </div>
          <div className="reports-col reports-col-wide">
            <div className="section-header">Order history</div>
            <LedgerTable
              columns={['Order #', 'Time', 'Items', 'Discount', 'Type', 'Status', 'Total'].map((header) => ({ header, numeric: header === 'Total', render: () => null }))}
              rows={[]}
              rowKey={() => ''}
              loading
              pageSize={10}
            />
          </div>
        </div>
      </div>
    );
  }

  const topItems = report.topItems.slice(0, 10);
  const dayLabel = range.from === TODAY && range.to === TODAY ? 'today' : formatRange(range).toLowerCase() || 'all time';
  const peakCount = Math.max(...report.byHour.map((h) => h.count));
  const bucketRows = (buckets: Partial<Record<string, ReportBucket>>, label: (k: string) => string) =>
    Object.entries(buckets).map(([key, b]) => ({ key, label: label(key), count: b!.count, revenue: b!.revenue }));

  return (
    <div className="reports-page">
      <div className="list-header">
        <div className="section-header">Summary</div>
        <DateRangePicker value={range} onChange={setRange} max={TODAY} placeholder="All time" />
      </div>

      <div className="stats-row">
        <div className="stat">
          <div className="value">{report.orderCount}</div>
          <div className="label">Orders</div>
        </div>
        <div className="stat">
          <div className="value">${report.revenue.toFixed(2)}</div>
          <div className="label">Revenue</div>
        </div>
        <div className="stat">
          <div className="value">${report.avgOrder.toFixed(2)}</div>
          <div className="label">Avg order</div>
        </div>
        <div className="stat">
          <div className="value">${report.discountTotal.toFixed(2)}</div>
          <div className="label">Discounts given</div>
        </div>
        <div className="stat">
          <div className="value">{report.voidedCount}</div>
          <div className="label">Voided · ${report.voidedTotal.toFixed(2)}</div>
        </div>
      </div>

      <div className="reports-columns">
        <div className="reports-col reports-col-narrow">
          <div className="section-header">Top items · {dayLabel}</div>
          <LedgerTable
            columns={[
              { header: 'Item', render: (i) => i.name, sortValue: (i) => i.name },
              { header: 'Qty', numeric: true, render: (i) => i.qty, sortValue: (i) => i.qty },
            ]}
            rows={topItems}
            rowKey={(i) => i.name}
            emptyMessage={`No sales ${dayLabel}.`}
          />

          <div className="section-header">By payment</div>
          <LedgerTable
            columns={[
              { header: 'Method', render: (r) => r.label },
              { header: 'Orders', numeric: true, render: (r) => r.count },
              { header: 'Revenue', numeric: true, render: (r) => `$${r.revenue.toFixed(2)}` },
            ]}
            rows={bucketRows(report.byPaymentMethod, (k) => (k === 'cash' ? 'Cash' : 'Card'))}
            rowKey={(r) => r.key}
            emptyMessage={`No sales ${dayLabel}.`}
          />

          <div className="section-header">By order type</div>
          <LedgerTable
            columns={[
              { header: 'Type', render: (r) => r.label },
              { header: 'Orders', numeric: true, render: (r) => r.count },
              { header: 'Revenue', numeric: true, render: (r) => `$${r.revenue.toFixed(2)}` },
            ]}
            rows={bucketRows(report.byOrderType, (k) => k)}
            rowKey={(r) => r.key}
            emptyMessage={`No sales ${dayLabel}.`}
          />

          <div className="section-header">Orders by hour</div>
          {peakCount === 0 ? (
            <p className="hint">No sales {dayLabel}.</p>
          ) : (
            <ol className="hour-bars" aria-label="Orders by hour">
              {report.byHour.map((h, hour) => (
                <li key={hour} title={`${hour}:00 — ${h.count} order${h.count === 1 ? '' : 's'}, $${h.revenue.toFixed(2)}`}>
                  <span className="hour-bar" style={{ height: `${(h.count / peakCount) * 100}%` }} />
                  <span className="hour-label">{hour % 6 === 0 ? `${hour}` : ''}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="reports-col reports-col-wide">
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
            <MultiSelectDropdown
              values={statusFilters}
              options={STATUSES}
              onChange={setStatusFilters}
              placeholder="All statuses"
            />
            <MultiSelectDropdown
              values={typeFilters}
              options={ORDER_TYPES}
              onChange={setTypeFilters}
              placeholder="All order types"
            />
            <DateRangePicker value={historyRange} onChange={setHistoryRange} max={TODAY} placeholder="All time" />
          </div>

          <ActiveFilters
            filters={[
              ...statusFilters.map((s) => ({ label: `Status: ${s}`, onRemove: () => setStatusFilters(statusFilters.filter((x) => x !== s)) })),
              ...typeFilters.map((t) => ({ label: `Type: ${t}`, onRemove: () => setTypeFilters(typeFilters.filter((x) => x !== t)) })),
              ...(historyRangeActive ? [{ label: `Dates: ${formatRange(historyRange)}`, onRemove: () => setHistoryRange({ from: '', to: '' }) }] : []),
            ]}
            onClearAll={() => {
              setStatusFilters([]);
              setTypeFilters([]);
              setHistoryRange({ from: '', to: '' });
            }}
          />

          <LedgerTable
            columns={[
              { header: 'Order #', width: '110px', render: (o) => `#${o.orderNumber}`, sortValue: (o) => o.orderNumber },
              {
                header: 'Time',
                width: '190px',
                render: (o) => new Date(o.createdAt).toLocaleString(),
                sortValue: (o) => o.createdAt,
              },
              {
                header: 'Items',
                render: (o) => (
                  <span className="order-items-cell">
                    {o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                  </span>
                ),
                sortValue: (o) => o.items.length,
              },
              {
                header: 'Discount',
                render: (o) =>
                  o.discount ? (
                    <span className="discount-cell">
                      {o.discount.type === 'percent' ? `${o.discount.value}%` : `$${o.discount.value.toFixed(2)}`}
                      {o.discount.reason && <span className="muted-text"> — {o.discount.reason}</span>}
                    </span>
                  ) : (
                    <span className="muted-text">—</span>
                  ),
                sortValue: (o) => (o.discount ? o.subtotal - o.total : -1),
              },
              {
                header: 'Type',
                width: '90px',
                render: (o) => o.orderType ?? '—',
                sortValue: (o) => o.orderType ?? '',
              },
              {
                header: 'Status',
                render: (o) => <span className={`status-pill ${o.status}`}>{o.status}</span>,
                sortValue: (o) => o.status,
              },
              { header: 'Total', numeric: true, render: (o) => `$${o.total.toFixed(2)}`, sortValue: (o) => o.total },
            ]}
            rows={filtered}
            rowKey={(o) => o._id}
            onRowClick={setSelectedOrder}
            emptyMessage={filtersActive || search ? 'No orders match.' : 'No orders yet.'}
            pageSize={10}
            pageSizeOptions={[10, 25, 50]}
          />
        </div>
      </div>

      {selectedOrder && (
        <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onVoided={load} />
      )}
    </div>
  );
}
