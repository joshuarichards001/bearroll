const API = "https://api.github.com";

export interface GitHubConfig {
  token: string;
  repo: string;
  branch: string;
}

async function request<T>(
  config: GitHubConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API}/repos/${config.repo}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.token}`,
      "User-Agent": "BearrollBot",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers,
    },
  });
  if (!res.ok) {
    throw new Error(
      `GitHub ${init.method ?? "GET"} ${path} failed: ${res.status} ${await res.text()}`,
    );
  }
  return res.json() as Promise<T>;
}

export async function getHeadSha(config: GitHubConfig): Promise<string> {
  const ref = await request<{ object: { sha: string } }>(
    config,
    `/git/ref/heads/${config.branch}`,
  );
  return ref.object.sha;
}

export async function readFile(
  config: GitHubConfig,
  path: string,
  ref: string,
): Promise<string | null> {
  const res = await fetch(
    `${API}/repos/${config.repo}/contents/${path}?ref=${ref}`,
    {
      headers: {
        Accept: "application/vnd.github.raw+json",
        Authorization: `Bearer ${config.token}`,
        "User-Agent": "BearrollBot",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GitHub read ${path} failed: ${res.status}`);
  }
  return res.text();
}

export async function commitFiles(
  config: GitHubConfig,
  parentSha: string,
  files: Map<string, string>,
  message: string,
): Promise<string> {
  const parent = await request<{ tree: { sha: string } }>(
    config,
    `/git/commits/${parentSha}`,
  );

  const tree = await request<{ sha: string }>(config, "/git/trees", {
    method: "POST",
    body: JSON.stringify({
      base_tree: parent.tree.sha,
      tree: [...files].map(([path, content]) => ({
        path,
        mode: "100644",
        type: "blob",
        content,
      })),
    }),
  });

  const commit = await request<{ sha: string }>(config, "/git/commits", {
    method: "POST",
    body: JSON.stringify({ message, tree: tree.sha, parents: [parentSha] }),
  });

  // Non-forced, so a push that landed since parentSha was read makes this fail instead of being overwritten.
  await request(config, `/git/refs/heads/${config.branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  return commit.sha;
}
