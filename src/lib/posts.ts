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

export function loadAllDays(): DayGroup[] {
  const dataDir = path.resolve(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) return [];

  const files = fs
    .readdirSync(dataDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();

  const days: DayGroup[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(dataDir, file), "utf-8");
    let posts: Post[];
    try {
      posts = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!Array.isArray(posts) || posts.length === 0) continue;

    const date = file.replace(".json", "");

    // Sort by toasts descending to assign ranks
    const byToasts = [...posts].sort((a, b) => b.toasts - a.toasts);
    const rankMap = new Map<string, number>();
    byToasts.forEach((p, i) => rankMap.set(p.url, i + 1));

    // Sort by published time, newest first for display
    const sorted = [...posts].sort(
      (a, b) =>
        new Date(b.published).getTime() - new Date(a.published).getTime()
    );

    const rankedPosts: RankedPost[] = sorted.map((p) => ({
      ...p,
      rank: rankMap.get(p.url)!,
      domain: extractDomain(p.author),
    }));

    days.push({ date, posts: rankedPosts });
  }

  return days;
}
