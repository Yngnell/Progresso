---
name: SK Salinas 1 Project Monitoring System
description: A project monitoring system drawn in the lettering and colours of the Sangguniang Kabataan Salinas 1 seal.
colors:
  ink: "#0A0C10"
  azure: "#2F7FE6"
  azure-action: "#1C66CC"
  azure-action-hover: "#174FA3"
  navy-rail: "#0B1F4A"
  navy-deep: "#06122E"
  azure-wash: "#EEF5FE"
  azure-tint: "#DCEAFD"
  azure-soft: "#BBD5FA"
  azure-light: "#8AB8F5"
  gold-sun: "#F2B705"
  gold-hover: "#F7C948"
  gold-deep: "#CB8F00"
  gold-wash: "#FFF3C4"
  gold-text: "#8A5A00"
  ribbon-red: "#D52826"
  ribbon-red-deep: "#B01E1E"
  red-wash: "#FEF1F0"
  bamboo-green: "#538A1B"
  bamboo-text: "#426E18"
  green-wash: "#F3F9E8"
  ground: "#F4F7FC"
  track: "#E9EEF7"
  hairline: "#D8E0EE"
  rule-strong: "#BAC6DB"
  slate-muted: "#627290"
  slate-body: "#334055"
  slate-text: "#222D40"
  slate-heading: "#141C2C"
typography:
  display:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "0.025em"
  headline:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.025em"
  title:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.33
    letterSpacing: "0.025em"
  item-title:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.375
  body:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
  figure:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.4
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  card: "20px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.azure-action}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.azure-action-hover}"
  button-accent:
    backgroundColor: "{colors.gold-sun}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-accent-hover:
    backgroundColor: "{colors.gold-hover}"
  button-secondary:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.slate-body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-danger:
    backgroundColor: "{colors.ribbon-red}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card:
    backgroundColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    padding: "20px"
  input:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.slate-heading}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  nav-rail:
    backgroundColor: "{colors.navy-rail}"
    textColor: "{colors.azure-tint}"
    width: "256px"
  nav-rail-active:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.navy-rail}"
  status-ribbon:
    typography: "{typography.label}"
    textColor: "#FFFFFF"
    padding: "2px 16px"
  date-tile:
    backgroundColor: "{colors.navy-rail}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    size: "56px"
---

# Design System: SK Salinas 1 Project Monitoring System

## Overview

**Creative North Star: "The Seal Made Working"**

The world is the seal of the Sangguniang Kabataan, Salinas 1: a black ink ring, an azure field, a swallowtail red ribbon, a gold mark, bamboo green. Every colour in the build is read off that seal, and its two most recognisable forms are put to work as data: the ring becomes the progress roundel and the ribbon becomes the status banner. The interface is a ledger kept under that seal, clear for volunteer officials at a desktop in the barangay hall and for residents on a phone.

The ground is calm and cool: a pale azure-tinted neutral page (`ground`) with white cards, a deep navy rail and footer that stand in for the seal's shadowed azure, and headings in Barlow Condensed capitals, the seal's own lettering. Colour is saturated only where it carries meaning (progress, status, schedule, the one primary action). Density is moderate: generous 24px gaps between panels, 20-24px panel padding, text at 15-16px.

**Key Characteristics:**
- Seal-derived palette: ink, azure, gold, ribbon red, bamboo green, over azure-tinted neutrals.
- Two signature marks carry the data: ProgressRoundel (progress) and StatusRibbon (status).
- Condensed, bold, uppercase headings; humanist Barlow for everything read in sentences.
- Navy rail and footer, white top bar, pale azure-grey page.
- Flat, hairline-bordered cards; depth reserved for hover and overlays.
- Self-hosted fonts (Barlow 400-700, Barlow Condensed 600-700) so the system works on slow hall internet.

## Colors

A seal palette: ink and navy for structure, azure for interaction and progress, gold for the single primary action and "ongoing", red and green only for status.

