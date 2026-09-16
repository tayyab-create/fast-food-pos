import { useEffect, useState } from 'react';
import { getDailyReport } from '../api/reports';
import { getOrders } from '../api/orders';
import { DatePicker, isoDateToLocalDate } from '../components/DatePicker';
import { MultiSelectDropdown } from '../components/Dropdown';
import { LedgerTable } from '../components/LedgerTable';
import { OrderDetailModal } from '../components/OrderDetailModal';
import type { DailyReport, Order, OrderStatus, OrderType } from '../types';

const STATUSES: OrderStatus[] = ['pending', 'preparing', 'ready', 'completed', 'voided'];
const ORDER_TYPES: OrderType[] = ['dine-in', 'takeout', 'delivery'];
const DAY_MS = 24 * 60 * 60 * 1000;

export function Reports() {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  async function load() {
    try {
      const [daily, all] = await Promise.all([getDailyReport(), getOrders()]);
      setReport(daily);
      setOrders([...all].sort((a, b) => b.orderNumber - a.orderNumber));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load reports.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Inclusive whole days in *local* time: from local midnight of fromDate up
  // to (not including) local midnight the day after toDate.
  const fromTime = isoDateToLocalDate(fromDate)?.getTime() ?? -Infinity;
  const toTime = (isoDateToLocalDate(toDate)?.getTime() ?? Infinity) + DAY_MS;

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

  const filtersActive = statusFilters.length > 0 || typeFilters.length > 0 || fromDate || toDate;

  if (loadError) return <p className="field-error" role="alert">{loadError}</p>;
  if (!report) return <p>Loading…</p>;

  const topItems = report.topItems.slice(0, 10);

  return (
    <div className="reports-page">
      <div className="stats-row">
        <div className="stat">
          <div className="value">{report.orderCount}</div>
          <div className="label">Orders Today</div>
        </div>
        <div className="stat">
          <div className="value">${report.revenue.toFixed(2)}</div>
          <div className="label">Revenue Today</div>
        </div>
      </div>

      <div className="reports-columns">
        <div className="reports-col reports-col-narrow">
          <div className="section-header">Top Items Today</div>
          <LedgerTable
            columns={[
              { header: 'Item', render: (i) => i.name, sortValue: (i) => i.name },
              { header: 'Qty Sold', numeric: true, render: (i) => i.qty, sortValue: (i) => i.qty },
            ]}
            rows={topItems}
            rowKey={(i) => i.name}
            emptyMessage="No sales yet today."
          />
        </div>

        <div className="reports-col reports-col-wide">
          <div className="list-header">
            <div className="section-header">Order History</div>
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
            <div className="date-range-field">
              <DatePicker value={fromDate} onChange={setFromDate} placeholder="From" />
              <span className="muted-text">to</span>
              <DatePicker value={toDate} onChange={setToDate} placeholder="To" />
            </div>
            {filtersActive && (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setStatusFilters([]);
                  setTypeFilters([]);
                  setFromDate('');
                  setToDate('');
                }}
              >
                Clear filters
              </button>
            )}
          </div>

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
