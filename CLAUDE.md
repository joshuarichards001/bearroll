# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A data collector that scrapes the [Bear Blog Discover page](https://bearblog.dev/discover/) daily, extracts post metadata (title, author, upvotes/toasts, published date), and stores it as dated JSON files committed to the repo. No frontend, no database — just a scraper and JSON files in git.

## Commands

- **Install dependencies:** `npm ci`
- **Run the collector:** `npm run collect` (or `node scripts/collect.mjs`)

There are no tests, linter, or build step.

## Architecture

- `scripts/collect.mjs` — Single ESM script that fetches discover pages 0-4, parses HTML with Cheerio, and merges results into `data/YYYY-MM-DD.json` files.
- `data/` — One JSON file per day, keyed by posts' **published** date (not scrape date). Each file has `collected_at` and a `posts` array.
- `.github/workflows/collect.yml` — Runs the collector daily at midnight UTC via cron, commits changed data files.

## Key Design Decisions

- **Post deduplication:** URL is the unique key. A post belongs to exactly one day file based on its `published` date. Toast counts only increase (higher value always wins). `last_updated` is always refreshed when a post is re-seen.
- **Published date source:** Extracted from the `title` attribute on the `<small>` element (ISO 8601), NOT from the relative time text.
- **Scraping etiquette:** 1.5s delay between page requests, custom User-Agent header, max 5 pages per run.
- **Fail-loud on page 0:** If zero posts are found on page 0, the script exits non-zero (HTML structure may have changed). Later pages with fewer/zero posts are tolerated.

## Data Schema

See `DATA_COLLECTOR_SPEC.md` for the full specification including post schema, merge logic, HTML selectors, and edge cases. This is the authoritative reference for how the collector should behave.
