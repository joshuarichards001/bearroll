import type { RankedPost } from "./posts";

export function postsToListHtml(posts: RankedPost[]): string {
  const items = posts
    .map(
      (post) =>
        `<li><a href="${post.url}">${post.title}</a> by ${post.domain} — ${post.toasts} toasts</li>`,
    )
    .join("\n");
  return `<ol>${items}</ol>`;
}
