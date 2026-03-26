import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getAllDayDates, loadDay } from "../lib/posts";

export function GET(context: APIContext) {
  const dates = getAllDayDates();

  // Use the second most recent day so upvotes have time to accumulate.
  // Fall back to the most recent if only one day exists.
  const targetDate = dates.length >= 2 ? dates[1] : dates[0];
  if (!targetDate) {
    return new Response("No data available", { status: 404 });
  }

  const day = loadDay(targetDate);
  if (!day) {
    return new Response("No data available", { status: 404 });
  }

  const top10 = [...day.posts].sort((a, b) => a.rank - b.rank).slice(0, 10);

  const listHtml = top10
    .map(
      (post) =>
        `<li><a href="${post.url}">${post.title}</a> by ${post.domain} — ${post.toasts} toasts</li>`,
    )
    .join("\n");

  return rss({
    title: "BearRoll — Top 10",
    description: "Top 10 posts from Bear Blog's discover page",
    site: context.site!,
    items: [
      {
        title: `Top 10 — ${targetDate}`,
        link: `${context.site!}`,
        pubDate: new Date(targetDate),
        content: `<ol>${listHtml}</ol>`,
      },
    ],
  });
}
