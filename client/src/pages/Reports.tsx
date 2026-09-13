import { useEffect, useState } from 'react';
import { getDailyReport } from '../api/reports';
import { getOrders } from '../api/orders';
import { LedgerTable } from '../components/LedgerTable';
import { OrderDetailModal } from '../components/OrderDetailModal';
import type { DailyReport, Order } from '../types';

export function Reports() {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  function load() {
    getDailyReport().then(setReport);
    getOrders().then((o) => setOrders([...o].sort((a, b) => b.orderNumber! - a.orderNumber!)));
  }

  useEffect(load, []);

  const filtered = orders.filter((o) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      String(o.orderNumber).includes(q) ||
      o.items.some((i) => i.name.toLowerCase().includes(q)) ||
      o.discount?.reason?.toLowerCase().includes(q)
    );
  });

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
              placeholder="Search by order #, item, or discount reason…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <LedgerTable
            columns={[
              { header: 'Order #', width: '110px', render: (o) => `#${o.orderNumber}`, sortValue: (o) => o.orderNumber ?? 0 },
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
                sortValue: (o) => (o.discount ? (o.discount.type === 'percent' ? o.discount.value : o.discount.value) : -1),
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
            emptyMessage="No orders yet."
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
