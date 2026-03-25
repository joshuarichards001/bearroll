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

function extractDomain(authorUrl: string): string {
  try {
    return new URL(authorUrl).hostname;
  } catch {
    return authorUrl;
  }
}

export function processDay(posts: Post[]): RankedPost[] {
  // Sort by toasts descending to assign ranks
  const byToasts = [...posts].sort((a, b) => b.toasts - a.toasts);
  const rankMap = new Map<string, number>();
  byToasts.forEach((p, i) => rankMap.set(p.url, i + 1));

  // Sort by published time, newest first for display
  const sorted = [...posts].sort(
    (a, b) =>
      new Date(b.published).getTime() - new Date(a.published).getTime()
  );

  return sorted.map((p) => ({
    ...p,
    rank: rankMap.get(p.url)!,
    domain: extractDomain(p.author),
  }));
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

const INITIAL_DAYS = 6;

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
