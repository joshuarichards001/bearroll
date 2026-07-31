/**
 * Domains that have asked to be left out of Bear Roll. The collector skips
 * every post from these domains, so they never enter `data/`.
 *
 * To opt out, add your domain (no protocol, no trailing slash) to this list and
 * open a pull request, or open an issue asking for it to be added.
 */
export const OPTED_OUT_DOMAINS = ["departure.blog"];

/** True if a URL belongs to an opted-out domain or one of its subdomains. */
export function isOptedOut(url: string): boolean {
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
