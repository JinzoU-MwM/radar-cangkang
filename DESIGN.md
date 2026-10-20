---
name: Radar Backdoor
description: Jadwal aksi korporasi untuk memburu saham cangkang BEI, dibaca berulang sepanjang jam bursa.
colors:
  paper: "#eef1ec"
  sheet: "#ffffff"
  sheet-2: "#f6f8f5"
  zebra: "#f8faf8"
  ink: "#16241d"
  ink-2: "#4f6157"
  rule: "#c9d4cb"
  rule-2: "#e3e9e4"
  rail: "#0f3b2e"
  rail-2: "#145240"
  rail-ink: "#e4eee8"
  rail-mute: "#9dbfae"
  rail-rule: "#1d5a47"
  accent: "#0f3b2e"
  accent-ink: "#ffffff"
  accent-soft: "#e1ebe4"
  now: "#e8590c"
  now-ink: "#b8440a"
  now-bg: "#fdeee4"
  strong: "#b42318"
  strong-bg: "#fbe9e7"
  warn: "#8f5b00"
  warn-bg: "#fbf0d9"
  calm: "#4f6157"
  calm-bg: "#e4ebe6"
  good: "#17734f"
  good-bg: "#def0e6"
  dark-paper: "#0c1712"
  dark-sheet: "#12221b"
  dark-sheet-2: "#162a21"
  dark-zebra: "#10201a"
  dark-ink: "#e3ece6"
  dark-ink-2: "#a3b7ab"
  dark-rule: "#2b4136"
  dark-rule-2: "#1f3229"
  dark-rail: "#07110d"
  dark-rail-2: "#11291f"
  dark-rail-mute: "#8fae9e"
  dark-rail-rule: "#1b3328"
  dark-accent: "#7fd1aa"
  dark-accent-ink: "#06120d"
  dark-accent-soft: "#183528"
  dark-now: "#ff8a4c"
  dark-now-ink: "#ffa877"
  dark-now-bg: "#3a2216"
  dark-strong: "#ff8f84"
  dark-strong-bg: "#3d1d1a"
  dark-warn: "#f0bf5e"
  dark-warn-bg: "#352a12"
  dark-calm-bg: "#1d3028"
  dark-good: "#6fd6a5"
  dark-good-bg: "#13342a"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "0"
  stat:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    letterSpacing: "0.04em"
  ticker:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.02em"
  title:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "15.5px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Barlow, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  label:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "12.5px"
    fontWeight: 600
    letterSpacing: "0.06em"
  caption:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.45
rounded:
  tag: "2px"
  control: "3px"
  dialog: "4px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  gutter: "18px"
  content-x: "28px"
components:
  button:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  button-primary-hover:
    backgroundColor: "{colors.rail-2}"
    textColor: "{colors.accent-ink}"
  filter-pill:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  filter-pill-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
  nav-item:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.rail-ink}"
    padding: "10px 18px"
  nav-item-current:
    backgroundColor: "{colors.rail-2}"
    textColor: "{colors.accent-ink}"
  stage-cell-done:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.tag}"
    height: "20px"
  stage-cell-now:
    backgroundColor: "{colors.now-bg}"
    textColor: "{colors.now-ink}"
    rounded: "{rounded.tag}"
    height: "20px"
  stage-cell-plan:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.tag}"
    height: "20px"
  status-pill-done:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.tag}"
    padding: "1px 8px"
  status-pill-process:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tag}"
    padding: "1px 8px"
  ticker-tag:
    textColor: "{colors.ink}"
    typography: "{typography.ticker}"
    rounded: "{rounded.tag}"
    padding: "0 6px"
  table-header:
    backgroundColor: "{colors.sheet-2}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    padding: "9px 12px"
  field:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "7px 10px"
  agenda-panel:
    backgroundColor: "{colors.sheet}"
    padding: "12px 14px"
---

# Design System: Radar Backdoor

## Overview

**Creative North Star: "Jadwal Aksi Korporasi"**

Every backdoor candidate is read as a corporate-action timetable: stages and dates sit in tabular columns, and a single orange "hari ini" line cuts through all of them. The surface is a working ledger for a small team watching the screen all trading session, so density is unapologetic: a bottle-green rail on the left, green-grey paper behind, white sheets holding tables with ruled rows, and condensed headings that give the ticker codes the weight of a timetable entry.

Depth comes from rules and ink, not from floating cards. Sections are separated by a 2px ink rule on top or bottom; tables and panels are flat white sheets with a 1px rule border. Facts (reports, dates, prices) and judgement (scores, signals) are visually separated: judgement lives in tinted panels and coloured pills, facts in plain ruled rows.

