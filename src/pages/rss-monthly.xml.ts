import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { formatChange, formatCount } from "../lib/format";
import { escapeHtml } from "../lib/rss";
import {
  computeStats,
  getAvailableMonths,
  getPreviousMonth,
  type MonthInfo,
  type Stats,
} from "../lib/stats";

function monthToHtml(
  month: MonthInfo,
  stats: Stats,
  previous: Stats | undefined,
  site: URL,
): string {
  const change = (pick: (s: Stats) => number) =>
    previous ? ` (${formatChange(pick(stats), pick(previous))})` : "";
  const monthName = month.label.split(" ")[0];
  const statsUrl = `${site}stats/${month.slug}`;

  const posts = stats.topPosts
    .slice(0, 10)
    .map(
      (post) =>
        `<li><a href="${post.url}">${escapeHtml(post.title)}</a> (${post.toasts} toasts) - ${post.domain}</li>`,
    )
    .join("\n");

  const blogs = stats.topBlogs
    .map(
      (blog) =>
        `<li><a href="${blog.authorUrl}">${blog.domain}</a> (${blog.totalToasts} toasts) - ${blog.appearances} ${blog.appearances === 1 ? "post" : "posts"}</li>`,
    )
    .join("\n");

  return `<p>Here are the stats from Bear Blog trending for ${month.label}. A post is included if it reaches the top 5 pages of <a href="https://bearblog.dev/discover/">bearblog.dev/discover</a>, as collected by <a href="${site}">bearroll.dev</a>.</p>
<h2>${monthName} Bear Blog trending stats</h2>
<ul>
<li><strong>${stats.totalPosts}</strong> trending posts${change((s) => s.totalPosts)}</li>
<li><strong>${stats.uniqueBlogs}</strong> unique blogs${change((s) => s.uniqueBlogs)}</li>
<li><strong>${formatCount(stats.totalToasts)}</strong> toasts collected${change((s) => s.totalToasts)}</li>
</ul>
<h3>Most Toasted Posts</h3>
<ol>${posts}</ol>
<h3>Most Featured Blogs</h3>
<ol>${blogs}</ol>
<h3>Daily toast activity</h3>
<p>See the daily toast graph on the <a href="${statsUrl}">${month.label} stats page</a>.</p>
<hr>
<p>Track how things change over time at <a href="${site}stats">bearroll.dev/stats</a>.</p>`;
}

export function GET(context: APIContext) {
  const site = context.site!;
  const now = new Date();

  const items = getAvailableMonths().flatMap((month) => {
    const [year, monthNum] = month.key.split("-").map(Number);
    // Published on the 1st of the next month at 7am UTC, so the last day's
    // posts have time to gain toasts. Until then the month is held back.
    const pubDate = new Date(Date.UTC(year, monthNum, 1, 7));
    if (now < pubDate) return [];
    const previousMonth = getPreviousMonth(month.key);

    return [
      {
        title: `Bear Blog Trending Stats - ${month.label}`,
        link: `${site}stats/${month.slug}`,
        pubDate,
        content: monthToHtml(
          month,
          computeStats(month.key),
          previousMonth && computeStats(previousMonth.key),
          site,
        ),
      },
    ];
  });

  if (items.length === 0) {
    return new Response("No data available", { status: 404 });
  }

  return rss({
    title: "Bearroll Monthly Stats",
    description: "Monthly stats from Bear Blog's discover page",
    site,
    items,
  });
}
