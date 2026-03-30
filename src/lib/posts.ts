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
