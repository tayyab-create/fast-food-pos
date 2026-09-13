# Fast Food POS — Client

React + TypeScript + Vite frontend for the Fast Food POS. See the project root's
[`CLAUDE.md`](../CLAUDE.md) and [`docs/`](../docs/) for architecture, data
models, and the ledger visual style this app follows.

## Development

```bash
npm install
npm run dev      # Vite dev server, proxies /api to the backend
npm run build    # type-checks (tsc -b) then builds to dist/
```

Copy `.env.example` to `.env` to configure build-time variables (see
[`docs/DESIGN.md`](../docs/DESIGN.md)).
