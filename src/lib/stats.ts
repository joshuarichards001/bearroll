import { getAllDayDates, loadDay, type RankedPost } from "./posts";

export interface BlogStats {
  domain: string;
  authorUrl: string;
  appearances: number;
  totalToasts: number;
  bestPost: { title: string; url: string; toasts: number };
}

export interface Stats {
  totalPosts: number;
  totalDays: number;
  uniqueBlogs: number;
  topPosts: RankedPost[];
  topBlogs: BlogStats[];
}

export function computeStats(): Stats {
  const dates = getAllDayDates();
  const allPosts: (RankedPost & { date: string })[] = [];

  for (const date of dates) {
    const day = loadDay(date);
    if (!day) continue;
    for (const post of day.posts) {
      allPosts.push({ ...post, date });
    }
  }

  // Deduplicate posts by URL, keeping the highest toast count
  const postMap = new Map<string, (typeof allPosts)[number]>();
  for (const post of allPosts) {
    const existing = postMap.get(post.url);
    if (!existing || post.toasts > existing.toasts) {
      postMap.set(post.url, post);
    }
  }
  const uniquePosts = [...postMap.values()];

  // Top posts by toasts, re-ranked by position in this list
  const topPosts = [...uniquePosts]
    .sort((a, b) => b.toasts - a.toasts)
    .slice(0, 10)
    .map((p, i) => ({ ...p, rank: i + 1 }));

  // Blog stats
  const blogMap = new Map<string, BlogStats>();
  for (const post of allPosts) {
    const existing = blogMap.get(post.domain);
    if (existing) {
      existing.appearances++;
      existing.totalToasts += post.toasts;
      if (post.toasts > existing.bestPost.toasts) {
        existing.bestPost = {
          title: post.title,
          url: post.url,
          toasts: post.toasts,
        };
      }
    } else {
      blogMap.set(post.domain, {
        domain: post.domain,
        authorUrl: post.author,
        appearances: 1,
        totalToasts: post.toasts,
        bestPost: { title: post.title, url: post.url, toasts: post.toasts },
      });
    }
  }

  const topBlogs = [...blogMap.values()]
    .sort((a, b) => b.totalToasts - a.totalToasts)
    .slice(0, 10);

  // Unique blogs count
  const uniqueDomains = new Set(uniquePosts.map((p) => p.domain));

  return {
    totalPosts: uniquePosts.length,
    totalDays: dates.length,
    uniqueBlogs: uniqueDomains.size,
    topPosts,
    topBlogs,
  };
}
