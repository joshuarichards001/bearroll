import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { formatDate } from "../lib/format";
import { getWeekStarts, loadWeek } from "../lib/posts";
import { postsToListHtml } from "../lib/rss";

export function GET(context: APIContext) {
  const items = getWeekStarts().flatMap((sunday) => {
    const posts = loadWeek(sunday);
    if (posts.length === 0) return [];

    const saturday = new Date(sunday + "T00:00:00Z");
    saturday.setUTCDate(saturday.getUTCDate() + 6);
    // Published the Sunday after the week ends, at 6am UTC.
    const pubDate = new Date(sunday + "T00:00:00Z");
    pubDate.setUTCDate(pubDate.getUTCDate() + 7);
    pubDate.setUTCHours(6, 0, 0, 0);

    return [
      {
        title: `Bearroll Weekly Top 30 - ${formatDate(sunday)} to ${formatDate(saturday.toISOString().slice(0, 10))}`,
        link: `${context.site!}`,
        pubDate,
        content: postsToListHtml(posts),
      },
    ];
  });

  if (items.length === 0) {
    return new Response("No data available", { status: 404 });
  }

  return rss({
    title: "Bearroll Weekly Top 30",
    description: "Weekly top 30 posts from Bear Blog's discover page",
    site: context.site!,
    items,
  });
}
