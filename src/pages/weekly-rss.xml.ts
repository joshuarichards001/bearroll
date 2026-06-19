import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getAllDayDates, loadDay, type RankedPost } from "../lib/posts";

/** Returns the Monday (UTC) that starts the week containing the given date. */
function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d.toISOString().slice(0, 10);
}

/** Human label for a week, e.g. "Mon, 1 Jun – Sun, 7 Jun 2026". */
function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + "T12:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  };
  const startStr = start.toLocaleDateString("en-GB", opts);
  const endStr = end.toLocaleDateString("en-GB", {
    ...opts,
    year: "numeric",
  });
  return `${startStr} – ${endStr}`;
}

export function GET(context: APIContext) {
  const allDates = getAllDayDates();

  // Skip the in-progress week (the one containing today) so the feed only
  // covers completed weeks with settled toast counts.
  const currentWeekStart = getWeekStart(new Date().toISOString().slice(0, 10));

  // Group day dates by their week start (Monday).
  const weeks = new Map<string, string[]>();
  for (const date of allDates) {
    const weekStart = getWeekStart(date);
    if (weekStart === currentWeekStart) continue;
    const group = weeks.get(weekStart);
    if (group) group.push(date);
    else weeks.set(weekStart, [date]);
  }

  const weekStarts = [...weeks.keys()].sort().reverse().slice(0, 12);

  if (weekStarts.length === 0) {
    return new Response("No data available", { status: 404 });
  }

  const items = weekStarts.map((weekStart) => {
    // Deduplicate posts across the week's days by URL, keeping the highest
    // toast count, then take the top 50 by toasts.
    const postMap = new Map<string, RankedPost>();
    for (const date of weeks.get(weekStart)!) {
      const day = loadDay(date);
      if (!day) continue;
      for (const post of day.posts) {
        const existing = postMap.get(post.url);
        if (!existing || post.toasts > existing.toasts) {
          postMap.set(post.url, post);
        }
      }
    }

    const top50 = [...postMap.values()]
      .sort((a, b) => b.toasts - a.toasts)
      .slice(0, 50);

    const listHtml = top50
      .map(
        (post) =>
          `<li><a href="${post.url}">${post.title}</a> by ${post.domain} — ${post.toasts} toasts</li>`,
      )
      .join("\n");

    // Publish at the end of the week (Sunday) once it has fully settled.
    const pubDate = new Date(weekStart + "T00:00:00Z");
    pubDate.setUTCDate(pubDate.getUTCDate() + 7);

    return {
      title: `Week of ${formatWeekRange(weekStart)} - Top 50`,
      link: `${context.site!}archive/${weekStart}`,
      pubDate,
      content: `<ol>${listHtml}</ol>`,
    };
  });

  const feedTitle = `Bear Blog Weekly Top 50 - Week of ${formatWeekRange(weekStarts[0])}`;

  return rss({
    title: feedTitle,
    description: "Weekly top 50 posts from Bear Blog's discover page",
    site: context.site!,
    items,
  });
}
