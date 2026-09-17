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
  labels.js             /api/labels/:kind — categories and tags as records of their own
controllers/            Business logic + Mongoose queries, one per resource
  menuController.js      Also handles image upload/removal (sharp resize + compress)
  ordersController.js
  reportsController.js
  labelsController.js    Category/tag list, add, rename (propagates to items), delete
models/                 Mongoose schemas
  MenuItem.js
  Order.js
  Counter.js             Atomic sequence counters (orderNumber)
  Label.js               { kind: 'category' | 'tag', name } — unique per kind; outlives the items that use it
uploads/                Compressed product images, served at /uploads (gitignored, runtime-only)
seed.js                 Populates sample menu items
client/                 Vite + React + TypeScript SPA
  src/
    main.tsx, App.tsx        React Router setup, NavBar
    pages/
      Cashier.tsx             Menu grid + cart + checkout, held orders, payment method (/)
      Kitchen.tsx             Order queue, polls every 3s (/kitchen)
      Reports.tsx             Range-scoped stats + order history, search by order #/item/discount reason (/reports)
      Menu.tsx                Menu CRUD (/menu)
      Settings.tsx            Categories and tags: add, rename in place, delete (/settings)
    components/
      LedgerTable.tsx         Shared ruled-row table primitive
      OrderDetailModal.tsx    Shared order detail popup (Cashier checkout confirmation, Reports order history row click)
      Dropdown.tsx            Custom listbox (replaces native <select> app-wide) — scroll-capped, styleable;
                               see "Reusable components" below
      Combobox.tsx            Free-text input with type-ahead suggestions, never forces a match
      DatePicker.tsx          Custom calendar + DateRangePicker (replaces native <input type="date">) — same
                               reasoning as Dropdown; see "Reusable components" below
      Modal.tsx               The one dialog shell (overlay, panel, title, × button, Escape)
      PayModal.tsx            Tender step (Cash/Card, amount tendered, change due); owns its
                               own submitting/error state so it can't double-fire
      VoidOrderModal.tsx      Void confirmation with a required reason (Kitchen + order detail)
      ComboPicker.tsx         Searchable checklist that builds a combo's contents by item id
      NavBar.tsx
    hooks/
      useDismissable.ts       Close-on-outside-click/Escape, shared by every popup component
      useFlipUp.ts            Opens a popup upward when it wouldn't fit below (every dropdown, combobox, tag list, calendar)
    api/
      client.ts               fetch wrapper (base URL, JSON, error handling)
      menu.ts, orders.ts, reports.ts, labels.ts   Typed functions per resource
    types.ts                  Shared TS interfaces (mirror backend shapes)
    comboFormat.ts             Resolves combo entries against the loaded catalog: display labels
                               ("2× Fries (Large)"), unit prices, and the bought-separately sum.
                               Labels must match describeComboContents() in ordersController.js,
                               which writes the order-time snapshot.
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
  comboItems?: [{ itemId: ObjectId, variant?: string, qty: number }],
                         // references the contained item by id (never by name, so renames can't
                         // orphan a combo); `variant` is the size name when that item has variants;
                         // qty defaults to 1. Names and prices are resolved against the catalog at
                         // read time. Deleting an item $pulls it out of every combo. A combo can't
                         // contain another combo, and ordering one fails if any ingredient is 86'd.
  image?: string,                                   // "/uploads/<itemId>.jpg?v=<timestamp>", undefined if none
  available?: boolean,   // default true; false = "86'd" — hidden from Cashier, rejected server-side, kept in Menu admin
  pinned?: boolean,      // default false; pinned items sort first on the Cashier grid with a pin mark
  tags?: string[],       // ≤3 labels of ≤16 chars ("New", "Spicy") shown as chips on the Cashier tile
}
```

### Label
```
{ _id, kind: 'category' | 'tag', name: string }   // unique per kind
```
Categories and tags are records in their own right, not just strings on
items: saving a menu item registers any category or tag it uses (upsert),
and deleting the last item that used one leaves the label in place. The
Settings page lists them with usage counts and lets you add, rename (the
new name is written onto every item that had the old one) or delete
(items in a deleted category move to "Other", which can't itself be
deleted; a deleted tag is pulled off every item). The Menu form's category
and tag suggestions come from these records, so an unused label can still
be picked.

### Order
```
{
  _id,
  orderNumber: number,   // sequential, per-order (1, 2, 3, ...) — not the Mongo _id
                         // assigned atomically from a Counter doc (_id: 'orderNumber'), race-safe across concurrent creates
  items: [{ name: string, price: number, qty: number, note?: string, comboItems?: string[] }],
                         // comboItems here is a formatted display snapshot, e.g. ["2× Cheeseburger", "Fries (Large)"] —
                         // derived from MenuItem.comboItems at order time, not the structured {name,qty} shape
  subtotal: number,
  discount?: { type: 'percent' | 'flat', value: number, reason?: string },
  total: number,   // subtotal minus discount, clamped to >= 0
                   // Every money field — here and on MenuItem — is dollars with at most two
                   // decimals: inputs with a third decimal are rejected (400), and computed
                   // amounts (subtotal, discount, total) are rounded to cents before saving.
                   // See lib/money.js (server) and client/src/money.ts (matching client copy).
  paymentMethod: 'cash' | 'card',
  orderType?: 'dine-in' | 'takeout' | 'delivery',  // default 'takeout'
  amountTendered?: number,  // cash only — validated >= total server-side, for change-due / till reconciliation
  urgent?: boolean,
  note?: string,   // order-wide note, distinct from per-item notes
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'voided',
    // voided orders are excluded from the Kitchen board and daily report revenue,
    // but stay visible in Reports' order history — a record, not a delete
  voidReason?: string,   // why it was voided — required by the API when voiding, shown in the detail view
  statusHistory: [{ status: string, at: Date, reason?: string }],
    // one entry per status change, oldest first — seeded with 'pending' at creation,
    // appended (never rewritten) on every PATCH /api/orders/:id; shown as a timeline
    // in OrderDetailModal's non-confirmed (Reports history) view. `reason` is set
    // on the 'voided' entry only.
  createdAt: Date,
}
```

## API contract

| Method | Path              | Body                                   | Response              |
|--------|-------------------|-----------------------------------------|------------------------|
| GET    | /api/menu         | —                                       | MenuItem[]             |
| POST   | /api/menu         | { name, price, category, variants?, isCombo?, comboItems?, available?, pinned?, tags? } | MenuItem (201) |
| PUT    | /api/menu/:id     | { name?, price?, category?, variants?, isCombo?, comboItems?, available?, pinned?, tags? } | MenuItem |
| DELETE | /api/menu/:id     | —                                       | 204                    |
| PUT    | /api/menu/bulk    | { ids: string[], available?, pinned?, category?, addTag?, removeTag? } — at least one of the optional fields; category/addTag validated and registered as labels | MenuItem[] (the updated items) |
| POST   | /api/menu/:id/duplicate | —                                  | MenuItem (201) — "<name> (Copy)", `available: true`, `pinned: false`, no image |
| POST   | /api/menu/:id/image | multipart, field `image` (jpeg/png/webp, ≤5MB) | MenuItem |
| DELETE | /api/menu/:id/image | —                                     | MenuItem               |
| GET    | /api/orders       | ?status= (optional filter)              | Order[]                |
| POST   | /api/orders       | { items: OrderItem[], paymentMethod, orderType?, amountTendered?, discount?, urgent?, note? } | Order (201) |
| PATCH  | /api/orders/:id   | { status, reason? } — `reason` required (≤200 chars) when status is `voided` | Order |
| POST   | /api/menu/:id/image-url | { url } (public http(s) image, ≤5MB; server downloads it and stores it exactly like an upload — loopback/LAN hosts and redirects are refused) | MenuItem |
| GET    | /api/labels/:kind | `kind` = category \| tag                | [{ _id, name, itemCount }] sorted by name |
| POST   | /api/labels/:kind | { name } (≤40 chars for a category, ≤16 for a tag; 409 if it exists) | Label (201) |
| PUT    | /api/labels/:kind/:id | { name } — renames and updates every item using it | Label |
| DELETE | /api/labels/:kind/:id | — (category: items move to "Other"; tag: pulled off items) | 204 |
| GET    | /api/reports/summary | `?from=YYYY-MM-DD&to=YYYY-MM-DD` (both optional, inclusive local days; neither = all time; malformed → 400) | { orderCount, revenue, avgOrder, discountTotal, voidedCount, voidedTotal, topItems: [{name, qty}], items: [{name, qty, revenue, orders, orderShare}], byPaymentMethod, byOrderType, byHour[24], byWeekday[7], byDay: [{date, count, revenue}], cashTendered, changeGiven, comboShare, discountsByReason: [{reason, count, amount}], voids: [{_id, orderNumber, total, reason, at}] } — voided orders are excluded from every revenue figure and counted separately; the client fetches the same-length range before `from` a second time to show period-over-period deltas |
| GET    | /api/reports/popular | —                                    | string[] — names of the 5 best-selling items over the last 7 days (the Cashier's "Popular" badge) |
| GET    | /api/reports/recent-sales | —                               | { [itemName]: qty } — quantity sold per item name over the last 7 days (Menu's Sales (7d) column) |

## Visual style
See [`DESIGN_LANGUAGE.md`](DESIGN_LANGUAGE.md) for the full token/type/component
system (Institutional Ledger). Don't duplicate style rules here — this file
stays about architecture and data shapes.

## Pages

- **Cashier (`/`)**: a search bar, category tabs (including an "All" tab), and
  a grid of tappable item tiles — items with `variants` expand an inline size
  picker on tap; `isCombo` items show their contents as a subtext line and,
  when the combo undercuts its contents' separate prices, that sum struck
  through beside the combo price. Tiles with an `image` show it above the
  name/price. `pinned` items sort to the front of the grid with a pin mark in
  the tile corner; a tile's `tags` and a computed "Popular" badge (item is in
  `GET /api/reports/popular`) show as small chips above the name. The order
  ledger sheet on the right shows the order's state in its header — "Order",
  the same red "Urgent" tag the Kitchen ticket shows when flagged, and the
  item count — with the controls beneath the cart lines: "⋯ More" and a
  "Mark urgent" toggle side by side (status in the header, control in the
  options row, so neither competes with the other). Above the cart lines is
  a Dine-in/Takeout/Delivery order-type toggle (Dine-in by default) above the
  cart lines (qty, name, line total, remove, optional per-item note) —
  adding a genuinely new line (not a qty bump on one already in the cart)
  smooth-scrolls the list down to it, so it's never left hidden below the
  fold once the list is tall enough to scroll — a
  collapsed "⋯ More" panel (a dot badge shows when something inside is set)
  holding the less-common per-order options — an order note and a
  Percent/Flat discount with an optional reason label — and a
  Subtotal → Discount → Total block (Total as the one inverted/emphasized
  row, filled `--forest-dark`). Checkout is "Hold order" (disabled on an
  empty cart) and "Pay" — filled `--ink` rather than the same green as the
  Total row directly above it, so the two don't read as one merged block —
  which opens a payment modal with an
  amount-due display (set in the display serif, the one place outside a page
  title it appears) and Cash/Card tabs — Cash shows an amount-tendered field
  with an "Exact" shortcut and live change-due readout (gated on tendering
  enough), Card is a single
  confirm — matching how Square/Toast separate payment from cart-building
  rather than picking it inline. A rejected order (e.g. an item 86'd since it
  was added) is shown inside the modal and the cart is kept. Held orders keep
  every cart field including order type. Menu items marked unavailable
  (`available: false`) are hidden from the tile grid entirely. On success,
  `OrderDetailModal`'s `confirmed` view draws its checkmark in — the circle
  strokes itself closed, then the check strokes in right after — rather than
  appearing as a static icon.
- **Kitchen (`/kitchen`)**: a search bar, Pending/Preparing/Ready column
  toggles, and a multi-select order-type filter, then a board of the visible
  columns (hiding a column lets the rest expand to fill the page). Orders
  shown as ledger tickets (sequential order number, an order-type tag, an
  "Urgent" tag + tinted background when flagged, elapsed time since placed — tinted red past
  `VITE_OVERDUE_MINUTES` (default 45; `VITE_API_DELAY_MS` in `vite dev` delays every API call to preview loading states), the order-wide note as a highlighted
  callout, itemized lines with per-item notes and combo contents, one button
  to advance to the next status, plus a Void action). Urgent orders sort to
  the top of their column. Polls `/api/orders` every 3 seconds.
- **Reports (`/reports`)**: four tabs. A `DateRangePicker` (default
  today; presets for the last 7 days, this month and "All time"; future days
  disabled) plus a Print button scope the first three; "Print" uses a
  `@media print` sheet that drops the nav, tabs and tools.
  - *Overview*: stat lines — orders, revenue, average order, discounts
    given, voided — each with a ▲/▼ delta against the same-length period
    immediately before the range (green when better, red when worse;
    discounts and voids count "up" as worse; open-ended ranges show no
    delta). Then top items, sales by order type, and `Chart`s for orders
    by hour, revenue by day (when the range spans more than one day) and
    revenue by day of week (when it spans more than a week or is all time).
  - *Items*: every item sold with qty, change in qty vs the previous
    period, revenue, and how many orders it appeared in (count · share);
    the combo share of order lines; CSV download.
  - *Payments & voids*: sales by payment method with cash tendered, change
    given and net cash; discounts by reason; a voids table with the reason
    and time of each (row click opens the order); CSV download.
  - *Order history*: the searchable, sortable, paginated table with its own
    filters, independent of the summary range (search by order #/item/
    discount/void reason; multi-select Status and Order type; its own
    `DateRangePicker` defaulting to all time; all shown as removable
    `ActiveFilters` chips) and a CSV download of the filtered rows.
    Clicking a row opens `OrderDetailModal`.
- **Settings (`/settings`)**: two ledger tables, Categories and Tags, each
  with an add field, a usage count per row ("unused" when zero), Rename
  (edits in place; Enter saves, Escape cancels) and Delete (via
  `ConfirmModal`, stating what happens to the items). See the Label model.
- **Menu (`/menu`)**: a search bar + multi-select Category, Status
  (Available/86'd/Pinned — an item matches if any chosen flag applies), Kind
  (Single/Sizes/Combo) and Tag filters, with the active ones listed as
  `ActiveFilters` chips, a "Select all N filtered" / "Deselect all" toggle,
  and a ledger table of menu items, sortable by item, category, price
  (lowest size price for sized items), a 7-day sales figure (from
  `GET /api/reports/recent-sales`, best-effort — a load failure just leaves
  the column at 0 rather than blocking the page) and kind. Each row shows a
  checkbox (click doesn't open the row), a 32px thumbnail when it has an
  `image`, a pin mark before the name when `pinned`, and an "in N combos"
  badge under the name (its own line, never crammed against the name) when
  other combos reference it. Checking any row shows a quiet status row —
  "Select all N filtered" / "Deselect all", the selected count, "Clear",
  and one `ActionMenu` button on the right ("Actions ▾") — instead of a row
  of loose buttons; its items are Mark available, Mark 86'd, Pin, Unpin,
  Set category…, Add tag… and Delete… (tinted caution/danger to match the
  same single-item actions), calling `PUT /api/menu/bulk` (or, for delete,
  one `DELETE` per item after a `ConfirmModal` listing every selected item)
  and reporting how many items it affected via a toast. "Set category…"
  and "Add tag…" open a small inline form under the status row rather than
  growing the bar itself. The detail sidebar has a "Cashier grid" section with the pin checkbox and
  a `TagInput`; edits there are held as a draft and written by a Save button
  (with Discard) that appears only once something changed, so no stray
  click reaches the catalog. Clicking a row shows its details in a sticky
  sidebar (Edit/Mark 86'd/Duplicate/Delete actions, the last with a confirm
  dialog — bulk delete gets the same dialog, listing every selected item
  with its combo membership); Duplicate calls `POST /api/menu/:id/duplicate`,
  which copies the item as "<name> (Copy)" with `available: true`,
  `pinned: false`, and no image (images are tied to the original's id on
  disk) — a starting point for a variation, opened straight into its detail
  view. "+ Add item" or Edit opens a form in the same sidebar, grouped under
  the detail view's small-caps section headers — **Basics** (name/category/
  price, a free-text-with-suggestions Combobox for category unless "This is
  a combo" locks it to "Combo", and "Available for sale" right below price),
  **Photo** (a drop zone with an "or paste an image URL" field beneath it —
  the preview renders straight from the pasted URL, Save is disabled with a
  "Loading image…" state until it has loaded or failed, and on save the
  server downloads and stores a pasted URL via
  `POST /api/menu/:id/image-url`), **Cashier grid** (pin checkbox + Tags
  `TagInput`), **Sizes** (a repeatable size-row editor for variants) and
  **Combo** (the "This is a combo" checkbox and, when checked, `ComboPicker`
  — a per-item size picker when the item has variants, a qty field per
  selected item, and a running price sum that auto-fills the item's own
  price field until the user types their own, so it can be saved as-is or
  overridden). Unavailable items stay in the list (tagged "(86'd)") rather
  than being deleted; deleting an item that's inside a combo warns, then
  removes it from those combos server-side.

## Reusable components
Shared building blocks that should be reused rather than re-implemented — if
a new screen needs a table, a detail popup, or a dropdown, reach for these
first.

- **`LedgerTable<T>`** (`components/LedgerTable.tsx`) — the app's table
  primitive: ruled rows, click-to-sort columns (`sortValue`), row click/select
  callbacks, and optional pagination (`pageSize` + `pageSizeOptions`, the
  latter rendered via `Dropdown`). Used by Reports' order history and Menu's
  item list.
- **`ActiveFilters`** (`components/ActiveFilters.tsx`) — a row of removable
  chips (`{ label, onRemove }[]` plus `onClearAll`) summarising every filter
  currently narrowing a list, rendered under the filter bar on Menu, Kitchen
  and Reports. Exists because a collapsed multi-select only shows
  `"N selected"`; the chips make the actual selection visible and one click
  to undo. Renders nothing when no filter is set.
- **`ConfirmModal`** (`components/ConfirmModal.tsx`) — the app's one "are you
  sure?" dialog, replacing `window.confirm`. Takes a question as `title`, a
  `message` (a sentence, or a list of what's affected), `confirmLabel`,
  optional `cancelLabel`, `danger` for a red confirm, a `ConfirmWarning`
  callout export for the irreversible sentence, and an `onConfirm` that
  may be async: the dialog shows a spinner, closes itself on success and
  stays open with the error on a throw. The safe button is focused first so
  Enter never confirms by accident. When `message` includes a `.confirm-list`
  that's taller than the dialog (e.g. a bulk delete listing 30+ items), only
  that list scrolls internally — the title, warning and buttons stay fixed
  in view rather than the whole dialog scrolling and pushing the confirm
  button off-screen. Used for deleting a menu item (single or, from the
  bulk toolbar, several at once) and discarding a held order.
- **`BusyOverlay`** (`components/BusyOverlay.tsx`) — a translucent veil with
  a spinner (and optional label) over its positioned ancestor, blocking
  every click/keystroke underneath — not just the button that started the
  action — until it clears. Takes `{ active, label? }`; the caller gives
  its ancestor `position: relative`. For an action that touches several
  rows at once (Menu's bulk toolbar, including the bulk-delete confirm's
  own `await`) so nothing else on the page can be clicked mid-write; a
  single-item action's own button disabling (a spinner + `disabled`) is
  usually enough on its own and doesn't need this.
- **`ToastProvider` / `useToast()`** (`components/Toast.tsx`) — outcome
  messages. `toast('Saved')` or `toast('Failed', { kind: 'error' })`, with
  an optional `action: { label: 'Undo', onClick }`. One toast at a time,
  bottom-centre, slides up and away (3s; 6s for errors or when it carries an
  action). Rule of use: successes the screen doesn't already show (an item
  saved, marked 86'd with Undo, a held order stashed), errors that aren't
  about a specific field (server unreachable — Kitchen's poll reports once
  and again when it recovers), and Undo for reversible actions (kitchen
  status moves, 86'd). Routine steps stay quiet; field mistakes stay inline.
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
    when empty. Used by Menu's category filter, Kitchen's order-type filter,
    and Reports' status and order-type filters.
  - Options are rendered as real `<button>`s, so every list is usable from
    the keyboard (Tab/Enter/Space) with no custom key handling.
  - Every popup in the app (these lists, `Combobox`, `TagInput`, both date
    pickers) goes through `useFlipUp`: on open it measures the room below the
    anchor inside the nearest scrolling container or the viewport, and opens
    upward when the list wouldn't fit.
  - The dropdown list sizes to its content (`width: max-content`, capped at
    `max-width: 320px`) rather than locking to the toggle's width, so a
    longer label (e.g. "Custom…") isn't clipped when the toggle itself is
    narrow.
- **`ActionMenu`** (`components/ActionMenu.tsx`) — a single labelled button
  ("Actions ▾") that opens the same dropdown-list chrome as `Dropdown`, but
  each item is a command that fires and closes the menu rather than a value
  the menu holds. Takes `{ label, items: { key, label, onSelect, tone?,
  startGroup?, disabled? }[], disabled? }`; `tone` colours a row like the
  app's semantic ghost buttons (`danger`/`caution`/`success`), `startGroup`
  draws a rule above the row to separate command groups. Use this instead
  of a row of loose buttons once there are more actions than a toolbar can
  hold calmly — a bulk-selection toolbar being the case it exists for.
  `ActionMenuInlineForm` (same file) is the small labelled-field-plus-Apply
  row an `ActionMenu` item that needs a value (a category, a tag) opens
  underneath the bar, so the bar itself never grows a permanent input.
  Used by Menu's bulk-selection toolbar.
- **`Combobox`** (`components/Combobox.tsx`) — a free-text input with
  type-ahead suggestions from a fixed option list, for fields that should
  accept a new value alongside existing ones (e.g. adding a brand-new menu
  category). Shows all options on focus, narrows by substring as you type,
  and hides the list entirely once nothing matches — never forces a
  selection, whatever's typed is the value on save. Used by Menu's item-form
  Category field.
- **`TagInput`** (`components/TagInput.tsx`) — a multi-select combobox:
  chosen values render as removable pills in front of a type-ahead field,
  and the list beneath works like `MultiSelectDropdown` (every known value
  with a check, click to tick or untick) while still accepting anything
  typed (Enter, comma or blur adds it). Once `max` values are chosen the
  unticked options and the text field are disabled until one is removed.
  Takes `{ value: string[], options, onChange, max?, maxLength?,
  placeholder?, disabled? }`. Used for menu-item tags in both the edit form
  and the detail view.
- **`Chart`** (`components/Chart.tsx`) — bars or a line over the same
  `{ label, value, title }[]` points on a ruled grid: four horizontal
  hairlines at "nice" steps (1 / 2 / 2.5 / 5 × 10ⁿ) with a labelled value
  axis on the left, 160px tall, bars capped at a readable width and centred
  in their slot, values written on the chart wherever there's room (every
  bar up to 16 points, thinned beyond that, the peak always). A two-button
  style toggle sits in the corner and is remembered per chart in
  localStorage. Hover shows a custom tooltip, never the browser's `title`
  attribute (its native hover delay reads as laggy); the tooltip element is
  always mounted and its position/content update in place, so a CSS
  transition glides it between adjacent bars/points instead of replaying
  an enter animation on every hover change. Used by Reports for
  orders by hour, revenue by day and revenue by day of week.
- **`downloadCsv()`** (`csv.ts`) — builds a CSV from rows (quoting as
  needed, UTF-8 BOM so Excel keeps × and —) and triggers a download. All
  Reports exports go through it.
- **`DatePicker`** (`components/DatePicker.tsx`) — replaces native
  `<input type="date">`, whose calendar popup is rendered by the OS/browser
  and can't be restyled with CSS in any browser (the same limitation that
  motivated `Dropdown` over native `<select>`). A toggle button showing the
  formatted date opens a ledger-styled month-grid panel (prev/next month,
  today/selected-day highlighting, Clear/Today shortcuts). Takes/returns a
  plain `"YYYY-MM-DD"` string (or `""` for unset), so it's a drop-in
  replacement for a native date input's value. Also exports
  `isoDateToLocalDate()` — use it (not `new Date(iso)`, which parses a bare
  date as UTC) whenever a picked date is compared against timestamps. An
  optional `max` (ISO) disables later days and the next-month arrow past it.
  Clicking the month title swaps the grid for a 12-year picker (paged with
  the same arrows, years past `max` disabled) so distant dates don't take
  dozens of clicks.
  - **`DateRangePicker`** (same file) shares the month grid: the first click
    sets one end, the second the other (either order), with the span tinted
    as you hover; footer presets for Today, Last 7 days, This month and All
    time (both ends `""`). Value is `{ from, to }`, formatted for the toggle
    by the exported `formatRange()`. Used by Reports to scope the page.
- **`Modal`** (`components/Modal.tsx`) — the dialog shell every popup uses:
  overlay, panel, `role="dialog"`, a serif title over a 2px ink rule (the
  order sheet's header, reused), a × close button, and closing on
  overlay click or Escape (only the topmost modal reacts to Escape, so a
  modal opened from inside another closes alone). `closeDisabled` blocks all
  three while a request is in flight; `lead`/`headerExtra` slot content above
  the title or beside it (the checkout tick, a status pill). Don't hand-roll
  an overlay — wrap content in this.
- **`VoidOrderModal`** (`components/VoidOrderModal.tsx`) — confirms a void
  and captures a required reason, which the API stores as `voidReason` and on
  the `voided` status-history entry. Used by Kitchen tickets and
  `OrderDetailModal`.
- **`PayModal`** (`components/PayModal.tsx`) — the tender step. Takes `total`,
  an `onConfirm(method, amountTendered?)` that returns a promise, and
  `onClose`. Owns its own submitting/error state: a rejected confirm shows
  the message inline and keeps the modal open, and the confirm button is
  disabled while a request is in flight so Enter + click can't place two
  orders. Used by Cashier.
- **`ComboPicker`** (`components/ComboPicker.tsx`) — builds a combo's
  `comboItems` from a list of candidate items: a real checkbox per row, a qty
  field and size picker once selected, and a bought-separately sum. Entries
  reference items by `_id`. Used by Menu's item form.
- **`useDismissable(ref, open, onClose)`** (`hooks/useDismissable.ts`) — the
  one implementation of "close this popup on outside pointer-down or
  Escape", shared by `Dropdown`, `MultiSelectDropdown`, `Combobox`, and
  `DatePicker`. Reach for it before writing another document listener.

## Dev & build
- Dev: `npm run dev` (Express API via nodemon, :3000) + `cd client && npm run
  dev` (Vite, :5173, proxies `/api/*` to :3000).
- Prod: `cd client && npm run build` → `client/dist`; Express serves it
  statically with an SPA fallback to `index.html`.
