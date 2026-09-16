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
      Dropdown.tsx            Custom listbox (replaces native <select> app-wide) — scroll-capped, styleable;
                               see "Reusable components" below
      Combobox.tsx            Free-text input with type-ahead suggestions, never forces a match
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
  available?: boolean,   // default true; false = "86'd" — hidden from Cashier, rejected server-side, kept in Menu admin
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
  orderType?: 'dine-in' | 'takeout' | 'delivery',  // default 'takeout'
  amountTendered?: number,  // cash only — validated >= total server-side, for change-due / till reconciliation
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
| PUT    | /api/menu/:id     | { name?, price?, category?, variants?, isCombo?, comboItems?, available? } | MenuItem |
| DELETE | /api/menu/:id     | —                                       | 204                    |
| POST   | /api/menu/:id/image | multipart, field `image` (jpeg/png/webp, ≤5MB) | MenuItem |
| DELETE | /api/menu/:id/image | —                                     | MenuItem               |
| GET    | /api/orders       | ?status= (optional filter)              | Order[]                |
| POST   | /api/orders       | { items: OrderItem[], paymentMethod, orderType?, amountTendered?, discount?, urgent?, note? } | Order (201) |
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
  on the right shows a Dine-in/Takeout/Delivery order-type toggle above the
  cart lines (qty, name, line total, remove, optional per-item note), a
  collapsed "⋯ More" panel (a dot badge shows when something inside is set)
  holding the less-common per-order options — "mark urgent", an order note,
  and a Percent/Flat discount with an optional reason label — and a
  Subtotal → Discount → Total block (Total as the one inverted/emphasized
  row). Checkout is a single "Pay" button that opens a payment modal with an
  amount-due display and Cash/Card tabs — Cash shows an amount-tendered field
  and live change-due readout (gated on tendering enough), Card is a single
  confirm — matching how Square/Toast separate payment from cart-building
  rather than picking it inline. Menu items marked unavailable
  (`available: false`) are hidden from the tile grid entirely.
- **Kitchen (`/kitchen`)**: a search bar plus Pending/Preparing/Ready column
  toggles, then a board of the visible columns (hiding a column lets the rest
  expand to fill the page). Orders shown as ledger tickets (sequential order
  number, a non-"takeout" order-type tag, an "Urgent" tag + tinted background
  when flagged, elapsed time since placed — tinted red past
  `VITE_OVERDUE_MINUTES` (default 45), the order-wide note as a highlighted
  callout, itemized lines with per-item notes and combo contents, one button
  to advance to the next status, plus a Void action). Urgent orders sort to
  the top of their column. Polls `/api/orders` every 3 seconds.
- **Reports (`/reports`)**: today's order count and revenue as ledger stat
  lines, plus a ruled table of top-selling items by quantity.
- **Menu (`/menu`)**: a search bar + category filter above a ledger table of
  menu items (each row shows a 32px thumbnail when it has an `image`).
  Clicking a row shows its details in a sticky sidebar (Edit/Mark 86'd/Delete
  actions, with a confirm dialog before delete); "+ Add item" or Edit opens a
  form in the same sidebar — name/category/price fields, an "Available for
  sale" checkbox, a repeatable size-row editor for variants, a searchable
  checklist to build combos from existing items (with a per-item size picker
  when the item has variants), and a file input + live preview + remove
  action for the product photo. Unavailable items stay in the list (tagged
  "(86'd)") rather than being deleted.

## Reusable components
Shared building blocks that should be reused rather than re-implemented — if
a new screen needs a table, a detail popup, or a dropdown, reach for these
first.

- **`LedgerTable<T>`** (`components/LedgerTable.tsx`) — the app's table
  primitive: ruled rows, click-to-sort columns (`sortValue`), row click/select
  callbacks, and optional pagination (`pageSize` + `pageSizeOptions`, the
  latter rendered via `Dropdown`). Used by Reports' order history and Menu's
  item list.
- **`OrderDetailModal`** (`components/OrderDetailModal.tsx`) — the order
  detail/confirmation popup. Takes an `Order`, a `confirmed` flag (checkout
  confirmation vs. a plain history lookup), and an optional `onVoided`
  callback that gates the Void action. Used by Cashier (post-checkout) and
  Reports (order history row click).
- **`Dropdown<T>` / `SimpleDropdown` / `MultiSelectDropdown`**
  (`components/Dropdown.tsx`) — replaces every native `<select>` in the app.
  A native select's popup is rendered by the OS/browser, so it can't be
  restyled or scroll-capped with CSS; these are plain styled
  `<div>`/`<button>`/`<ul>` listboxes instead, so they inherit the ledger
  visual language and cap their option list at `max-height: 240px` with their
  own scrollbar. Close on outside click or Escape.
  - `Dropdown<T extends string | number>` (single-select) takes `{ value,
    options: {value, label}[], onChange, disabled?, displayLabel? }` — use
    this when the display label differs from the value (e.g.
    `"Medium ($7.99)"` labeling a `"Medium"` value) or values aren't plain
    strings. Used by Menu's per-item combo variant picker and
    `LedgerTable`'s page-size picker.
  - `SimpleDropdown` is a thin single-select wrapper for the common case:
    `options: string[]` used as both value and label.
  - `MultiSelectDropdown` takes `{ values: string[], options: string[],
    onChange, placeholder? }` — checkbox-style options that toggle in place
    without closing the list, for filters where more than one value can
    apply at once (`values: []` means "no filter, show all"). The toggle
    label shows the single selected value, `"N selected"`, or `placeholder`
    when empty. Used by Menu's category filter.
  - The dropdown list sizes to its content (`width: max-content`, capped at
    `max-width: 320px`) rather than locking to the toggle's width, so a
    longer label (e.g. "Custom…") isn't clipped when the toggle itself is
    narrow.
- **`Combobox`** (`components/Combobox.tsx`) — a free-text input with
  type-ahead suggestions from a fixed option list, for fields that should
  accept a new value alongside existing ones (e.g. adding a brand-new menu
  category). Shows all options on focus, narrows by substring as you type,
  and hides the list entirely once nothing matches — never forces a
  selection, whatever's typed is the value on save. Used by Menu's item-form
  Category field.

## Dev & build
- Dev: `npm start` (Express API, :3000) + `cd client && npm run dev` (Vite,
  :5173, proxies `/api/*` to :3000).
- Prod: `cd client && npm run build` → `client/dist`; Express serves it
  statically with an SPA fallback to `index.html`.
