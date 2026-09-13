import { useEffect, useState } from 'react';
import { getOrders, updateOrderStatus } from '../api/orders';
import type { Order, OrderStatus } from '../types';

const NEXT_STATUS: Record<Exclude<OrderStatus, 'completed'>, OrderStatus> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'completed',
};
const NEXT_LABEL: Record<Exclude<OrderStatus, 'completed'>, string> = {
  pending: 'Start Preparing',
  preparing: 'Mark Ready',
  ready: 'Complete',
};
const OVERDUE_MINUTES = 10;

const COLUMNS: { status: Exclude<OrderStatus, 'completed'>; label: string }[] = [
  { status: 'pending', label: 'Pending' },
  { status: 'preparing', label: 'Preparing' },
  { status: 'ready', label: 'Ready' },
];

function elapsedMinutes(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

type Status = Exclude<OrderStatus, 'completed'>;

export function Kitchen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState<Set<Status>>(new Set(['pending', 'preparing', 'ready']));

  async function load() {
    const all = await getOrders();
    setOrders(all.filter((o) => o.status !== 'completed'));
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);

  async function advance(order: Order) {
    if (order.status === 'completed') return;
    await updateOrderStatus(order._id, NEXT_STATUS[order.status as Status]);
    load();
  }

  function toggleColumn(status: Status) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  const query = search.trim().toLowerCase();
  const matchesSearch = (o: Order) =>
    !query ||
    String(o.orderNumber ?? '').includes(query) ||
    o.items.some((i) => i.name.toLowerCase().includes(query));

  const visibleColumns = COLUMNS.filter((col) => visible.has(col.status));

  return (
    <div>
      <div className="kds-toolbar">
        <input
          className="search-input"
          placeholder="Search by order # or item…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="option-row column-toggle">
          {COLUMNS.map((col) => (
            <button
              key={col.status}
              className={visible.has(col.status) ? 'active' : ''}
              onClick={() => toggleColumn(col.status)}
            >
              {col.label}
            </button>
          ))}
        </div>
      </div>

      <div className="kds-board">
        {visibleColumns.length === 0 && <p className="kds-empty">No columns selected — choose one above.</p>}
        {visibleColumns.map((col) => {
          const columnOrders = orders
            .filter((o) => o.status === col.status)
            .filter(matchesSearch)
            .sort((a, b) => {
              if (!!b.urgent !== !!a.urgent) return a.urgent ? -1 : 1;
              return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            });

          return (
            <div className="kds-column" key={col.status}>
              <div className="kds-column-header">
                <span>{col.label}</span>
                <span className="count">{columnOrders.length}</span>
              </div>
              <div className="kds-tickets">
                {columnOrders.length === 0 && (
                  <p className="kds-empty">{query ? 'No matching orders.' : 'No orders.'}</p>
                )}
                {columnOrders.map((o) => {
                  const minutes = elapsedMinutes(o.createdAt);
                  const overdue = col.status !== 'ready' && minutes >= OVERDUE_MINUTES;
                  return (
                    <div className={`ticket${overdue ? ' overdue' : ''}${o.urgent ? ' urgent' : ''}`} key={o._id}>
                      <div className="ticket-header">
                        <span className="ticket-number">
                          #{o.orderNumber ?? o._id.slice(-5)}
                          {o.urgent && <span className="urgent-tag">Urgent</span>}
                        </span>
                        <span className={`ticket-time${overdue ? ' overdue' : ''}`}>
                          {minutes <= 0 ? 'just now' : `${minutes}m ago`}
                        </span>
                      </div>
                      {o.note && <p className="ticket-order-note">{o.note}</p>}
                      <ul>
                        {o.items.map((i, idx) => (
                          <li key={idx}>
                            {i.qty}x {i.name}
                            {i.comboItems && i.comboItems.length > 0 && (
                              <div className="combo-contents">Includes: {i.comboItems.join(' + ')}</div>
                            )}
                            {i.note && <div className="note">{i.note}</div>}
                          </li>
                        ))}
                      </ul>
                      <button className="primary" onClick={() => advance(o)}>{NEXT_LABEL[col.status]}</button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