The light theme is the default (office laptop during market hours); the dark theme is a full token swap under `:root[data-theme="dark"]`, toggled from the rail and persisted in `localStorage`. The visual world rejects the white-and-blue carded fintech dashboard and oversized empty page titles.

**Key Characteristics:**
- Bottle-green rail (216px) + green-grey paper + white ruled sheets.
- Orange is a time signal only: today, new, next stage.
- Barlow Condensed for headings, tickers, table headers; Barlow with tabular numerals for everything else.
- 2-3px corners, 1px rules, 2px ink section rules, no nested cards.
- Same horizontal scale on every row (stage strip, Jadwal timeline) so rows compare at a glance.

## Colors

A restrained green-ink ledger palette with one hot orange reserved for time, plus muted semantic tints for judgement.

### Primary
- **Bottle Green** (`accent` = `rail`): the rail background, primary buttons, completed stage cells, "Selesai" status pill, strong scores, links. In dark mode the accent becomes **Mint Signal** (`dark-accent`), because a deep green would vanish on a dark sheet.
- **Bottle Green Lifted** (`rail-2`): current rail item, rail hover, primary-button hover.
- **Pale Leaf** (`accent-soft`): row hover, highlighted sort column, acquisition chips, the "new business" half of the Story comparison.

### Secondary
- **Hari-Ini Orange** (`now`, `now-ink`, `now-bg`): the today line in the Jadwal column, the "Hari ini" axis label, the current stage cell, the "baru" marker on fresh news, due-soon agenda dates, the active-nav indicator bar, focus outlines and text selection.

### Tertiary (semantic judgement tints)
- **Brick** (`strong` / `strong-bg`): bearish case, failed checks, UMA/volume alerts, price down, errors and the error toast.
- **Ochre** (`warn` / `warn-bg`): watchlist score band, RUPSLB/rights tags, PTW marker on the price range, "edited" flags.
- **Ledger Green** (`good` / `good-bg`): bullish case, passed checks, price up, verified notes, asset-injection facts.
- **Slate Calm** (`calm` / `calm-bg`): neutral tags, empty bar tracks, the "old business" half of the Story comparison.

### Neutral
- **Green-Grey Paper** (`paper`): page background.
- **Sheet** (`sheet`) and **Sheet Shade** (`sheet-2`): tables, panels, dialogs; `sheet-2` for table header rows, analysis asides and dialog fields. **Zebra** (`zebra`) for alternate rows and news hover.
- **Deep Ink** (`ink`): text, 2px section rules, the 1px rule under table headers, pressed filter pills, toasts.
- **Moss Ink** (`ink-2`): secondary text, captions, header labels.
- **Rule** (`rule`) for borders of sheets and controls; **Faint Rule** (`rule-2`) for row dividers inside a sheet.
- **Rail Ink / Rail Mute / Rail Rule** (`rail-ink`, `rail-mute`, `rail-rule`): text, counts and dividers on the rail.

### Named Rules
**The Orange Means Now Rule.** `now` marks only time: today, newly arrived, the next stage, and keyboard focus. It is never decoration, never a brand accent, never a category colour.

**The Judgement Wears a Tint Rule.** Scores, signals and verdicts sit on a semantic tint (`good-bg`, `warn-bg`, `strong-bg`, `calm-bg`); reported facts stay on plain sheet with ink text.

## Typography

**Display Font:** Barlow Condensed 500/600/700 (fallback Arial Narrow, sans-serif)
**Body Font:** Barlow 400/500/600/700 (fallback system-ui, -apple-system, Segoe UI, sans-serif)

**Character:** A timetable pairing. The condensed face carries titles, ticker codes and column headers like the printed headings of a schedule; Barlow carries reading text and numbers, with `font-variant-numeric: tabular-nums` set on `body` so every figure aligns in columns.

### Hierarchy
- **Display** (700, 30px, 1.05; 26px below 860px): the one-line view title in the title bar, followed inline by the date and session.
- **Stat** (700, 32px, 1): summary counters; the analysis score uses the same face at 44px.
- **Headline** (700, 19px, uppercase, 0.04em): section heads; 16px inside agenda panels.
- **Ticker** (700, 18px, 0.02em): ticker codes in table rows; 24px in Story cards, 32px as profile/analysis titles (no uppercase transform).
- **Title** (Barlow 600, 15.5px, 1.3): news headlines.
- **Body** (400, 14px, 1.45, tnum): default; secondary paragraphs 13.5px in `ink-2`, analysis prose capped at 72-80ch.
- **Label** (Condensed 600, 12.5px, uppercase, 0.06em): table headers, legends, filter-group labels, fieldset legends (13px, 0.05em).
- **Caption** (Barlow 500, 12px, `ink-2`, sentence case): value labels above KPI numbers, counts beside headings, meta under titles.

