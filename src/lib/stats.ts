import { getAllDayDates, loadDay, type RankedPost } from "./posts";

export interface RankedBlog {
  domain: string;
  authorUrl: string;
  appearances: number;
  totalToasts: number;
  rank: number;
}

export interface Stats {
  totalPosts: number;
  totalDays: number;
  uniqueBlogs: number;
  topPosts: RankedPost[];
  topBlogs: RankedBlog[];
}

export function computeStats(): Stats {
  const dates = getAllDayDates();
  const allPosts: RankedPost[] = [];

  for (const date of dates) {
    const day = loadDay(date);
    if (!day) continue;
    for (const post of day.posts) {
      allPosts.push(post);
    }
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

  return {
    totalPosts: uniquePosts.length,
    totalDays: dates.length,
    uniqueBlogs: blogMap.size,
    topPosts,
    topBlogs,
  };
}
