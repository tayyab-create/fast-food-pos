# Design Language: Institutional Ledger

## What this style is
A quiet, document-like aesthetic for serious data-entry and counter-service
tools — the visual register of a well-run kitchen's paper order pads and
ledger books, translated to screen. Not a SaaS dashboard, not a marketing
page. It reads as a ledger sheet: hairline rules, a hard header rule, tabular
numerals, and sections that behave like a printed form's fields rather than
"cards." Best suited to point-of-sale, back-office, and admin workflows where
the interface's job is to feel precise and trustworthy rather than exciting.

Use this brief when building: the Cashier register, Kitchen ticket queue,
Reports, and Menu admin screens of this POS — anything where the content
(the order, the ticket, the number) is the hero and the chrome should stay
out of the way.

## Color

| Token           | Hex       | Role                                              |
|-----------------|-----------|----------------------------------------------------|
| `--ink`         | `#1C2B24` | Primary text, header rule, emphasis fills          |
| `--ink-soft`    | `#4A5A52` | Secondary text, labels                             |
| `--muted`       | `#7C8A82` | Placeholder-level text, hints, table header labels |
| `--paper`       | `#F3F5F1` | Page background (never pure white)                 |
| `--surface`     | `#FFFFFF` | Card/sheet background, input fields                |
| `--line`        | `#D8DED9` | Hairline borders, section dividers                 |
| `--line-strong` | `#B9C3BC` | Input borders                                      |
| `--forest`      | `#2F6F4E` | Primary accent — focus rings, active states, links |
| `--forest-dark` | `#20503A` | Primary buttons, section-title accent text         |
| `--forest-tint` | `#E8F0EA` | Selected-state backgrounds, focus glow             |
| `--ochre`       | `#A8672A` | Status/warning accent (used sparingly — one pill, not decoration) |
| `--ochre-tint`  | `#F6ECDE` | Background for the ochre accent                    |
| `--danger`      | `#B23A34` | Validation errors, negative balances               |
| `--danger-tint` | `#FBEAE9` | Error backgrounds                                  |

**Rules of use:** the palette is deliberately desaturated and cool. Forest
green is the *only* accent that gets used for interactive/positive states —
don't introduce a second "bright" color. Ochre and danger-red are reserved
for status meaning (pending, error), never decoration. Never pure black
(`#000`) or pure white-on-white with no border — surfaces always sit against
`--paper` with a 1px `--line` border.

## Typography

| Role                                  | Family                  | Notes |
|----------------------------------------|--------------------------|-------|
| Headline / document title             | Source Serif 4 (500–600) | Used once, at the top, like a form's printed title. Not used for body or labels. |
| Body, labels, buttons, UI chrome      | IBM Plex Sans (400/500/600) | Everything else. |
| Numbers, IDs, codes                   | IBM Plex Mono             | Any currency figure, order number, or status code. Tabular numerals (`font-variant-numeric: tabular-nums`) so columns of numbers align. |

**Scale:** headline ~26px · section labels ~11.5px uppercase with wide
letter-spacing (`0.06em`) · body/inputs ~13.5–14px · hints/meta ~11–12px.
Keep the range tight — this is a dense utility interface, not an editorial
page with dramatic size jumps.

**Rule:** the serif appears exactly once per screen (the page title).
Everything functional is sans or mono. Don't let the serif creep into
labels or buttons — that's what keeps it feeling institutional rather than
"boutique."

## Layout

- Content sits on a soft `--paper` background — like a physical document on
  a desk, not a full-bleed app shell. Main content column max-width 1320px
  (`main.wide`) on every screen — all four are working surfaces with a
  two-column or board layout, so none of them wants a narrow form column.
- A double-weight rule (2px, `--ink`) under the header separates identity
  from content — the one moment of visual weight in the whole page.
- Content organized into sections, each with a small-caps label followed by
  a hairline rule that extends to the section's right edge (label + flex
  line, not a full-width `<hr>`).
- Fields sit in a plain grid, label-above-input, generous but not loose gaps
  (16–20px). No card wrappers, no rounded panels — sections are separated by
  hairlines only. Shadows are reserved for things that genuinely float over
  the page (dropdown lists, the date-picker panel, modals) and for the
  focus glow; in-flow content never gets elevation.
- Tables (tickets, reports, menu admin) use 1px hairline grids with a very
  light header background, not zebra striping or heavy borders.
- Radius is minimal (3px) everywhere — just enough to soften edges, not
  enough to read as "app UI." Pill shapes are reserved for small inline tags
  that label a state (the status pill, a ticket's Urgent/order-type tags, the
  "options set" dot) — never for buttons, inputs, or containers.
- Totals/summary blocks (the Cashier order ledger) read like a paper
  receipt: a `--paper`-tinted panel with dashed hairline rules (`--line`,
  `--line-strong`) separating Subtotal/Discount rows — dashes, not solid
  lines, distinguish a receipt tally from an ordinary table. The final
  total is given a forest-green inverted row (`--forest-dark` background,
  white text) for emphasis — the one "loud" element per component. Never
  pure `--ink`/black for this emphasis — forest green is the app's only
  accent color, so the loud element stays inside the established palette
  instead of introducing a second one.

## Components & interaction

- **Inputs**: 1px border (`--line-strong`), white fill, sharp focus state =
  border turns forest green + a soft forest-tinted glow (`box-shadow`). No
  default browser blue.
- **Disabled/computed fields**: filled with a faint gray (`#F1F3F0`) rather
  than grayed-out text — reads as "system-calculated," not "broken."
- **Bordered option rows**: meaningful either/or choices (e.g. the Cashier's
  Percent / Flat discount toggle) render as bordered option buttons, not
  native radio inputs — the selected one gets a forest border + tint. Used
  for real business decisions, never for cosmetic choices.
- **Buttons**: one primary (`--forest-dark` fill, white text), one
  ghost/secondary (transparent, `--line-strong` border that darkens to
  `--ink` on hover). No gradients, no shadows.
- **Status pill**: small rounded tag, colored by state (ochre =
  pending/preparing, forest = ready, muted = completed) — for showing a single
  order's status outside its own status context (e.g. a lookup or history
  view). When orders are already grouped by status (the Kitchen board's
  Pending/Preparing/Ready columns), column position *is* the status —
  repeating it as a pill on every ticket would be decoration, not information,
  so the pill is omitted there.
- **Validation**: invalid fields get a danger-red border + tinted glow and
  an inline message directly under the label — errors explain what's
  needed, not just "invalid."
- **Motion**: none beyond simple transitions on focus/hover. No entrance
  animations, no hover-lift on every element.

## Voice

Plain, direct, active-voice labels: "Add item," "Pay," "Confirm payment" —
never "Submit" alone or "Process request." Hints are short and instructional ("e.g. no
onions"), not marketing copy. Error messages state the fix, not just the
failure.

## What to avoid

- No warm cream (`#F4F1EA`) + terracotta accent combination — reads as
  generic AI-generated design.
- No all-caps labels beyond the small section-title eyebrows (and even
  those stay small and quiet, not tracked-out banners).
- No card-grid-with-shadow treatment — this style uses hairlines and
  whitespace instead of elevation.
- No numbered step markers unless content is genuinely sequential.
- No monospace used decoratively — mono is reserved for actual numeric/ID
  data here, which is a legitimate, non-cliché use of it.
