# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

BearRoll — a regular roll of Bear Blog's discover page. Scrapes
[bearblog.dev/discover](https://bearblog.dev/discover/) hourly, stores post
metadata as dated JSON files, and serves a static Astro site at
[bearroll.dev](https://bearroll.dev) that displays the collected posts with
filtering and infinite scroll.

## Commands

- **Install dependencies:** `npm ci`
- **Run the collector:** `npm run collect` (or `node scripts/collect.mjs`)
- **Dev server:** `npm run dev`
- **Build static site:** `npm run build` (outputs to `dist/`)
- **Preview build:** `npm run preview`

- **Type check:** `npm run check-types` (runs `astro check`)
- **Format:** `npm run format` (Prettier)
- **Lint:** `npm run lint` (ESLint on `src/`, zero warnings allowed)
- **Check all:** `npm run check-all` (format + type check + lint + build)

There are no tests.

## Architecture

Two independent subsystems share the `data/` directory:

### Data Collector

- `scripts/collect.mjs` — ESM script that fetches discover pages 0-4, parses
  HTML with Cheerio, and merges results into `data/YYYY-MM-DD.json` files.
- `.github/workflows/collect.yml` — Runs the collector hourly via cron, commits
  changed data files.

### Astro Frontend (static site)

- `src/lib/posts.ts` — Reads JSON files from `data/`, ranks posts by toast
  count, extracts domains. Key exports: `loadInitialDays()` (first 6 days for
  SSG), `getRemainingDayDates()` (for client-side lazy loading),
  `getAllDayDates()`, `loadDay()`, and `processDay()`.
- `src/lib/format.ts` — Date formatting (`formatDate`) and rank-based medal
  styling (`medalClass`).
- `src/pages/index.astro` — Main page. Server-renders the first 6 days, then
  uses IntersectionObserver to lazy-load older days via the HTML API.
  Client-side filter logic and scroll loading live in an inline `<script>`
  block.
- `src/pages/api/[date].astro` — Static **HTML fragment** endpoints generated at
  build time for each day file. Returns rendered `DaySection` markup (not JSON),
  inserted into the page via `insertAdjacentHTML`.
- `src/components/DaySection.astro` — Renders a single day's post list with date
  header and filter buttons.
- `src/components/PostItem.astro` — Renders a single post item with rank, title,
  author, and toast count.
- `src/components/Header.astro` — Site header/navigation.
- `src/styles/global.css` — Tailwind v4 CSS-first config with custom theme
  colors (fg, bg, bg-alt, muted, border, border-light, accent) that adapt to
  light/dark mode via CSS custom properties.
- `src/layouts/Layout.astro` — Base HTML layout that imports the global Tailwind
  stylesheet. All styling uses Tailwind utility classes.
- `astro.config.mjs` — Static output with `@tailwindcss/vite` plugin, deployed
  to bearroll.dev via GitHub Pages.
- `.github/workflows/deploy.yml` — Builds and deploys to GitHub Pages on push to
  master.

### Data flow

Collector writes `data/*.json` → Astro reads them at build time → static site
with pre-rendered HTML fragment endpoints for infinite scroll.

## Key Design Decisions

- **Post deduplication:** URL is the unique key. A post belongs to exactly one
  day file based on its `published` date (not scrape date). Toast counts only
  increase (higher value always wins). `last_updated` is always refreshed when a
  post is re-seen.
- **Published date source:** Extracted from the `title` attribute on the
  `<small>` element (ISO 8601), NOT from the relative time text.
- **Scraping etiquette:** 1s delay between page requests, custom User-Agent
  header, max 5 pages per run.
- **Fail-loud on page 0:** If zero posts are found on page 0, the script exits
  non-zero (HTML structure may have changed). Later pages with fewer/zero posts
  are tolerated.
- **Ranking:** Posts are ranked per-day by toast count descending. The frontend
  filter buttons (top 10/20/all) use `data-rank` attributes to show/hide posts
  by toggling Tailwind's `hidden` class.
- **Styling:** All styles use Tailwind v4 utility classes (no custom CSS
  classes). Light/dark mode colors are defined as CSS custom properties in
  `src/styles/global.css` and exposed to Tailwind via `@theme`. The client-side
  JS (`renderDay`, `applyFilter`) uses Tailwind class names directly when
  creating/toggling DOM elements.
