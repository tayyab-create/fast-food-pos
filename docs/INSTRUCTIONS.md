# Engineering Instructions — Fast Food POS

Read this (and `DESIGN.md`, `DESIGN_LANGUAGE.md`) before making any change.
These rules exist so the codebase stays easy to extend as more features
(staff accounts, multi-till, inventory) get added later.

## Modularity
- **Routes contain no business logic.** A file under `routes/` only declares
  `router.get/post/put/delete(path, controllerFn)`. All Mongoose queries and
  response-shaping logic live in the matching `controllers/*.js`.
- **Controllers contain no HTTP-framework concerns** beyond reading
  `req.params`/`req.body` and calling `res.json`/`res.status`. Keep them
  focused on one resource each.
- **Reuse `LedgerTable`** for any new tabular UI instead of writing a new table
  from scratch — it's the one place ruled-row rendering lives.
- **Typed API functions only.** Components never call `fetch` directly; they
  call a function from `client/src/api/*.ts`, which returns typed data from
  `types.ts`. If a new endpoint is added, add its typed wrapper there first.
- **No shared-types package** between server and client — the server stays
  plain JS. Keep `client/src/types.ts` in sync with `docs/DESIGN.md`'s data
  models by hand; this is a two-file sync, not worth automating at this size.

## Clean code
- Small, focused functions and components — one page component per screen,
  one concern per controller function.
- No speculative abstraction: don't add config, interfaces, or generic layers
  for a single current use case (YAGNI). Three similar lines beat a premature
  helper.
- No dead code: delete instead of commenting out; don't leave unused
  exports/props "for later."
- No new dependency if the stdlib, a native platform feature, or an
  already-installed package covers it.
- Comments explain *why*, not *what* — only add one when something is
  non-obvious (a workaround, a hidden constraint), never to restate the code.

## UI/UX principles
- One consistent visual language: the ledger theme (`styles/ledger.css`) is
  the only styling system — don't introduce a second visual style for a new
  page.
- Numbers (money, quantities) are always right-aligned and tabular; text is
  left-aligned.
- Minimal color: the accent color is reserved for actions and status —
  everything else is near-black text on off-white.
- Status is shown as the one status pill defined in `DESIGN_LANGUAGE.md`
  (rounded tag, colored by state) — used once per order/ticket, never
  repeated as decoration elsewhere on the same screen.
- Everything interactive must be usable via keyboard alone (tab order, Enter
  to submit) — cashiers are moving fast at a counter. Prefer a real
  `<button>`/`<input>` over an `onClick` on a `<div>`/`<li>`/`<tr>`; where a
  non-button element must be clickable (`LedgerTable` rows and sort headers),
  give it `tabIndex` and an Enter/Space handler.
- Every destructive action (delete menu item, remove cart line) is a single
  explicit click on a clearly labeled control — no hidden gestures.
- Menu item **variants** use a repeatable size/price row editor (`+ Add
  size` per row, a `.remove-btn` to drop one) in the Menu form's sidebar —
  not a modal, not a text-DSL.
- **Images** only ever change through the dedicated
  `POST/DELETE /api/menu/:id/image` endpoints, never the generic menu
  `PUT` — keep `image` out of `menuController.js`'s `UPDATABLE_FIELDS`
  allowlist so a client can never set an arbitrary image URL directly.

## Before you change anything
1. Check `docs/DESIGN.md` for the current architecture and data shapes, and
   `docs/DESIGN_LANGUAGE.md` for the visual/component rules.
2. Confirm the change fits an existing module (route/controller/page/component)
   before creating a new one.
3. If you add an endpoint, update the API contract table in `DESIGN.md`.
4. If you add a page, add its route in `App.tsx`, a link in `NavBar.tsx`, and
   reuse `LedgerTable`/`ledger.css` rather than new styling.
