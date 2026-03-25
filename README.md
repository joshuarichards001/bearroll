# Bear Roll

A daily archive of [Bear Blog's discover page](https://bearblog.dev/discover/).
Every day at midnight UTC, a script captures the top 100 posts and stores them
as dated JSON files. The result is a browsable, chronological record of what the
Bear Blog community has been reading and toasting.

Live at [bearroll.dev](https://bearroll.dev).

## How it works

**Collector** — A Node script (`scripts/collect.mjs`) scrapes the first 5 pages
of Bear Blog's discover feed using Cheerio and writes `data/YYYY-MM-DD.json`
files. A GitHub Actions cron job runs this daily.

**Frontend** — A static [Astro](https://astro.build) site reads those JSON files
at build time. The first 6 days are server-rendered; older days load on scroll
via pre-built HTML fragment endpoints. Posts are ranked by toast count with top
10/20/all filter options. Styled with Tailwind v4, light and dark mode.

## Development

```sh
npm install       # install dependencies
npm run dev       # start dev server
npm run build     # build static site to dist/
npm run preview   # preview the build
```

## License

MIT
