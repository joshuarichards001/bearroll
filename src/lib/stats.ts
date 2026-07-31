import { getAllDayDates, loadDay, type RankedPost } from "./posts";

export interface RankedBlog {
  domain: string;
  authorUrl: string;
  appearances: number;
  totalToasts: number;
  rank: number;
}

export interface DayStat {
  date: string;
  total: number;
}

export interface Stats {
  totalPosts: number;
  totalToasts: number;
  uniqueBlogs: number;
  topPosts: RankedPost[];
  topBlogs: RankedBlog[];
  dailyToasts: DayStat[];
}

export interface MonthInfo {
  /** YYYY-MM key matching date prefixes */
  key: string;
  /** URL slug, e.g. "april-2026" */
  slug: string;
  /** Display label, e.g. "April 2026" */
  label: string;
}

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/**
 * Returns months with collected data, in reverse chronological order.
 *
 * The current month is included and covers the days collected so far, so its
 * page is rebuilt with fresh numbers on every build. Nothing special happens
 * when the month ends: no new day files land in it, so the same build turns
 * the page into a finished, unchanging month.
 *
 * Months without data for the 1st are excluded (incomplete dataset, e.g. the
 * month collection started in).
 */
export function getAvailableMonths(): MonthInfo[] {
  return getAllDayDates()
    .filter((date) => date.endsWith("-01"))
    .map((date) => {
      const [year, month] = date.split("-").map(Number);
      const name = MONTH_NAMES[month - 1];
      return {
        key: `${year}-${String(month).padStart(2, "0")}`,
        slug: `${name}-${year}`,
        label: `${name.charAt(0).toUpperCase() + name.slice(1)} ${year}`,
      };
    });
}

/** Compute stats across all data, or restricted to a YYYY-MM month key. */
export function computeStats(monthKey?: string): Stats {
  const dates = getAllDayDates().filter(
    (d) => !monthKey || d.startsWith(monthKey),
  );
  const allPosts: RankedPost[] = [];
  const dailyMap = new Map<string, number>();

  for (const date of dates) {
    const day = loadDay(date);
    if (!day) continue;
    let dayTotal = 0;
    for (const post of day.posts) {
      allPosts.push(post);
      dayTotal += post.toasts;
    }
    dailyMap.set(date, dayTotal);
  }

  // Deduplicate posts by URL, keeping the highest toast count
  const postMap = new Map<string, RankedPost>();
  for (const post of allPosts) {
    const existing = postMap.get(post.url);
    if (!existing || post.toasts > existing.toasts) {
      postMap.set(post.url, post);
    }
  }
  const uniquePosts = [...postMap.values()];

  // Top posts: sorted by toasts, re-ranked by position
  const topPosts = [...uniquePosts]
    .sort((a, b) => b.toasts - a.toasts)
    .slice(0, 10)
    .map((p, i) => ({ ...p, rank: i + 1 }));

  // Blog stats: accumulate across all appearances
  const blogMap = new Map<string, Omit<RankedBlog, "rank">>();
  for (const post of allPosts) {
    const existing = blogMap.get(post.domain);
    if (existing) {
      existing.appearances++;
      existing.totalToasts += post.toasts;
    } else {
      blogMap.set(post.domain, {
        domain: post.domain,
        authorUrl: post.author,
        appearances: 1,
        totalToasts: post.toasts,
      });
    }
  }

  const topBlogs = [...blogMap.values()]
    .sort((a, b) => b.totalToasts - a.totalToasts)
    .slice(0, 10)
    .map((b, i) => ({ ...b, rank: i + 1 }));

  // Chronological order so the graph reads left to right
  const dailyToasts: DayStat[] = [...dates]
    .reverse()
    .map((date) => ({ date, total: dailyMap.get(date) ?? 0 }));

  const totalToasts = uniquePosts.reduce((sum, p) => sum + p.toasts, 0);

  return {
    totalPosts: uniquePosts.length,
    totalToasts,
    uniqueBlogs: blogMap.size,
    topPosts,
    topBlogs,
    dailyToasts,
  };
}
