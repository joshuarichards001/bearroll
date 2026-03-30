import { load } from "cheerio";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DATA_DIR = join(fileURLToPath(import.meta.url), "..", "..", "data");
const BASE_URL = "https://bearblog.dev/discover/";
const USER_AGENT = "BearRoll/1.0 (+https://bearroll.dev)";
const PAGE_COUNT = 5;
const DELAY_MS = 1000;

interface Post {
  url: string;
  title: string;
  author: string;
  toasts: number;
  published: string;
}

interface StoredPost {
  url: string;
  title: string;
  author: string;
  toasts: number;
  first_seen: string;
  last_updated: string;
  published: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dateKey(isoString: string): string {
  return isoString.slice(0, 10);
}

async function fetchPage(page: number): Promise<string> {
  const url = `${BASE_URL}?page=${page}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

function parsePosts(html: string): Post[] {
  const $ = load(html);
  const posts: Post[] = [];

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

    if (!url || !title || !published) {
      console.error(
        `Skipping post: missing ${[!url && "url", !title && "title", !published && "published"].filter(Boolean).join(", ")}`,
      );
      return;
    }

    posts.push({ url, title, author: author || "", toasts, published });
  });

  return posts;
}

async function loadDayFile(filePath: string): Promise<StoredPost[] | null> {
  if (!existsSync(filePath)) return null;
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as StoredPost[];
}

interface DayFileEntry {
  data: StoredPost[];
  modified: boolean;
}

async function main(): Promise<void> {
  const now = new Date().toISOString();

  // Scrape all pages
  const allPosts: Post[] = [];
  for (let page = 0; page < PAGE_COUNT; page++) {
    if (page > 0) await sleep(DELAY_MS);
    console.log(`Fetching page ${page}...`);
    const html = await fetchPage(page);
    const posts = parsePosts(html);
    console.log(`  Found ${posts.length} posts on page ${page}`);

    if (page === 0 && posts.length === 0) {
      console.error(
        "ERROR: Found zero posts on page 0. HTML structure may have changed.",
      );
      process.exit(1);
    }

    allPosts.push(...posts);
  }

  console.log(
    `Total scraped: ${allPosts.length} posts across ${PAGE_COUNT} pages`,
  );

  // Ensure data directory exists
  await mkdir(DATA_DIR, { recursive: true });

  // Cache of loaded day files: dateKey -> { data, modified }
  const dayFiles = new Map<string, DayFileEntry>();

  async function getDayFile(key: string): Promise<DayFileEntry> {
    if (dayFiles.has(key)) return dayFiles.get(key)!;
    const filePath = join(DATA_DIR, `${key}.json`);
    const loaded = await loadDayFile(filePath);
    const entry: DayFileEntry = {
      data: loaded || [],
      modified: false,
    };
    dayFiles.set(key, entry);
    return entry;
  }

  let newCount = 0;
  let updatedCount = 0;

  for (const post of allPosts) {
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
    `Scraped ${allPosts.length} posts across ${PAGE_COUNT} pages, ` +
      `${newCount} new, ${updatedCount} updated, wrote ${filesWritten} day files`,
  );
}

main().catch((err) => {
  console.error("Collection failed:", err);
  process.exit(1);
});
