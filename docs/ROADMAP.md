# Roadmap — Fast Food POS

Ideas for what to build next, split into new features and improvements to
what already exists. Nothing here is committed to — it's a working list to
pick from, not a backlog with deadlines. Items note the "why" so a future
pass can judge whether it's still worth doing.

## Biggest gap: authentication

Every page and every API route is open to anyone who can reach the server —
no login, no roles, nothing. This is fine for a single trusted till on a
closed local network, and is the one thing standing between this app and
being safe to run anywhere more exposed than that (a second till, a public
network, a real deployment). See `docs/DESIGN.md`'s "Known limitations" note
and the security review this project has already had — every finding traced
back to this one gap.

If/when this gets tackled: a single shared till password (session cookie) is
enough for "one register, one shop" — individual staff accounts only earn
their complexity once there's a real need to know *who* rang something up.

## New features

### Order editing (not just void)
Today a mis-keyed order can only be cancelled outright (the `voided` status).
There's no way to fix a wrong quantity or swap an item on an order that's
already been placed — the cashier has to void it and start over, losing the
order number continuity. Editing would need to recompute the total
server-side the same way `create()` does now, not trust a client-sent total.

### Printable / exportable receipt
Orders exist only on-screen. A real counter usually needs *something*
physical or shareable to hand to a customer — even a plain print-CSS view of
`OrderDetailModal`'s content would cover this without new backend work.

### Menu image consistency pass
Some menu items have generated placeholder images, others have real photos
(from an earlier session working on this same project concurrently). No
functional bug, just a visual inconsistency worth a cleanup pass.

### Persisted filters
Kitchen's search/column-visibility and Menu's search/category filters reset
on every page refresh. The same `localStorage` pattern already used for
Cashier's held orders (added because refresh was silently losing them) would
fix this cheaply.

### Multi-till / staff accounts
Only relevant if this ever needs to run more than one register at once.
Bundled with authentication above rather than done standalone — a second
till needs accounts to make sense of "whose order is this," which single-till
auth doesn't need to solve.

### Frontend test coverage
`npm test` currently covers only the backend's order/discount math
(`node:test`, no framework). Nothing exercises the React components — the
Cashier cart math is duplicated client-side (for live totals before
checkout) and server-side (for the authoritative total), and only the
server-side copy has a test today.

### ~~Order type (dine-in / takeout / delivery)~~ — done
`Order.orderType` (`'dine-in' | 'takeout' | 'delivery'`, default `'takeout'`)
is now set from a toggle on Cashier, shown as a tag on every Kitchen ticket,
filterable on Kitchen and Reports, and a sortable column in Reports' order
history.

### Customer-facing display / order number call
No way for a waiting customer to know their order status without asking.
A second, read-only screen (or even a simple `/display` route showing
Ready-column order numbers in large type) would close this — no new backend
needed, just a new view reading the existing `/api/orders?status=ready`.

### ~~Inventory / stock tracking~~ — partially done
`MenuItem.available` (boolean, default `true`) is now a simple "86'd" flag:
unavailable items are hidden from Cashier's grid, rejected server-side if
ordered anyway, and stay visible (tagged) in Menu admin with a one-click
toggle — no history/image/combo data lost. Full ingredient-level inventory
management is still not built, and wasn't the goal here.

### Tips
No tip field anywhere — `Order` has `subtotal`/`discount`/`total` but no
tip amount. Relevant mainly for the `card` payment method; cash tips
typically aren't tracked in a POS at all. Would need a design decision on
whether tips affect `total` or are recorded alongside it for reporting only.

### Loyalty / repeat-customer tracking
No concept of a customer at all today — every order is anonymous. Even a
lightweight "phone number on the order, look up past orders by it" would be
a meaningfully different feature (a new `Customer`-adjacent concept), not an
extension of anything that exists. Worth treating as optional/aspirational
rather than a near-term priority — it changes the app's scope more than
anything else on this list.

### Sales tax
Discount math is modeled (`percent`/`flat`) but there's no tax field or
calculation anywhere — `total` is just `subtotal - discount`. Any real
till in a taxed jurisdiction needs this; it's absent today, not disabled.

## Improvements to existing features

### Cashier
- **Held orders**: fixed to survive a refresh (`localStorage`) — still worth
  a "held orders never expire" check; a till left open overnight could
  accumulate stale holds with no way to bulk-clear them except one at a time.
- **Keyboard coverage**: Enter-to-submit and Escape-to-close exist now;
  arrow-key navigation through menu tiles or cart lines would go further
  toward `docs/INSTRUCTIONS.md`'s "usable via keyboard alone" rule.
- **Discount reason**: free text today; a short list of common reasons
  (staff, damaged item, price match, promo code) as quick-select chips would
  reduce typing and make Reports' discount-reason search more consistent.

### Kitchen
- **Overdue threshold**: now a Vite build-time env var
  (`VITE_OVERDUE_MINUTES`) — works, but requires a rebuild to change. A
  same-day threshold change (a manager wants tickets flagged after 10 minutes
  during a rush) currently isn't possible without redeploying.
- **Void reason**: voiding an order just sets `status: 'voided'` with no
  record of *why*. A short reason (matching the discount-reason pattern
  already in the data model) would make voided orders in Reports'
  history more useful than a plain red pill.

### Reports
- **Date range**: the daily report is always "today" — no way to look at
  yesterday, last week, or a custom range. Order history technically has all
  orders (searchable/sortable), but the stats cards (order count, revenue,
  top items) are locked to midnight-to-now.
- **Export**: no CSV/download of order history or the daily report — useful
  for actual bookkeeping outside the app.

### Menu admin
- **Bulk actions**: the per-item "Mark 86'd" toggle covers the single-item
  case; there's still no way to 86 or restore several items at once (end of
  a rush, start of a day).
- **Category management**: categories are just strings on each item, created
  implicitly by typing a new one — no rename-across-all-items or reorder.

## Data / schema notes for whoever picks these up

- `Order.paymentMethod` is `required` in the schema but 33 legacy orders
  predated the field and needed a one-time migration (`$set` to `'cash'`,
  already run). Any future required field on `Order` needs the same
  migration step before enforcing it — Mongoose won't retroactively backfill
  existing documents.
- Voided orders are excluded from Kitchen's board and the daily report's
  revenue/count/top-items, but stay visible in Reports' order history — this
  is deliberate (a record, not a delete) and should stay that way if order
  editing or refunds get added later.
- `MenuItem.comboItems` was migrated from name-keyed `{ name, qty }` entries
  to id-keyed `{ itemId, variant?, qty }` (one-off script, already run on
  the local DB). `Order.items[].comboItems` is still a `string[]` display
  snapshot and needs no migration.
- Still open from the code audit, deliberately not tackled yet: `PATCH
  /api/orders/:id` accepts any status transition (no state machine), and
  money is stored as floating-point dollars rather than integer cents.
