import fs from "node:fs";
import path from "node:path";

export interface Post {
  url: string;
  title: string;
  author: string;
  toasts: number;
  first_seen: string;
  last_updated: string;
  published: string;
}

export interface RankedPost extends Post {
  rank: number;
  domain: string;
}

export interface DayGroup {
  date: string;
  posts: RankedPost[];
}

/** Extract the hostname from an author URL, falling back to the raw string. */
function extractDomain(authorUrl: string): string {
  try {
    return new URL(authorUrl).hostname;
  } catch {
    return authorUrl;
  }
}

/** Rank posts by toasts and sort by published date for display. */
export function processDay(posts: Post[]): RankedPost[] {
  return [...posts]
    .sort((a, b) => b.toasts - a.toasts)
    .map((p, i) => ({ ...p, rank: i + 1, domain: extractDomain(p.author) }))
    .sort(
      (a, b) =>
        new Date(b.published).getTime() - new Date(a.published).getTime(),
    );
}

/** Returns all available day dates in reverse chronological order. */
export function getAllDayDates(): string[] {
  const dataDir = path.resolve(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) return [];

  return fs
    .readdirSync(dataDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""))
    .sort()
    .reverse();
}

/** Load and process a single day file. Returns null if not found or empty. */
export function loadDay(date: string): DayGroup | null {
  const filePath = path.resolve(process.cwd(), "data", `${date}.json`);
  if (!fs.existsSync(filePath)) return null;

  let posts: Post[];
  try {
    posts = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
  if (!Array.isArray(posts) || posts.length === 0) return null;

  return { date, posts: processDay(posts) };
}

const INITIAL_DAYS = 4;

/** Load the first N days for the initial page render. */
export function loadInitialDays(): DayGroup[] {
  const dates = getAllDayDates();
  const days: DayGroup[] = [];
  for (const date of dates.slice(0, INITIAL_DAYS)) {
    const day = loadDay(date);
    if (day) days.push(day);
  }
  return days;
}

/** Get the dates of days not included in the initial render. */
export function getRemainingDayDates(): string[] {
  return getAllDayDates().slice(INITIAL_DAYS);
}

const WEEK_DAYS = 7;
const TOP_PER_WEEK = 30;
const MAX_WEEKS = 12;

/** The Sun–Sat date strings for the week starting at the given Sunday. */
function weekDates(sunday: string): string[] {
  const start = new Date(sunday + "T00:00:00Z");
  return Array.from({ length: WEEK_DAYS }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/**
 * Sunday start-dates of completed weeks whose feed item has published, newest
 * first. A week (Sun–Sat) publishes the following Sunday at 6am UTC, so the
 * just-ended week is held back until then.
 */
export function getWeekStarts(): string[] {
  const now = new Date();
  // Sunday 00:00 UTC of the current, in-progress week.
  const sunday = new Date(now);
  sunday.setUTCHours(0, 0, 0, 0);
  sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay());

  // Most recent completed week starts the previous Sunday; if its publish time
  // (this Sunday 6am UTC) hasn't passed, fall back another week.
  const publish = new Date(sunday);
  publish.setUTCHours(6, 0, 0, 0);
  const weekStart = new Date(sunday);
  weekStart.setUTCDate(weekStart.getUTCDate() - (now < publish ? 14 : 7));

  const weeks: string[] = [];
  for (let i = 0; i < MAX_WEEKS; i++) {
    weeks.push(weekStart.toISOString().slice(0, 10));
    weekStart.setUTCDate(weekStart.getUTCDate() - WEEK_DAYS);
  }
  return weeks;
}

/** Top posts across one Sun–Sat week, deduped by URL and ranked by toasts. */
export function loadWeek(sunday: string): RankedPost[] {
  const byUrl = new Map<string, RankedPost>();
  for (const date of weekDates(sunday)) {
    const day = loadDay(date);
    if (!day) continue;
    for (const post of day.posts) {
      const existing = byUrl.get(post.url);
      if (!existing || post.toasts > existing.toasts) byUrl.set(post.url, post);
    }
  }
  return [...byUrl.values()]
    .sort((a, b) => b.toasts - a.toasts)
    .slice(0, TOP_PER_WEEK)
    .map((post, i) => ({ ...post, rank: i + 1 }));
}

/** Get the ISO timestamp of the most recent data collection. */
export function getLastCollectedAt(): string | null {
  const dates = getAllDayDates();
  if (dates.length === 0) return null;

  const filePath = path.resolve(process.cwd(), "data", `${dates[0]}.json`);
  try {
    const posts: Post[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (!Array.isArray(posts) || posts.length === 0) return null;

    // Find the most recent last_updated timestamp across all posts
    let latest = "";
    for (const post of posts) {
      if (post.last_updated > latest) latest = post.last_updated;
    }
    return latest || null;
  } catch {
    return null;
  }
}
