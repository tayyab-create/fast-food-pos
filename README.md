# Fast Food POS

A single-till point-of-sale system for a fast food counter: cashier order
entry, a kitchen display queue, daily sales reports, and menu management.

- **Backend**: Express + MongoDB (Mongoose)
- **Frontend**: React + TypeScript SPA, built with Vite
- **Visual style**: "Institutional Ledger" — a quiet, document-like aesthetic
  (see [`docs/DESIGN_LANGUAGE.md`](docs/DESIGN_LANGUAGE.md))

## Features

- **Cashier** — tap-to-order menu grid with variants and combos, discounts,
  order notes, urgent flagging, held orders (resume a stashed cart later),
  cash/card payment, and a printable-style order confirmation.
- **Kitchen** — a live Pending/Preparing/Ready board, urgent and overdue
  highlighting, and order void/cancel.
- **Reports** — daily order count and revenue, top-selling items, and a
  searchable, sortable order history with a full order detail view.
- **Menu admin** — CRUD for items, sizes/variants, combos, and product photos
  (uploaded images are resized and compressed server-side).

## Requirements

- Node.js 20.6+ (uses the native `--env-file`-style `process.loadEnvFile()`)
- A running MongoDB instance

## Getting started

```bash
# 1. Install backend dependencies
npm install

# 2. Configure environment
cp .env.example .env
# edit .env if your MongoDB isn't at the default local URI

# 3. Seed some sample menu items (optional)
npm run seed

# 4. Run the backend
npm run dev          # nodemon, restarts on server/route/controller/model changes

# 5. In a second terminal, run the frontend
cd client
npm install
cp .env.example .env
npm run dev           # Vite dev server at :5173, proxies /api to :3000
```

Open `http://localhost:5173` for local development (hot reload), or build
and let Express serve everything from one origin:

```bash
npm run build          # builds client/dist
npm start               # serves client/dist + the API from :3000
```

## Testing

```bash
npm test                # runs the backend unit tests (node:test)
```

Covers the order/discount math and menu field validation — the logic most
likely to silently break a total if changed carelessly.

## Project structure & docs

Read these before making changes — see [`CLAUDE.md`](CLAUDE.md) for the full
list of rules:

- [`docs/DESIGN.md`](docs/DESIGN.md) — architecture, data models, API contract,
  page-by-page description.
- [`docs/DESIGN_LANGUAGE.md`](docs/DESIGN_LANGUAGE.md) — the visual/design
  system (color tokens, typography, layout and component rules).
- [`docs/INSTRUCTIONS.md`](docs/INSTRUCTIONS.md) — modularity, clean-code, and
  UI/UX rules to follow on every change.

## Known limitations

This app has no authentication — it's built for a single trusted till on a
local network, not for exposure beyond that. See `docs/DESIGN.md` and the
project's own review history before deploying it anywhere more open than that.
