import { commitFiles, getHeadSha, readFile } from "./github";
import type { GitHubConfig } from "./github";
import { parsePosts } from "./parse";
import type { Post } from "./parse";

const BASE_URL = "https://bearblog.dev/discover/";
const USER_AGENT = "BearrollBot";
const PAGE_COUNT = 5;
const DELAY_MS = 1000;
const OPTED_OUT_DOMAINS = ["departure.blog"];

interface Env {
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  DRY_RUN?: string;
}

interface StoredPost {
  url: string;
  title: string;
  author: string;
  toasts: number;
  first_seen: string;
  last_updated: string;
  published: string;
}

interface DayFileEntry {
  data: StoredPost[];
  modified: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dateKey(isoString: string): string {
  return isoString.slice(0, 10);
}

function isOptedOut(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  return OPTED_OUT_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

async function fetchPage(page: number): Promise<Post[]> {
  const url = `${BASE_URL}?page=${page}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return parsePosts(res, isOptedOut);
}

async function collect(env: Env): Promise<void> {
  const now = new Date().toISOString();
  const github: GitHubConfig = {
    token: env.GITHUB_TOKEN,
    repo: env.GITHUB_REPO,
    branch: env.GITHUB_BRANCH,
  };

  const allPosts: Post[] = [];
  for (let page = 0; page < PAGE_COUNT; page++) {
    if (page > 0) await sleep(DELAY_MS);
    const posts = await fetchPage(page);
    console.log(`Found ${posts.length} posts on page ${page}`);

    if (page === 0 && posts.length === 0) {
      throw new Error(
        "Found zero posts on page 0. HTML structure may have changed.",
      );
    }

    allPosts.push(...posts);
  }

  const headSha = await getHeadSha(github);
  const dayFiles = new Map<string, DayFileEntry>();

  async function getDayFile(key: string): Promise<DayFileEntry> {
    const cached = dayFiles.get(key);
    if (cached) return cached;
    const raw = await readFile(github, `data/${key}.json`, headSha);
    const entry: DayFileEntry = {
      data: raw ? (JSON.parse(raw) as StoredPost[]) : [],
      modified: false,
    };
    dayFiles.set(key, entry);
    return entry;
  }

  let newCount = 0;
  let updatedCount = 0;

  for (const post of allPosts) {
    const dayFile = await getDayFile(dateKey(post.published));
    const existing = dayFile.data.find((p) => p.url === post.url);

    if (!existing) {
      dayFile.data.push({
        url: post.url,
        title: post.title,
        author: post.author,
        toasts: post.toasts,
        first_seen: now,
        last_updated: now,
        published: post.published,
      });
      dayFile.modified = true;
      newCount++;
      continue;
    }

    let changed = false;

    if (post.toasts > existing.toasts) {
      existing.toasts = post.toasts;
      changed = true;
    }

    if (post.title !== existing.title) {
      existing.title = post.title;
      changed = true;
    }

    if (changed) {
      existing.last_updated = now;
      dayFile.modified = true;
      updatedCount++;
    }
  }

  const changedFiles = new Map<string, string>();
  for (const [key, entry] of dayFiles) {
    if (!entry.modified) continue;
    changedFiles.set(
      `data/${key}.json`,
      JSON.stringify(entry.data, null, 2) + "\n",
    );
  }

  console.log(
    `Scraped ${allPosts.length} posts across ${PAGE_COUNT} pages, ` +
      `${newCount} new, ${updatedCount} updated, ${changedFiles.size} day files changed`,
  );

  if (changedFiles.size === 0) return;

  if (env.DRY_RUN) {
    console.log(
      `Dry run, not committing: ${[...changedFiles.keys()].join(", ")}`,
    );
    return;
  }

  const sha = await commitFiles(
    github,
    headSha,
    changedFiles,
    `chore: collect discover data ${now.slice(0, 16)}`,
  );
  console.log(`Committed ${sha}`);
}

export default {
  async scheduled(_controller, env) {
    await collect(env);
  },
} satisfies ExportedHandler<Env>;
