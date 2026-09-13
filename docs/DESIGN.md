# Design Doc — Fast Food POS

## Overview
Single-till point-of-sale for a fast food counter: cashier order entry, a kitchen
display queue, daily sales reports, and menu management. Backend is Express +
MongoDB (Mongoose). Frontend is a React + TypeScript SPA built with Vite.

## Project layout
```
server.js              Loads .env, connects Mongo, mounts routers, serves client/dist in production
.env                    MONGO_URI, PORT — gitignored; copy .env.example to set up locally
routes/                 Express Routers — HTTP verbs/paths only, no business logic
  menu.js               /api/menu
  orders.js             /api/orders
  reports.js            /api/reports
controllers/            Business logic + Mongoose queries, one per resource
  menuController.js      Also handles image upload/removal (sharp resize + compress)
  ordersController.js
  reportsController.js
models/                 Mongoose schemas
  MenuItem.js
  Order.js
  Counter.js             Atomic sequence counters (orderNumber)
uploads/                Compressed product images, served at /uploads (gitignored, runtime-only)
seed.js                 Populates sample menu items
client/                 Vite + React + TypeScript SPA
  src/
    main.tsx, App.tsx        React Router setup, NavBar
    pages/
      Cashier.tsx             Menu grid + cart + checkout, held orders, payment method (/)
      Kitchen.tsx             Order queue, polls every 3s (/kitchen)
      Reports.tsx             Daily stats + full order history, search by order #/item/discount reason (/reports)
      Menu.tsx                Menu CRUD (/menu)
    components/
      LedgerTable.tsx         Shared ruled-row table primitive
      OrderDetailModal.tsx    Shared order detail popup (Cashier checkout confirmation, Reports order history row click)
      NavBar.tsx
    api/
      client.ts               fetch wrapper (base URL, JSON, error handling)
      menu.ts, orders.ts, reports.ts   Typed functions per resource
    types.ts                  Shared TS interfaces (mirror backend shapes)
    styles/
      ledger.css              Global ledger visual theme
```

## Data models

### MenuItem
```
{
  _id, name: string, price: number, category: string,
  variants?: [{ name: string, price: number }],  // e.g. pizza sizes; price becomes per-variant
  isCombo?: boolean,
  comboItems?: string[],                           // e.g. ["Cheeseburger", "Fries", "Pizza (Medium)"]
  image?: string,                                   // "/uploads/<itemId>.jpg?v=<timestamp>", undefined if none
}
```

### Order
```
{
  _id,
  orderNumber: number,   // sequential, per-order (1, 2, 3, ...) — not the Mongo _id
                         // assigned atomically from a Counter doc (_id: 'orderNumber'), race-safe across concurrent creates
  items: [{ name: string, price: number, qty: number, note?: string, comboItems?: string[] }],
  subtotal: number,
  discount?: { type: 'percent' | 'flat', value: number, reason?: string },
  total: number,   // subtotal minus discount, clamped to >= 0
  paymentMethod: 'cash' | 'card',
  urgent?: boolean,
  note?: string,   // order-wide note, distinct from per-item notes
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'voided',
    // voided orders are excluded from the Kitchen board and daily report revenue,
    // but stay visible in Reports' order history — a record, not a delete
  createdAt: Date,
}
```

## API contract

| Method | Path              | Body                                   | Response              |
|--------|-------------------|-----------------------------------------|------------------------|
| GET    | /api/menu         | —                                       | MenuItem[]             |
| POST   | /api/menu         | { name, price, category, variants?, isCombo?, comboItems? } | MenuItem (201) |
| PUT    | /api/menu/:id     | { name?, price?, category?, variants?, isCombo?, comboItems? } | MenuItem |
| DELETE | /api/menu/:id     | —                                       | 204                    |
| POST   | /api/menu/:id/image | multipart, field `image` (jpeg/png/webp, ≤5MB) | MenuItem |
| DELETE | /api/menu/:id/image | —                                     | MenuItem               |
| GET    | /api/orders       | ?status= (optional filter)              | Order[]                |
| POST   | /api/orders       | { items: OrderItem[], paymentMethod, discount?, urgent?, note? } | Order (201) |
| PATCH  | /api/orders/:id   | { status }                              | Order                  |
| GET    | /api/reports/daily| —                                       | { orderCount, revenue, topItems: [{name, qty}] } |

## Visual style
See [`DESIGN_LANGUAGE.md`](DESIGN_LANGUAGE.md) for the full token/type/component
system (Institutional Ledger). Don't duplicate style rules here — this file
stays about architecture and data shapes.

## Pages

- **Cashier (`/`)**: a search bar, category tabs (including an "All" tab), and
  a grid of tappable item tiles — items with `variants` expand an inline size
  picker on tap; `isCombo` items show their `comboItems` as a subtext line.
  Tiles with an `image` show it above the name/price. The order ledger sheet
  on the right lists cart lines (qty, name, line total, remove, optional
  per-item note) with an item-count summary in the header, an order-wide
  "mark urgent" checkbox and note field, a Percent/Flat discount toggle (with
  an optional reason label), and a Subtotal → Discount → Total block (Total
  as the one inverted/emphasized row).
- **Kitchen (`/kitchen`)**: a search bar plus Pending/Preparing/Ready column
  toggles, then a board of the visible columns (hiding a column lets the rest
  expand to fill the page). Orders shown as ledger tickets (sequential order
  number, an "Urgent" tag + thicker red border when flagged, elapsed time
  since placed — flagged red past 10 minutes, the order-wide note as a
  highlighted callout, itemized lines with per-item notes and combo contents,
  one button to advance to the next status). Urgent orders sort to the top of
  their column. Polls `/api/orders` every 3 seconds.
- **Reports (`/reports`)**: today's order count and revenue as ledger stat
  lines, plus a ruled table of top-selling items by quantity.
- **Menu (`/menu`)**: a search bar + category filter above a ledger table of
  menu items (each row shows a 32px thumbnail when it has an `image`).
  Clicking a row shows its details in a sticky sidebar (Edit/Delete actions,
  with a confirm dialog before delete); "+ Add item" or Edit opens a form in
  the same sidebar — name/category/price fields, a repeatable size-row editor
  for variants, a searchable checklist to build combos from existing items
  (with a per-item size picker when the item has variants), and a file input
  + live preview + remove action for the product photo.

## Dev & build
- Dev: `npm start` (Express API, :3000) + `cd client && npm run dev` (Vite,
  :5173, proxies `/api/*` to :3000).
- Prod: `cd client && npm run build` → `client/dist`; Express serves it
  statically with an SPA fallback to `index.html`.
