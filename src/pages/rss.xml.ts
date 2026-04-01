import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getAllDayDates, loadDay } from "../lib/posts";

function formatRssDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d
    .toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    })
    .replace(",", "");
}

export function GET(context: APIContext) {
  const allDates = getAllDayDates();

  // Skip today (still accumulating) and include yesterday only after 9am UTC,
  // giving toasts time to settle overnight before the feed updates.
  const utcHour = new Date().getUTCHours();
  const skip = utcHour >= 9 ? 1 : 2;
  const dates = allDates.slice(skip, skip + 14);

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
        title: `${formatRssDate(date)} - Top 10`,
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
