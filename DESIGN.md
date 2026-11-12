---
name: SK Salinas 1 Project Monitoring System
description: A calm paper notebook for the SK's projects — warm paper, pine ink, a clay mark for what needs attention.
colors:
  paper: "#F6F1E7"
  panel: "#FFFDF8"
  ink: "#23211E"
  ink-soft: "#6B655C"
  line: "#E2D9C8"
  pine: "#1F4D3A"
  pine-dark: "#193F30"
  pine-light: "#E3ECE5"
  clay: "#C8643B"
  clay-text: "#A9502C"
  clay-wash: "#F8E8DF"
  mustard: "#E0A93B"
  mustard-text: "#8A5F12"
  mustard-wash: "#F9EED3"
  sage: "#7F9A7A"
  sage-text: "#4F664C"
  sage-wash: "#E6EDE3"
typography:
  display: "Young Serif (self-hosted, @fontsource/young-serif), one weight"
  body: "Lexend 400/500/600 (self-hosted, @fontsource/lexend)"
  base: "16px / 1.6"
  page-title: "28px Young Serif"
  section-title: "20px Young Serif"
  minimum: "13px"
spacing: [8, 16, 24, 32, 48]
radius:
  card: 8px
  control: 6px
source-of-truth: client/src/theme.css
---

# Design System: SK Salinas 1 Project Monitoring System

## Overview

**Calm paper notebook.** The system reads like a well-kept planner on a barangay hall desk:
warm off-white paper with a faint dot grid, cream panels ruled with thin tan lines, pine-green ink
for everything you can act on, and a single clay mark for what needs the reader's attention. It is
warm, organized and quiet; it must never look like a generated SaaS dashboard.

Mode: **Operate** for the admin panel (officials on computers), **Read** for the public site
(residents on phones). Both live in the same world.

Every value lives in `client/src/theme.css` (CSS variables). `client/tailwind.config.js` maps the
existing class families onto it, so the whole UI changes from one file:

| Class family | Notebook colour | Used for |
|---|---|---|
| `brand-*` | pine ramp (600 = `--pine`) | primary buttons, links, active menu, focus |
| `accent-*` / `amber-*` | mustard ramp (500 = `--mustard`) | pending, waiting, warnings |
| `red-*` | clay ramp (500 = `--clay`, 600 = text-safe clay) | important actions, errors, rejected, danger |
| `green-*` | sage ramp (400 = `--sage`, 600 = text-safe sage) | done, completed, success |
| `slate-*` | warm paper neutrals (200 = line, 600 = ink-soft, 900 = ink) | text, borders, quiet surfaces |
| `paper`, `panel`, `line`, `pine`, `clay`, `mustard`, `sage`, `ink-soft` | the variables directly | new markup |

**Swapping the mood:** change the palette block in `theme.css` only. Teal `#1E5F63` with coral
`#D9694A` gives a fresher look with the same layout (update the matching ramps in the Tailwind config).

## Colors

- **Pine is the only action colour.** Primary buttons, links, the active menu row, focus rings and
  selected states. Hover: `--pine-dark`. Selected/hover backgrounds: `--pine-light`.
- **Clay and mustard are rare.** Clay marks what must be noticed: the page-title underline, error
  messages, danger buttons, rejected/cancelled status, alert counts. Mustard marks waiting things:
  Proposed, pending, warnings.
- **Sage means done.**
- **Text-safe shades.** The pure accents are for fills, dots and rules. Words in those colours use
  `--clay-text` (5.6:1 on white), `--mustard-text` (5.0:1 on paper) and `--sage-text` (5.6:1).
  White text sits only on pine (10:1) or `--clay-fill` (5.6:1), never on pure clay (3.9:1).

## Typography

- Headings, page titles, card titles and large figures: **Young Serif**. It has one weight; bold is
  never synthesized (`font-synthesis: none`). Headings are sentence case, never uppercase.
- Everything else: **Lexend**, 16px / 1.6. Weights 400 (text), 500 (labels, buttons, emphasis), 600.
- Page title 28px with a **40px clay rule** under it (`.page-title`). Section/card title 20px
  (`.section-title`). Nothing below 13px (`.text-xs` is pinned to 13px).
