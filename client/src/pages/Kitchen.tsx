import { useEffect, useRef, useState } from 'react';
import { getOrders, updateOrderStatus } from '../api/orders';
import { ActiveFilters } from '../components/ActiveFilters';
import { MultiSelectDropdown } from '../components/Dropdown';
import { useToast } from '../components/Toast';
import { VoidOrderModal } from '../components/VoidOrderModal';
import type { Order, OrderStatus, OrderType } from '../types';

const ORDER_TYPES: OrderType[] = ['dine-in', 'takeout', 'delivery'];

type Status = Exclude<OrderStatus, 'completed' | 'voided'>;

const NEXT_STATUS: Record<Status, OrderStatus> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'completed',
};
const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  voided: 'Voided',
};
const NEXT_LABEL: Record<Status, string> = {
  pending: 'Start Preparing',
  preparing: 'Mark Ready',
  ready: 'Complete',
};
const OVERDUE_MINUTES = Number(import.meta.env.VITE_OVERDUE_MINUTES) || 45;
const POLL_MS = 3000;
/** Matches the .ticket.leaving transition in ledger.css. */
const LEAVE_MS = 160;

const COLUMNS: { status: Status; label: string }[] = [
  { status: 'pending', label: 'Pending' },
  { status: 'preparing', label: 'Preparing' },
  { status: 'ready', label: 'Ready' },
];

