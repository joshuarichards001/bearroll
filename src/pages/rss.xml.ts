import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getAllDayDates, loadDay } from "../lib/posts";

export function GET(context: APIContext) {
  const allDates = getAllDayDates();

  // Lag by 2 days so upvotes have time to accumulate (e.g. when the 28th
  // ticks over, the 26th's top 10 is the newest item in the feed).
  // Fall back gracefully when fewer days are available.
  const dates =
    allDates.length >= 3 ? allDates.slice(2, 16) : allDates.slice(0, 14);

  if (dates.length === 0) {
    return new Response("No data available", { status: 404 });
  }

  const items = dates.flatMap((date) => {
    const day = loadDay(date);
    if (!day) return [];

    const top10 = [...day.posts].sort((a, b) => a.rank - b.rank).slice(0, 10);
    const listHtml = top10
      .map(
        (post) =>
          `<li><a href="${post.url}">${post.title}</a> by ${post.domain} — ${post.toasts} toasts</li>`,
      )
      .join("\n");

    return [
      {
        title: `${date} Top 10`,
        link: `${context.site!}archive/${date}`,
        pubDate: new Date(date),
        content: `<ol>${listHtml}</ol>`,
      },
    ];
  });

  return rss({
    title: "Bear Roll — Daily Top 10",
    description: "Daily top 10 posts from Bear Blog's discover page",
    site: context.site!,
    items,
  });
}