- Small uppercase **planner-tab labels** (`.section-label`: 13px, 500, 0.09em tracking, ink-soft)
  group related content: sidebar groups, KPI labels, table headers. They label groups; they are never
  an eyebrow stacked above a heading.
- Counts in chips and tables use Lexend tabular figures, not the serif's old-style figures.

## Layout

- **Admin shell** (`AdminLayout.jsx`): 240px sidebar on `--panel` with a 1px right `--line` border;
  seal + "SK Salinas 1" nameplate, grouped menu (icon + label, Lucide 18px / 1.75), today's date at
  the foot. Active item: `--pine-light` row with a 3px pine bar on its left edge. Top bar inside the
  content column: page name on the left, bell, user name + role, Logout on the right. No search.
- Content column: max 1200px, centred, 32px padding (16px on phones).
- Every page opens with `PageHeader`: title, one-line purpose, main action at the top right.
- 8px spacing scale: 8, 16, 24, 32, 48.
- **Below 900px** the sidebar collapses to a menu button and drawer. **Below 600px** tables with
  `.table-stack` become stacked cards (cells carry `data-label`), and page actions, modal footers and
  form submit buttons go full width (`.actions-stack`).
- Public site (`PublicLayout.jsx`): panel header with underline-tab navigation, paper body, panel
  footer. The home page opens with a compact intro beside the "Happening now" card — no hero banner.

## Elevation & Depth

Paper does not float. Cards are `--panel` with a 1px `--line` border and 8px corners; at most a 1px
shadow. Modals use the same card on an ink scrim. No glass, no blur, no soft drop shadows.

## Components

- **Buttons** (`.btn` + `ui.jsx Button`): 40px tall, 6px corners, Lexend 500. Primary = solid pine,
  white text. Secondary = transparent with a 1px pine border. Danger = text-safe clay. Ghost = ink-soft,
  pine-light on hover. `size="sm"` (32px) is for buttons inside rows and cards. The legacy `accent`
  variant renders as pine.
- **Cards** (`.card`): panel, 1px line, 8px. Card headers use a **dashed** `--line` rule (`.card-head`;
  a card whose first child is a `.section-title` gets it automatically).
- **Inputs** (`.input`): white, 1px line, 6px corners, label above, pine border + pine-light ring on focus.
- **Tables** (`.table-notebook`): header row on `--paper` with ink-soft uppercase labels, rows separated
  by 1px `--line`, pine-light row hover, no grid lines.
- **Status pills** (`Badge`, `StatusRibbon`): small pill with a coloured dot and the word. Sage = done,
  mustard = pending/proposed, clay = rejected/cancelled/overdue, pine = planning/ongoing, neutral = on hold.
- **Stage steps** (`StageSteps`): sage done, pine current, mustard on hold, clay cancelled.
- **Notices** (`.notice-ok` sage, `.notice-error` clay, `.notice-warn` mustard) near the top of content.
- **Empty states** (`EmptyState`): one plain sentence saying what to do next and one button. No
  illustration.
- **Date tile**: a planner leaf — month in clay small caps over the day in serif.
- **Charts**: pine/mustard/sage/clay fills, dashed line hairlines, Lexend 13px ticks, panel tooltip.
- **Confirmation dialog** (`ConfirmDialog`): one shared modal for every confirmation.

### Documented exceptions

- The **Project Request form** keeps its paper look: the SK letterhead and the black-bordered
  Purchase Request table, as printed on the SK's own sheet.
- **PDF/Excel exports** and the downloaded QR sheet are documents, not screens; they keep their
  print styling.
- The photo **lightbox** stays dark so pictures read correctly.

## Do's and Don'ts

### Do
- Keep pine as the one action colour; spend clay and mustard only on what needs noticing.
- Put every colour and size in `theme.css`; use the class families above in markup.
- Give every page a title, a one-line purpose and its main action at the top right.
- Confirm before anything destructive, with the shared `ConfirmDialog`.

### Don't
- No purple, blue or neon gradients; no glassmorphism or blurred cards; no big soft shadows.
- No emoji as icons — Lucide line icons only, 18px, stroke 1.75.
- No Inter/Poppins look; no uppercase serif headings; no fake bold on Young Serif.
- No giant hero banners or stock illustrations; no dark mode with glowing accents.
- No text below 13px; no words in pure sage, mustard or clay on light backgrounds.
