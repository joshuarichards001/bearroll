import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { formatDate } from "../lib/format";
import { getWeekStarts, loadWeek } from "../lib/posts";
import { postsToListHtml } from "../lib/rss";

export function GET(context: APIContext) {
  const items = getWeekStarts().flatMap((monday) => {
    const posts = loadWeek(monday);
    if (posts.length === 0) return [];

    const sunday = new Date(monday + "T00:00:00Z");
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    // Published the Monday after the week ends, at 7am UTC.
    const pubDate = new Date(monday + "T00:00:00Z");
    pubDate.setUTCDate(pubDate.getUTCDate() + 7);
    pubDate.setUTCHours(7, 0, 0, 0);
    const archiveUrl = `${context.site!}archive/week/${monday}`;

    return [
      {
        title: `Bearroll Weekly Top 20 - ${formatDate(monday)} to ${formatDate(sunday.toISOString().slice(0, 10))}`,
        // Each item needs its own link: @astrojs/rss derives <guid> from it,
        // and identical guids make readers treat every week as the same entry.
        link: archiveUrl,
        pubDate,
        content: `${postsToListHtml(posts)}<p><a href="${archiveUrl}">See all posts from this week</a></p>`,
      },
    ];
  });

  if (items.length === 0) {
    return new Response("No data available", { status: 404 });
  }

  return rss({
    title: "Bearroll Weekly Top 20",
    description: "Weekly top 20 posts from Bear Blog's discover page",
    site: context.site!,
    items,
  });
}
