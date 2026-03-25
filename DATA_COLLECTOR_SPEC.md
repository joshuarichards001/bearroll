# Bear Blog Discover — Data Collector Specification

## Overview

A Node.js script and GitHub Action that scrapes the [Bear Blog Discover page](https://bearblog.dev/discover/) daily, extracts post metadata including upvote ("toast") counts, and stores the data as JSON files committed to the repository.

---

## Architecture

```
GitHub Repository
├── data/                    # Collected post data
│   └── YYYY-MM-DD.json     # One file per day (flat directory)
├── scripts/
│   └── collect.mjs          # Data collection script
├── .github/workflows/
│   └── collect.yml          # Scheduled GitHub Action
└── package.json
```

### Why JSON files in the repo

- Zero-cost infrastructure — no database, no server.
- Git provides built-in version history and persistence.
- Simple to inspect, debug, and manually fix if needed.

---

## Data Collection Script (`scripts/collect.mjs`)

### What it does

1. Fetches the Bear Blog discover page HTML from pages 0 through 4.
2. Parses out each post's data (see schema below).
3. For each scraped post, determines which day file it belongs to based on its `published` date.
4. Loads the relevant day files from `data/`.
5. Deduplicates and merges (see detailed logic below).
6. Writes back any changed day files.

### Post schema

Each post object in a day file has this shape:

```json
{
  "url": "https://example.bearblog.dev/post-slug/",
  "title": "Post Title",
  "author": "https://example.bearblog.dev",
  "toasts": 83,
  "first_seen": "2026-03-22T14:00:00Z",
  "last_updated": "2026-03-25T14:00:00Z",
  "published": "2026-03-22T12:00:00Z"
}
```

Notes on the schema:
- `url` is the full URL to the individual blog post. This is the unique key.
- `author` is the Bear Blog URL for the author's blog (e.g., `https://example.bearblog.dev`). This doubles as both the author identifier and their link.
- `published` is an ISO 8601 datetime. The discover page provides this as a `title` attribute on the `<small>` element that shows the relative time (e.g., `title="2026-03-23T15:29Z"`). Use this directly — do not parse the relative time text.
- `first_seen` is when the collector first encountered the post on the discover page.
- `last_updated` is the most recent time the collector updated this post's data.
- `toasts` is the upvote count at the time of the most recent scrape where this post was visible.

### Daily data file schema (`data/YYYY-MM-DD.json`)

```json
{
  "collected_at": "2026-03-25T00:00:00Z",
  "posts": [
    { /* post objects as above */ }
  ]
}
```

The `collected_at` timestamp is updated to the current run time whenever the file is written. The filename date corresponds to the `published` date of the posts in that file, NOT the date the scrape ran.

### Deduplication and merge logic (IMPORTANT)

A post belongs to exactly **one** day file, determined by its `published` date. The post's URL is the unique key within that day file. The collector enforces this invariant on every run.

Here is the exact logic the collector must follow for each scraped post:

```
for each post scraped from the discover page:

  1. Determine the target day file from the post's `published` date.
     → e.g., published "2026-03-22T12:00:00Z" → file is `data/2026-03-22.json`

  2. Load the target day file (if it exists). Cache loaded files in memory
     so each file is only read from disk once per run.

  3. Look up the post by URL in that day file's posts array.

  4. If the post does NOT exist in the file:
     → Insert it with `first_seen` and `last_updated` set to now.

  5. If the post DOES exist in the file:
     → If scraped toasts > existing toasts:
         Update `toasts` to the new (higher) value.
         Update `last_updated` to now.
     → If scraped toasts <= existing toasts:
         Do nothing. Keep the higher value. Still update `last_updated`.
     → Update `title` in case it changed (rare but possible).

  6. After processing ALL scraped posts, write back only the day files
     that were actually modified.
```

**Example walkthrough:**

- Sunday: "How I use Obsidian" is published. It doesn't appear on discover yet.
- Monday scrape: Post appears on discover with 60 toasts.
  → Collector sees `published: Sunday`. Opens `data/2026-03-22.json`.
  → Post URL not found. Inserts it with `toasts: 60`.
- Tuesday scrape: Same post still on discover, now with 80 toasts.
  → Collector sees `published: Sunday`. Opens `data/2026-03-22.json`.
  → Finds existing entry by URL. `80 > 60`, so updates `toasts` to 80.
- Wednesday scrape: Post no longer on discover pages 0-4.
  → Collector doesn't see it. No action. The entry stays in Sunday's file with 80 toasts.

**Result:** The post appears exactly once, in Sunday's day file, with 80 toasts.

### Scraping multiple pages

The collector scrapes discover pages 0 through 4 on each run to capture posts that have fallen off page 0 but are still trending. The URLs are:

- `https://bearblog.dev/discover/?page=0`
- `https://bearblog.dev/discover/?page=1`
- `https://bearblog.dev/discover/?page=2`
- `https://bearblog.dev/discover/?page=3`
- `https://bearblog.dev/discover/?page=4`

Do not crawl beyond page 4.

### Score tracking window

Because the collector scrapes pages 0-4 once daily (20 posts per page, 100 posts total), posts naturally get their scores updated for as long as they remain in the top 100 posts on discover. No separate "tracking list" is needed — the deduplication logic handles it. If a post falls off the top 100, its last known score is preserved in its day file.

### Running the script

```bash
node scripts/collect.mjs
```

The script should:
- Use only Node.js built-in `fetch` (Node 18+) and a lightweight HTML parser (e.g., `cheerio`).
- Exit with code 0 on success, non-zero on failure.
- Log what it did to stdout (e.g., "Scraped 100 posts across 5 pages, 15 new, 40 updated, wrote 6 day files").

---

## GitHub Action (`.github/workflows/collect.yml`)

### Schedule

Runs **once daily** at midnight GMT via cron: `0 0 * * *`. Also supports manual trigger (`workflow_dispatch`).

### Steps

1. Checkout repository.
2. Setup Node.js 20.
3. Install dependencies (`npm ci`).
4. Run `node scripts/collect.mjs`.
5. Commit and push any changed files in `data/` with message `chore: collect discover data YYYY-MM-DD`.

### Important details

- Use a bot or `GITHUB_TOKEN` for the commit.
- Only commit if there are actual changes (`git diff --quiet || git commit ...`).
- Set `git config user.name` and `user.email` for the bot commits.

---

## Discover Page HTML Structure (exact selectors)

Each discover page contains exactly **20 posts**. 5 pages × 20 posts = **100 posts per run**.

The post list is a `<ul class="discover-posts">` containing `<li>` elements. Here is the exact structure of a single post `<li>`:

```html
<li>
    <span>
        #81                          <!-- rank number (ignore) -->
    </span>
    <div>
        <a href="https://lesflamingos-en.bearblog.dev/poppies/">
            poppies                  <!-- POST TITLE -->
        </a>
        <small>
            <span>(<a href="https://lesflamingos-en.bearblog.dev">https://lesflamingos-en.bearblog.dev</a>)</span>
                                     <!-- AUTHOR URL (the href of the <a> inside this <span>) -->
            <br>
            <small title="2026-03-23T15:29Z">Published 2 days, 3 hours ago</small>
                                     <!-- PUBLISHED DATETIME is in the `title` attribute -->

            <small><!-- hide button, ignore --></small>

            <small>
                <svg>...</svg>       <!-- upvote icon, ignore -->
                12                   <!-- TOAST COUNT -->
            </small>
        </small>
    </div>
</li>
```

### How to extract each field

Using Cheerio selectors on each `li` within `ul.discover-posts`:

| Field | How to extract |
|---|---|
| `url` | `li > div > a` — the `href` attribute of the first `<a>` inside the `<div>` |
| `title` | `li > div > a` — the text content of that same `<a>`, trimmed |
| `author` | `li > div > small > span > a` — the `href` attribute of the `<a>` inside the first `<span>` inside `<small>` |
| `published` | `li > div > small > small[title]` — the `title` attribute of the first `<small>` that has a `title` attribute. This is an ISO 8601 datetime string (e.g., `2026-03-23T15:29Z`). **Use this directly — do NOT parse the relative time text.** |
| `toasts` | The last `<small>` inside the `<small>` chain contains the SVG icon followed by the toast count as text. Extract the text content of the `<small>` that contains the `<svg>`, trim it, and parse as integer. |

### Critical: Use the `title` attribute for published time

The relative time text ("Published 2 days, 3 hours ago") is unreliable and hard to parse. The `<small>` element has a `title` attribute containing the exact ISO 8601 datetime (e.g., `title="2026-03-23T15:29Z"`). **Always use this `title` attribute** as the `published` value. This eliminates all relative time parsing edge cases.

### Pagination

Pages are fetched via query parameter: `?page=0` through `?page=4`. The page contains pagination links at the bottom:

```html
<a href="?page=3">&laquo; Previous</a> |
<a href="?page=5">Next &raquo;</a>
```

The collector does not need to follow these links — it fetches pages 0-4 directly by constructing the URLs.

### Scraping considerations

- Be respectful: 5 page fetches per run (pages 0-4), once daily at midnight GMT. Add a small delay (1-2 seconds) between page requests.
- Set a descriptive User-Agent header: `BearBlogDiscover/1.0 (+https://your-site-url)`.
- If Bear Blog starts returning errors or blocking, fail gracefully and skip the run.
- The HTML structure may change. The scraper should fail loudly (exit non-zero) if it finds zero posts on page 0, rather than silently writing empty data. If later pages return fewer than 20 posts or zero posts, that's acceptable — just process what's there.

---

## Dependencies

```json
{
  "scripts": {
    "collect": "node scripts/collect.mjs"
  },
  "dependencies": {
    "cheerio": "latest"
  }
}
```

Keep dependencies minimal. Only `cheerio` is needed for HTML parsing. `fetch` is built into Node 18+.

---

## Edge Cases and Error Handling

- **First run / empty data directory**: The script should create `data/` if it doesn't exist and write new day files as needed.
- **Duplicate posts across pages**: The same post may appear on multiple discover pages in a single run. The in-memory dedup handles this — process all pages, then write once per day file.
- **Score decreases**: If a re-scraped post's toast count is lower than previously recorded (unlikely but possible), keep the higher value.
- **Network failures**: Log the error and exit non-zero. The GitHub Action should not commit if the script fails.
- **Fewer than 20 posts on a page**: Later pages may have fewer posts. Process what's there. Only fail if page 0 returns zero posts.
- **HTML structure changes**: If the expected selectors (`ul.discover-posts`, `li`, etc.) return no results on page 0, exit non-zero. Do not write empty data.

---

## Out of Scope

- Any frontend or static site generation — this spec covers only data collection.
- Scraping post content/body text (only metadata).
- Any server-side runtime beyond the GitHub Action.
- Database storage — data is JSON files only.