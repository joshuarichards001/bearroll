import { load } from "cheerio";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(import.meta.dirname, "..", "data");
const BASE_URL = "https://bearblog.dev/discover/";
const USER_AGENT = "BearRoll/1.0 (+https://bearroll.dev)";
const PAGES = [0, 1, 2, 3, 4];
const DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dateKey(isoString) {
  return isoString.slice(0, 10);
}

async function fetchPage(page) {
  const url = `${BASE_URL}?page=${page}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

function parsePosts(html) {
  const $ = load(html);
  const posts = [];

  $("ul.discover-posts li").each((_, li) => {
    const $li = $(li);
    const linkEl = $li.find("div > a").first();
    const url = linkEl.attr("href");
    const title = linkEl.text().trim();
    const author = $li.find("div > small > span > a").first().attr("href");
    const publishedEl = $li.find("div > small small[title]").first();
    const published = publishedEl.attr("title");

    // Toast count: the last <small> inside the <small> chain, containing an <svg>
    let toasts = 0;
    $li.find("div > small > small").each((_, sm) => {
      const $sm = $(sm);
      if ($sm.find("svg").length > 0) {
        const text = $sm.text().trim();
        const parsed = parseInt(text, 10);
        if (!isNaN(parsed)) {
          toasts = parsed;
        }
      }
    });

    if (url && title && published) {
      posts.push({ url, title, author: author || "", toasts, published });
    }
  });

  return posts;
}

async function loadDayFile(filePath) {
  if (!existsSync(filePath)) return null;
  const raw = await readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw);
  // Migrate from old { collected_at, posts: [...] } format to plain array
  if (!Array.isArray(parsed) && Array.isArray(parsed.posts)) {
    return parsed.posts;
  }
  return parsed;
}

async function main() {
  const now = new Date().toISOString();

  // Scrape all pages
  const allPosts = [];
  for (const page of PAGES) {
    if (page > 0) await sleep(DELAY_MS);
    console.log(`Fetching page ${page}...`);
    const html = await fetchPage(page);
    const posts = parsePosts(html);
    console.log(`  Found ${posts.length} posts on page ${page}`);

    if (page === 0 && posts.length === 0) {
      console.error("ERROR: Found zero posts on page 0. HTML structure may have changed.");
      process.exit(1);
    }

    allPosts.push(...posts);
  }

  console.log(`Total scraped: ${allPosts.length} posts across ${PAGES.length} pages`);

  // Deduplicate scraped posts by URL (keep highest toast count)
  const scrapedByUrl = new Map();
  for (const post of allPosts) {
    const existing = scrapedByUrl.get(post.url);
    if (!existing || post.toasts > existing.toasts) {
      scrapedByUrl.set(post.url, post);
    }
  }

  // Ensure data directory exists
  await mkdir(DATA_DIR, { recursive: true });

  // Cache of loaded day files: dateKey -> { data, modified }
  const dayFiles = new Map();

  async function getDayFile(key) {
    if (dayFiles.has(key)) return dayFiles.get(key);
    const filePath = join(DATA_DIR, `${key}.json`);
    const loaded = await loadDayFile(filePath);
    const entry = {
      data: loaded || [],
      modified: false,
    };
    dayFiles.set(key, entry);
    return entry;
  }

  let newCount = 0;
  let updatedCount = 0;

  for (const post of scrapedByUrl.values()) {
    const key = dateKey(post.published);
    const dayFile = await getDayFile(key);
    const postIndex = dayFile.data.findIndex((p) => p.url === post.url);

    if (postIndex === -1) {
      // New post
      dayFile.data.push({
        url: post.url,
        title: post.title,
        author: post.author,
        toasts: post.toasts,
        first_seen: now,
        last_updated: now,
        published: post.published,
      });
      dayFile.modified = true;
      newCount++;
    } else {
      // Existing post
      const existing = dayFile.data[postIndex];
      let changed = false;

      if (post.toasts > existing.toasts) {
        existing.toasts = post.toasts;
        changed = true;
      }

      if (post.title !== existing.title) {
        existing.title = post.title;
        changed = true;
      }

      if (changed) {
        existing.last_updated = now;
        dayFile.modified = true;
        updatedCount++;
      }
    }
  }

  // Write modified day files
  let filesWritten = 0;
  for (const [key, entry] of dayFiles) {
    if (!entry.modified) continue;
    const filePath = join(DATA_DIR, `${key}.json`);
    await writeFile(filePath, JSON.stringify(entry.data, null, 2) + "\n");
    filesWritten++;
  }

  console.log(
    `Scraped ${scrapedByUrl.size} unique posts across ${PAGES.length} pages, ` +
      `${newCount} new, ${updatedCount} updated, wrote ${filesWritten} day files`
  );
}

main().catch((err) => {
  console.error("Collection failed:", err);
  process.exit(1);
});
