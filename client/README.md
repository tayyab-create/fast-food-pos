# Fast Food POS — Client

React 19 + TypeScript + Vite frontend for the Fast Food POS. See the project
root's [`CLAUDE.md`](../CLAUDE.md) and [`docs/`](../docs/) for architecture,
data models, and the "Institutional Ledger" visual style this app follows —
don't introduce new styling patterns here without checking those first.

## Scripts

```bash
npm install
npm run dev       # Vite dev server at :5173, proxies /api/* to the backend at :3000
npm run build     # tsc -b (typecheck) then vite build -> dist/
npm run preview   # serve the built dist/ locally, for a production-mode sanity check
npm run lint      # oxlint
```

The backend must be running separately (`npm run dev` at the project root)
for API calls to resolve — see the [root README](../README.md).

## Environment

Copy `.env.example` to `.env`:

```
VITE_OVERDUE_MINUTES=45
```

This is a **Vite build-time** variable — it's baked into the bundle when you
run `dev` or `build`, not read at runtime. Changing it requires a rebuild (or
restarting `vite dev`) to take effect. It controls how long a Kitchen ticket
sits in Pending/Preparing before it's flagged overdue.

## Project layout

```
src/
  main.tsx, App.tsx        React Router setup, NavBar
  pages/
    Cashier.tsx             Menu grid + cart + checkout (/)
    Kitchen.tsx             Order queue board (/kitchen)
    Reports.tsx             Daily stats + order history (/reports)
    Menu.tsx                Menu admin CRUD (/menu)
  components/
    LedgerTable.tsx         Shared sortable/paginated table
    OrderDetailModal.tsx    Shared order detail/confirmation popup
    NavBar.tsx
  api/
    client.ts               fetch wrapper (JSON, error handling)
    menu.ts, orders.ts, reports.ts   Typed functions per backend resource
  types.ts                  Shared TS interfaces — kept in sync with the
                             backend's Mongoose schemas by hand
  styles/
    ledger.css              The one global stylesheet (no CSS modules,
                             no per-component styles)
```

Components never call `fetch` directly — they go through a typed function in
`api/`. If you add a backend endpoint, add its wrapper there first.

## Testing

No frontend test suite yet — the backend's order/discount math is covered
under `npm test` at the project root. UI changes are verified by building
(`npm run build`) and exercising the feature manually.

## Linting

`oxlint` is configured in `.oxlintrc.json` (React hooks rules, unused-export
warnings), run via `npm run lint`. If it fails with a missing native binding
(`oxlint.<platform>.node`), reinstall `node_modules` for your platform —
`@rolldown/binding-win32-x64-msvc` and similar packages are platform-specific
and won't resolve if `node_modules` was copied from a different OS/arch.