function elapsedMinutes(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

function formatElapsed(minutes: number): string {
  if (minutes <= 0) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours < 24) return `${hours}h${remMinutes ? ` ${remMinutes}m` : ''} ago`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  if (days < 365) return `${days}d${remHours ? ` ${remHours}h` : ''} ago`;
  const years = Math.floor(days / 365);
  const remDays = days % 365;
  return `${years}y${remDays ? ` ${remDays}d` : ''} ago`;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function Kitchen() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  /** Tickets fading out of their column while their status change is saved. */
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  // Polling runs every 3s; report a failure once and stay quiet until it recovers.
  const pollFailed = useRef(false);
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState<Set<Status>>(new Set(['pending', 'preparing', 'ready']));
  const [orderTypeFilters, setOrderTypeFilters] = useState<string[]>([]);
  const [voidTarget, setVoidTarget] = useState<Order | null>(null);
  // Skip a poll tick while the previous request is still in flight, so a slow
  // network can't pile up overlapping fetches.
  const inFlight = useRef(false);

  async function load() {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const all = await getOrders();
      setOrders(all.filter((o) => o.status !== 'completed' && o.status !== 'voided'));
      if (pollFailed.current) toast('Back in touch with the server.');
      pollFailed.current = false;
    } catch (err) {
      if (!pollFailed.current) toast(errorMessage(err, 'Could not refresh orders.'), { kind: 'error' });
      pollFailed.current = true;
    } finally {
      inFlight.current = false;
      setRefreshing(false);
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, []);

  async function setStatus(order: Order, status: OrderStatus, undoFrom?: OrderStatus) {
    setLeaving((prev) => new Set(prev).add(order._id));
    try {
      await Promise.all([updateOrderStatus(order._id, status), new Promise((r) => setTimeout(r, LEAVE_MS))]);
      await load();
      if (undoFrom) {
        toast(`#${order.orderNumber} → ${STATUS_LABEL[status]}`, {
          action: { label: 'Undo', onClick: () => setStatus(order, undoFrom) },
        });
      }
    } catch (err) {
      toast(errorMessage(err, 'Could not update the order.'), { kind: 'error' });
    } finally {
      setLeaving((prev) => { const next = new Set(prev); next.delete(order._id); return next; });
    }
  }
  // Routine moves are quiet except for an Undo — a cook advancing forty
  // tickets an hour doesn't need forty confirmations.
  const advance = (order: Order, status: OrderStatus) => setStatus(order, status, order.status);

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
    String(o.orderNumber).includes(query) ||
    o.items.some((i) => i.name.toLowerCase().includes(query));
  const matchesOrderType = (o: Order) =>
    orderTypeFilters.length === 0 || orderTypeFilters.includes(o.orderType ?? 'takeout');

  const visibleColumns = COLUMNS.filter((col) => visible.has(col.status));

  return (
    <div>
      <div className="kds-toolbar">
        <input
          className="search-input"
          placeholder="Search by order # or item…"
          aria-label="Search orders"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="option-row column-toggle" role="group" aria-label="Visible columns">
          {COLUMNS.map((col) => (
            <button
              type="button"
              key={col.status}
              className={visible.has(col.status) ? 'active' : ''}
              aria-pressed={visible.has(col.status)}
              onClick={() => toggleColumn(col.status)}
            >
              {col.label}
            </button>
          ))}
        </div>
        <MultiSelectDropdown
          values={orderTypeFilters}
          options={ORDER_TYPES}
          onChange={setOrderTypeFilters}
          placeholder="All order types"
        />
      </div>

      <ActiveFilters
        filters={orderTypeFilters.map((t) => ({
          label: `Type: ${t}`,
          onRemove: () => setOrderTypeFilters(orderTypeFilters.filter((x) => x !== t)),
        }))}
        onClearAll={() => setOrderTypeFilters([])}
      />

      <div className="kds-board">
        {visibleColumns.length === 0 && <p className="kds-empty">No columns selected — choose one above.</p>}
        {visibleColumns.map((col) => {
          const columnOrders = orders
            .filter((o) => o.status === col.status)
            .filter(matchesSearch)
            .filter(matchesOrderType)
            .sort((a, b) => {
              if (!!b.urgent !== !!a.urgent) return a.urgent ? -1 : 1;
              return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            });

          return (
            <div className="kds-column" key={col.status}>
              <div className="kds-column-header">
                <span>
                  {col.label}
                  <span className={`live-dot${refreshing ? ' active' : ''}`} title="Refreshes every 3 seconds" aria-hidden="true" />
                </span>
                <span className="count">{loaded ? columnOrders.length : ''}</span>
              </div>
              <div className="kds-tickets">
                {!loaded && Array.from({ length: 2 }, (_, i) => (
                  <div className="ticket skeleton-ticket" key={i} aria-hidden="true">
                    <span className="skeleton" style={{ width: '40%' }} />
                    <span className="skeleton" style={{ width: '70%' }} />
                    <span className="skeleton" style={{ width: '55%' }} />
                    <span className="skeleton skeleton-button" />
                  </div>
                ))}
                {loaded && columnOrders.length === 0 && (
                  <p className="kds-empty">{query ? 'No matching orders.' : 'No orders.'}</p>
                )}
                {columnOrders.map((o) => {
                  const minutes = elapsedMinutes(o.createdAt);
                  const overdue = col.status !== 'ready' && minutes >= OVERDUE_MINUTES;
                  return (
                    <div className={`ticket${overdue ? ' overdue' : ''}${o.urgent ? ' urgent' : ''}${leaving.has(o._id) ? ' leaving' : ''}`} key={o._id}>
                      <div className="ticket-header">
                        <span className="ticket-number">
                          #{o.orderNumber}
                          {o.orderType && <span className="order-type-tag">{o.orderType}</span>}
                          {o.urgent && <span className="urgent-tag">Urgent</span>}
                        </span>
                        <span className={`ticket-time${overdue ? ' overdue' : ''}`}>
                          {formatElapsed(minutes)}
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
                      <div className="ticket-actions">
                        <button type="button" className="primary" onClick={() => advance(o, NEXT_STATUS[col.status])}>
                          {NEXT_LABEL[col.status]}
                        </button>
                        <button type="button" className="ghost danger" onClick={() => setVoidTarget(o)}>Void</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {voidTarget && (
        <VoidOrderModal
          order={voidTarget}
          onClose={() => setVoidTarget(null)}
          onVoided={() => {
            setVoidTarget(null);
            load();
          }}
        />
      )}
    </div>
  );
}