### Primary
- **Seal Azure** (#2F7FE6): the progress arc on track, focus ring, progress bar fill, input focus border.
- **Action Azure** (#1C66CC): primary button fill, active nav indicator on the public bar, text links (as the 700 step #174FA3). Also the browser accent colour.
- **Navy Rail** (#0B1F4A): the admin rail, public footer, auth panel, public hero, date tiles. Text selection pairs `azure-soft` with this navy.

### Secondary
- **Seal Gold** (#F2B705): the accent button (with ink text, never white), the "ongoing" ribbon, the gold "expected by now" tick on roundels and bars, today on the calendar, the pending-count badge. Gold Deep (#CB8F00) marks "behind schedule" on the arc and bar.

### Tertiary
- **Ribbon Red** (#D52826): cancelled ribbon, overdue arc and bar, danger button, Sundays on the calendar (as the 700 step).
- **Bamboo Green** (#538A1B): completed ribbon, completed arc and bar, healthy "nothing is overdue" state.

### Neutral
- **Ink** (#0A0C10): the roundel ring, gold-button text, the outline of the status stacked bar, the ring around today and the expected tick.
- **Ground** (#F4F7FC): page background everywhere. Neutrals are tinted toward the azure so no grey looks off-palette.
- **Track** (#E9EEF7) and **Hairline** (#D8E0EE): empty progress track, card borders, dividers (as slate-100 and 200).
- **Slate text steps** (#334055 body labels, #222D40 body text, #141C2C headings, #627290 muted at 4.5:1 or better on white).

### Named Rules
**The Seal-Only Rule.** Hues come from the seal. A new colour is justified only if the seal has it; semantic states reuse azure, gold, red, green.

**The Gold-On-Ink Rule.** Gold is always paired with ink text. White on gold is unreadable and is not used.

**The Meaning Colour Rule.** Saturated colour appears only where it encodes progress, status, schedule, or the one primary action on a screen. Everything else is navy, white or slate.

## Typography

**Display Font:** Barlow Condensed (with Barlow, ui-sans-serif fallback), weights 600 and 700, self-hosted.
**Body Font:** Barlow (with ui-sans-serif, system-ui), weights 400 to 700, self-hosted.

**Character:** The seal's lettering for names and headings, an open humanist sans for reading. The condensed face is always bold and uppercase with slight tracking (0.025em); it never sets running text.

### Hierarchy
- **Display** (700, 3rem to 3.75rem, 0.95): public hero title and the auth panel name, white on navy.
- **Headline** (700, 2.25rem, 1, uppercase): page title in `PageHeader`, dashboard and project detail titles.
- **Title** (700, 1.5rem to 1.875rem, uppercase): panel headings, section heads, modal titles.
- **Item title** (Barlow 700, 1.125rem, 1.375): project and news titles inside cards and lists.
- **Body** (400, 1rem, 1.5; cap line length near 65ch with `max-w-2xl` descriptions): paragraph text in slate-600 to 800.
- **Label** (600, 0.875rem): table headings, links, field labels, ribbons; ribbon text is condensed uppercase at 13px.
- **Figure** (Barlow Condensed 700, 1.25rem to 1.5rem): budget, spent and counts; the number inside the roundel and calendar day numerals. Tables use tabular figures.

### Named Rules
**The Seal Lettering Rule.** Headings, names, figures and ribbon labels use the condensed face in bold capitals (`seal-type`: bold, uppercase, tracking-wide). Sentences never do.

**The One Face Per Job Rule.** Condensed carries identity and numbers; Barlow carries explanation. Do not mix them inside one line of prose.

## Layout

Admin: a fixed 256px navy rail (drawer on phones under 1024px), a 68px white top bar, and a content column capped at `max-w-7xl` with 16/24/32px padding by breakpoint. Public: a 68px sticky white header and `max-w-6xl` content, hamburger menu below 768px. Auth: a 5:7 split on wide screens, a compact navy band above the form on phones.

Spacing follows Tailwind's 4px steps: 24px between panels, 20-24px inside cards, 16px between a roundel and its text, 12px between list rows. Dashboards use a 3-column grid (2/3 plus 1/3) that collapses to one column; tables become stacked rows under 768px. Pages open with `PageHeader`: condensed title left, actions right, wrapping.

## Elevation & Depth

Flat and hairline by default. Cards sit on the ground with a 1px border and an almost invisible shadow; depth is conveyed by the white-on-pale-ground step and the navy rail. Shadows appear on hover and on overlays only.

### Shadow Vocabulary
- **Card rest** (`box-shadow: 0 1px 2px rgba(10,27,68,0.06), 0 1px 1px rgba(10,27,68,0.04)`): every card.
- **Lifted** (`box-shadow: 0 14px 30px -10px rgba(10,27,68,0.22), 0 4px 10px -4px rgba(10,27,68,0.10)`): card hover, dropdown menus, modals, the hero panel and seal image, the phone drawer.

### Named Rules
**The Navy Shadow Rule.** Shadows are tinted with the navy (rgba 10,27,68), soft and offset downward. No hard offset shadows.

## Shapes

Soft but not bubbly: buttons, inputs, nav items, tiles at 8px; cards and panels at 12px; modals and the hero panel at 16px; pills, progress bars and badges fully round. The roundel is a circle with a 5-unit ink ring; the status ribbon is a rectangle with a swallowtail notch on both ends (7px deep, cut with a polygon clip). The roundel and ribbon are the only two signature silhouettes. Borders are 1px hairline (slate-200, inputs slate-300); the progress track carries an inset hairline ring.

## Components

### Buttons
- **Shape:** 8px radius, semibold, 150ms colour transition, 50% opacity when disabled. Sizes: sm 12/6px, md 16/8px (15px text), lg 20/10px.
- **Primary:** Action Azure fill, white text; hover and active darken one and two steps. Used for the main action on pages where the chairman decides (Review approvals, Mark as completed).
- **Accent:** Seal Gold fill, ink text; the main creation action for admins (Add Project, Register, View Projects on the hero).
- **Secondary / Ghost / Danger:** white with slate-300 border; text-only slate with a slate-100 hover; Ribbon Red with white text.
- **Focus:** one global ring, 2px Seal Azure outline with 2px offset.

### Cards / Containers
- **Corner Style:** 12px. White, 1px slate-200 border, Card rest shadow. Panels pad 20px (24px from 640px). Hover lift only where the whole card is a link.
- **Dividers:** slate-100 rules between list rows and card sections; no nested cards.

### Inputs / Fields
- White, 1px slate-300 border, 8px radius, 12/8px padding, slate-400 placeholder. Focus swaps the border to Seal Azure and adds a 2px azure-200 ring. Labels sit above in semibold slate-700. Errors are red-600 text below the field.

### Navigation
- **Admin rail:** navy, grouped under small uppercase azure-300 group labels (Work, Records). Items are 15px semibold, 8px radius, icon plus label; inactive text azure-100 with a white/10 hover, active item is a solid white pill with navy text. The Approvals item carries a gold count badge with ink text. Seal image and "SK Salinas 1" in condensed capitals head the rail.
- **Public bar:** white, items with a 3px bottom border; active is Action Azure with an azure underline. Footer is navy.
- Icons are Lucide at 1.75 stroke; sizes 16-19px.

### ProgressRoundel (signature)
The seal's ring as a progress gauge: white disc inside a 5-unit ink ring, two ink separator dots at 9 and 3 o'clock, an 11-unit track (#E9EEF7) with an arc starting at 12 o'clock, and the percentage in condensed bold ink at the centre (the % sign is dropped under 64px). Arc colour encodes schedule: azure on track, gold-deep behind, red overdue, green completed. A gold tick with ink outline marks where the project should be by now. Sizes: sm 52px (lists), md 80px (cards), lg 132px (project detail header). It always has an `aria-label` that states the percentage, the schedule and the expected value; `ScheduleWords` writes the same schedule in words beside it, with a coloured dot.

### StatusRibbon (signature)
Swallowtail banner, condensed bold capitals at 13px, 16px side padding. Fill by status: Proposed slate-600 (white text), Planning Action Azure (white), Ongoing gold (ink), Completed green-600 (white), Cancelled red-600 (white). The Projects-by-status stacked bar and its legend use the same fills, in a pill with an ink hairline ring.

### Progress bar
2.5-unit rounded track with inset hairline; fill colour follows the roundel's schedule colours; a 5x18px gold tick with ink ring marks the expected position. Percentage is in condensed bold above the right end.

### Badge, DateTile, Calendar, Overflow menu
- **Badge:** full pill, 13px semibold, tinted wash with the matching 700 text (slate, green, gold, red, azure).
- **DateTile:** 56px navy 8px-radius leaf: day numeral in condensed 24px, month in azure-200 uppercase 11px.
- **MonthCalendar:** 7-column grid of bordered 8px cells; condensed day numerals, Sundays in red-700, today as a gold disc ringed in ink, selected day an azure-50 cell with azure border; events as azure-100 chips with a line icon (people, landmark, party popper, pin).
- **OverflowMenu:** a secondary icon button opening a white 12px-radius menu with Lifted shadow; risky actions (cancel, delete) live here in red-700, not beside the primary actions.
- **EmptyState:** dashed slate-300 border, 12px radius, azure-50 circular icon, title and a next-step line.

### Documented exception: paper forms
`ProjectProposalForm` and `Letterhead` deliberately imitate the SK's printed Purchase Request sheet: black-bordered table, centred bold cells, serif letterhead with the red CITY OF BACOOR line. They are a user-approved exception tied to the product's binding reference, and are not part of this system. Do not copy their borders, serif or print layout into app screens, and do not restyle them to match.

## Do's and Don'ts

### Do:
- **Do** express progress as a ProgressRoundel (lists, cards, headers) or ProgressBar (dense tables), and status as a StatusRibbon.
- **Do** give every project a gold "expected by now" tick when dates allow, and state the schedule in words beside colour.
- **Do** use gold buttons with ink text for the one creation action, azure for decision actions.
- **Do** set headings, figures and names in Barlow Condensed bold capitals (`seal-type`); set sentences in Barlow.
- **Do** use the azure-tinted slate neutrals; keep the white card on `#F4F7FC` ground with a hairline border.
- **Do** use Lucide line icons at 1.75 stroke, with a text label or `aria-label`.
- **Do** keep risky actions in the overflow menu, and give each page a `PageHeader`.

### Don't:
- **Don't** put white text on gold, or gold text smaller than 18px on white (use gold-text #8A5A00).
- **Don't** use colour alone to carry status; ribbon words, schedule words and aria-labels accompany it.
- **Don't** introduce hues the seal does not have, or neutral greys that are not the azure-tinted slate.
- **Don't** set condensed capitals in running text or below 11px.
- **Don't** use hard offset shadows, nested cards, or side-stripe borders.
- **Don't** extend the paper-form look (black borders, serif) outside the proposal form and letterhead.

## Update: project cards use the progress bar

Project cards (admin list and public grid) show the status ribbon and title on the left, the official progress as a large Barlow Condensed number on the right, and the slim progress bar beneath, coloured by schedule (azure on track, gold behind, red overdue, green completed) with the gold expected-by-now tick, followed by one muted line with the start and end date and time. The ProgressRoundel stays on the project detail header, the public home "Happening now" panel and the dashboard "Needs attention" list.
