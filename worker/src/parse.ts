export interface Post {
  url: string;
  title: string;
  author: string;
  toasts: number;
  published: string;
}

interface PartialPost {
  url?: string;
  title: string;
  author?: string;
  toasts: number;
  published?: string;
  inTitle: boolean;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

// HTMLRewriter hands over raw text chunks, so entities have to be decoded by hand.
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === "#") {
      const code =
        entity[1].toLowerCase() === "x"
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

export async function parsePosts(
  res: Response,
  isOptedOut: (url: string) => boolean,
): Promise<Post[]> {
  const items: PartialPost[] = [];
  const current = () => items[items.length - 1];

  await new HTMLRewriter()
    .on("ul.discover-posts li", {
      element(el) {
        items.push({
          title: "",
          toasts: parseInt(el.getAttribute("data-upvotes") ?? "", 10) || 0,
          inTitle: false,
        });
      },
    })
    .on("ul.discover-posts li > div > a", {
      element(el) {
        const item = current();
        if (!item || item.url !== undefined) return;
        item.url = decodeEntities(el.getAttribute("href") ?? "");
        item.inTitle = true;
        el.onEndTag(() => {
          item.inTitle = false;
        });
      },
      text(chunk) {
        const item = current();
        if (item?.inTitle) item.title += chunk.text;
      },
    })
    .on("ul.discover-posts li > div > small > span > a", {
      element(el) {
        const item = current();
        if (item && item.author === undefined) {
          item.author = decodeEntities(el.getAttribute("href") ?? "");
        }
      },
    })
    .on("ul.discover-posts li > div > small small[title]", {
      element(el) {
        const item = current();
        if (item && item.published === undefined) {
          item.published = el.getAttribute("title") ?? "";
        }
      },
    })
    .transform(res)
    .arrayBuffer();

  const posts: Post[] = [];
  for (const item of items) {
    const url = item.url;
    const title = decodeEntities(item.title).trim();
    const published = item.published;

    if (!url || !title || !published) {
      console.error(
        `Skipping post: missing ${[!url && "url", !title && "title", !published && "published"].filter(Boolean).join(", ")}`,
      );
      continue;
    }

    if (isOptedOut(url)) continue;

    posts.push({
      url,
      title,
      author: item.author || "",
      toasts: item.toasts,
      published,
    });
  }
  return posts;
}
