import type { RankedPost } from "./posts";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function postsToListHtml(posts: RankedPost[]): string {
  const items = posts
    .map(
      (post) =>
        `<li><a href="${post.url}">${escapeHtml(post.title)}</a> by ${post.domain} — ${post.toasts} toasts</li>`,
    )
    .join("\n");
  return `<ol>${items}</ol>`;
}
