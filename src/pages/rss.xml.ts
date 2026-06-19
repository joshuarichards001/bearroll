import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { formatDate } from "../lib/format";
import { getAllDayDates, loadDay } from "../lib/posts";
import { postsToListHtml } from "../lib/rss";

export function GET(context: APIContext) {
  const allDates = getAllDayDates();

  // Skip today (still accumulating) and include yesterday only after 6am UTC,
  // giving toasts time to settle overnight before the feed updates.
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const utcHour = now.getUTCHours();

  const dates = allDates
    .filter((date) => {
      if (date === todayStr) return false;
      if (date === yesterdayStr && utcHour < 6) return false;
      return true;
    })
    .slice(0, 14);

  if (dates.length === 0) {
    return new Response("No data available", { status: 404 });
  }

  const items = dates.flatMap((date) => {
    const day = loadDay(date);
    if (!day) return [];

    const top10 = [...day.posts].sort((a, b) => a.rank - b.rank).slice(0, 10);

    return [
      {
        title: `Bearroll Daily Top 10 - ${formatDate(date)}`,
        link: `${context.site!}archive/${date}`,
        pubDate: new Date(new Date(date + "T06:00:00Z").getTime() + 86400000),
        content: postsToListHtml(top10),
      },
    ];
  });

  return rss({
    title: "Bearroll Daily Top 10",
    description: "Daily top 10 posts from Bear Blog's discover page",
    site: context.site!,
    items,
  });
}
