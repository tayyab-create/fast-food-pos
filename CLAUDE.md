# Fast Food POS

Single-till point-of-sale: React+TypeScript (Vite) frontend, Express+MongoDB
backend, ledger-style UI.

**Before doing anything in this repo, read:**
1. [`docs/DESIGN.md`](docs/DESIGN.md) — architecture, data models, API
   contract, page-by-page description.
2. [`docs/DESIGN_LANGUAGE.md`](docs/DESIGN_LANGUAGE.md) — color tokens,
   type system, layout/component rules for the ledger visual style.
3. [`docs/INSTRUCTIONS.md`](docs/INSTRUCTIONS.md) — modularity, clean-code,
   and UI/UX rules to follow on every change.

Keep all three docs up to date when the architecture, API, or design system
changes.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
