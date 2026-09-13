import { useEffect, useState } from 'react';
import { getDailyReport } from '../api/reports';
import { getOrders } from '../api/orders';
import { LedgerTable } from '../components/LedgerTable';
import type { DailyReport, Order } from '../types';

export function Reports() {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getDailyReport().then(setReport);
    getOrders().then((o) => setOrders([...o].sort((a, b) => b.orderNumber! - a.orderNumber!)));
  }, []);

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

  return (
    <div>
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

      <LedgerTable
        columns={[
          { header: 'Item', render: (i) => i.name },
          { header: 'Qty Sold', numeric: true, render: (i) => i.qty },
        ]}
        rows={report.topItems}
        rowKey={(i) => i.name}
        emptyMessage="No sales yet today."
      />

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
          { header: 'Order #', render: (o) => `#${o.orderNumber}` },
          { header: 'Time', render: (o) => new Date(o.createdAt).toLocaleString() },
          { header: 'Items', render: (o) => o.items.map((i) => `${i.qty}× ${i.name}`).join(', ') },
          {
            header: 'Discount',
            render: (o) =>
              o.discount
                ? `${o.discount.type === 'percent' ? `${o.discount.value}%` : `$${o.discount.value.toFixed(2)}`}${o.discount.reason ? ` — ${o.discount.reason}` : ''}`
                : '—',
          },
          { header: 'Status', render: (o) => <span className={`status-pill ${o.status}`}>{o.status}</span> },
          { header: 'Total', numeric: true, render: (o) => `$${o.total.toFixed(2)}` },
        ]}
        rows={filtered}
        rowKey={(o) => o._id}
        emptyMessage="No orders yet."
      />
    </div>
  );
}