### Named Rules
**The Condensed Is For Names Rule.** Condensed type is for things you scan and point at (titles, tickers, column heads, stage abbreviations). Sentences and numbers in cells stay in Barlow.

## Layout

App shell is a two-column grid: a sticky full-height rail (216px) and a content column (padding 18px 28px 64px, views capped at 1480px, 18px gap between blocks). The rail holds the brand, four menu items with right-aligned counts, and a footer pinned to the bottom (theme toggle, keyboard hints, Stockbit token status, BEI link).

Each view opens with a one-line title bar: title + date/session on the left, actions on the right (the primary action "Perbarui dari Stockbit" sits here), closed by a 2px ink bottom rule. Below come filter pills, then a dense table (rows about 44px, cell padding 9px 12px). Explanatory copy lives in a collapsed `details` under the title bar, never in a hero.

Spacing rhythm is 4 / 8 / 12 / 16 / 18 / 28px, with 6px and 10px used inside dense rows.

Responsive behaviour:
- **≤1000px:** news rows drop the analysis column under the body.
- **≤860px:** the rail becomes a sticky top bar; menu items scroll horizontally with a 3px orange bottom indicator; rail footer hidden; content padding 14px 16px.
- **≤760px:** agenda and method blocks go single-column.
- **≤640px:** summary goes 2x2; the first table column (Emiten) becomes sticky while the table scrolls horizontally.
- **≤560-600px:** news and Story internals stack to one column.

## Elevation & Depth

Flat by default. Depth is drawn with rules: 1px `rule` borders around sheets, 1px `rule-2` between rows, 2px `ink` rules to open or close a section, 1px `ink` under table headers. Shadows appear only on things that float above the page.

### Shadow Vocabulary
- **Float** (`--shadow`: `0 1px 2px rgb(15 59 46 / .08), 0 6px 18px rgb(15 59 46 / .08)`; dark: `0 1px 2px rgb(0 0 0 / .35), 0 8px 24px rgb(0 0 0 / .3)`): toasts and chart tooltips.
- **Dialog** (`0 24px 64px rgb(7 20 15 / .3)`, backdrop `rgb(7 20 15 / .5)`): modal dialogs only.

### Named Rules
**The Ink Rule Rule.** Sections are separated by a 2px ink line, not by a shadow or a card lift. If something needs more separation, give it a heavier rule, not elevation.

## Shapes

Near-square. Tags, pills, chips, ticker tags and stage cells use 2px corners; buttons, fields, panels and Story cards use 3px; dialogs 4px. The only round shapes are the filter pills and range toggles (999px), timeline event dots, price-marker dots and the token-status dot. Analysis cards are deliberately square (0px) with a 2px ink top rule. Icons (external link, sort arrows) are SVG masks painted with `currentColor`.

## Components

### Buttons
- **Shape:** gently squared (3px).
- **Default:** sheet background, 1px `rule` border, ink text, 600 13.5px, padding 7px 12px. Hover darkens the border to ink; active fills `sheet-2`; disabled at 55% opacity with progress cursor.
- **Primary:** bottle-green fill with white text; hover lifts to `rail-2` (dark mode: pale mint `#a3e2c4`).
- **Danger:** brick text and border on sheet.

### Filter Pills
- **Style:** fully rounded, 1px `rule` border, sheet fill, 500 13px, padding 3px 10px.
- **State:** `aria-pressed="true"` inverts to ink fill with paper text. Disabled at 40%.

### Status Pills, Tags and Chips
- **Status pill:** 2px corners, 600 12px. "Selesai" = accent fill; "Proses" = sheet with an inset 1px ink outline; score bands use accent / ochre tint / slate tint.
- **Type tag** (news): 2px, 600 12px on `calm-bg`; tender/controller in `accent-soft`, RUPSLB/rights in `warn-bg`.
- **Ticker tag:** condensed 700 14px ticker in a 1px ink box; hover inverts to ink.
- **Chip:** 1px border, 2px corners, 12px, coloured per signal (acquisition, rights, UMA/volume, small-cap/low-price/cangkang).

