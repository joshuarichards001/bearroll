import fs from "node:fs";
import path from "node:path";

/** Repo-root file listing the domains of blogs that asked to be left out. */
const OPT_OUT_FILE = "opt-out.txt";

/**
 * Reduce a URL or bare domain to a comparable hostname: lowercased, with any
 * scheme, path and leading "www." removed. Returns "" if nothing is left.
 */
export function normalizeDomain(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";

  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  const host = withoutScheme.split(/[/?#]/)[0];
  return host.replace(/^www\./, "");
}

/** Parse the opt-out file's contents into a set of normalized domains. */
export function parseOptOutList(contents: string): Set<string> {
  const domains = new Set<string>();
  for (const line of contents.split("\n")) {
    const domain = normalizeDomain(line.split("#")[0]);
    if (domain) domains.add(domain);
  }
  return domains;
}

/** Load the opt-out list. A missing file means nobody has opted out. */
export function loadOptOutList(rootDir: string = process.cwd()): Set<string> {
  const filePath = path.resolve(rootDir, OPT_OUT_FILE);
  if (!fs.existsSync(filePath)) return new Set();
  return parseOptOutList(fs.readFileSync(filePath, "utf-8"));
}

/** True if any of the given URLs belongs to a blog that opted out. */
export function isOptedOut(
  optedOut: ReadonlySet<string>,
  ...urls: string[]
): boolean {
  if (optedOut.size === 0) return false;
  return urls.some((url) => {
    const domain = normalizeDomain(url);
    return domain !== "" && optedOut.has(domain);
  });
}