### Cards / Containers
- **Sheets:** white, 1px `rule` border, no radius on tables; Story cards 3px with 16px padding and an ink border on hover.
- **Agenda panels:** sheet, 1px rule border plus a 2px ink top rule, padding 12px 14px; rows are a 86px date / 56px ticker / text grid.
- **Shadow strategy:** none (see Elevation).

### Inputs / Fields
- **Style:** 1px `rule` border, sheet fill (`sheet-2` inside dialogs), 3px corners, padding 7px 10px.
- **Focus:** border goes to ink, no glow; keyboard focus elsewhere is a 2px `now` outline offset 2px.

### Navigation (rail)
- Items are full-width rows, 500 14.5px, padding 10px 18px, count right-aligned in `rail-mute`.
- Hover fills `rail-2`. Current (`aria-current="page"`) fills `rail-2`, text white 600, with a 3px orange inset bar on the left edge (bottom edge on mobile).

### Tables
- Header row on `sheet-2`, condensed uppercase labels in `ink-2`, 1px ink bottom rule, sortable headers show an SVG sort mask that solidifies when active.
- Rows divided by `rule-2`, hover `accent-soft`; the Progress table zebra-stripes with `zebra` and highlights the sorted column in `accent-soft`.

### Jadwal Tahap (signature stage strip)
Five equal labelled cells (max 260px wide, 2px gap, 20px tall, condensed 600 11px uppercase). Done = accent fill; current = `now-bg` fill, `now` border, `now-ink` text, with a 2px orange "today" tick protruding past its left edge; not yet = 1px dashed `rule` outline. Same scale on every row.

### Jadwal Timeline Column (signature)
A shared time axis (−4 bulan to +2 bulan) in every row: a 1px `rule-2` baseline, a 2px `now` vertical line at today's position that runs through the whole column, past events as 9px accent dots, future events as hollow dots ringed in `now`, spans as an `accent-soft` bar with an accent inset outline. A caption below names the next milestone in `now-ink`.

### News List
Ruled list on one sheet: 92px date column | body | 240-330px analysis aside on `sheet-2`. Fresh items turn the date `now-ink` and add an uppercase "baru" marker; read items drop the headline weight to 500.

## Do's and Don'ts

### Do:
- **Do** reserve `now` for today, new, next stage and focus.
- **Do** keep every numeric column in tabular numerals and right-align numbers in tables.
- **Do** separate sections with a 2px ink rule and keep panels flat with 1px `rule` borders.
- **Do** use the same horizontal scale in every row for stage strips and the Jadwal column.
- **Do** put judgement (score, signal, verdict) on a semantic tint and keep facts on plain sheet.
- **Do** define new colours as tokens in both `:root` and `:root[data-theme="dark"]`.

### Don't:
- **Don't** use orange for categories, brand emphasis or decorative accents.
- **Don't** nest cards inside cards or lift panels with large shadows; shadows are for toasts, tooltips and dialogs only.
- **Don't** round corners beyond 4px except for the existing round pills and dots.
- **Don't** build a white-and-blue carded fintech dashboard or an oversized page title with nothing under it.
- **Don't** use unicode glyphs for icons; use SVG masks painted with `currentColor`.

## Data Visualization Grammar

Every chart in the radar uses one grammar (added 2026-10-16 after the "graphs are inconsistent" pass).

- **Meter** (`.bar`, `.pbar`, `.hbar`, `.an-bar`, gauge segments, range and timeline tracks): 6px tall, 3px rounded ends, track `--rule-2`.
- **Colour by job:** magnitude (progress, ownership, market cap, public float) = `--accent`; judgement (score, six dimensions, technical signal) = `--good` / `--warn` / `--strong`; a covered range (pre-rumour → peak, tender window) = `--range` (accent at 32% over the surface).
- **Markers:** current value / event = 10px dot with a 2px `--sheet` ring; reference level (PTW, today) = 2px × 14px tick; PTW is `--warn`, today and next event are `--now`.
- **Technical chart series** (validated with the dataviz palette checker, light and dark): `--viz-a` steel blue for primary indicators (Bollinger, RSI, MACD), `--viz-b` ochre for averages/signal (MA50, MACD signal), `--viz-c` green for Parabolic SAR up; candles and SAR down use `--good` / `--strong`. Primary lines 2px, supporting 1.5px, bands at 6% fill.
- **Signal gauge:** five discrete diverging segments (strong, strong 40%, neutral `--rule-2`, good 40%, good) with the shared dot marker.
