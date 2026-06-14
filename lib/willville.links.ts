/**
 * Maps a town repo to its live, public-facing product site — used by the
 * crawlable /projects directory and per-district pages to cross-link the town
 * to the real portfolio domains (helps each site's SEO via internal linking).
 *
 * Only verified-live domains are listed. loopcloser.io is intentionally absent
 * while it is offline — we don't want to link crawlers to a dead origin.
 */
const LIVE_SITES: Record<string, string> = {
  "ScienceIsNeato/slop-mop": "https://slop-mop.com",
  "ScienceIsNeato/slop-mop-website": "https://slop-mop.com",
  "ScienceIsNeato/RizlDizl": "https://rizldizl.com",
  "ScienceIsNeato/RizlDizlScaryBitz": "https://rizldizl.com",
  "ScienceIsNeato/rizldizl-website": "https://rizldizl.com",
  "ScienceIsNeato/ChronicChronicler": "https://chronic-chronicler.com",
  "ScienceIsNeato/lessllm": "https://lessllm.com",
  "ScienceIsNeato/queueup-website": "https://queueuphaircuts.com",
  "ScienceIsNeato/ganglia-core": "https://ganglia-ai.com",
  "ScienceIsNeato/ganglia-studio": "https://ganglia-ai.com",
  "ScienceIsNeato/welcome-to-willville": "https://willville.ai",
};

/** Live product URL for a repo, or undefined if it has no public site (yet). */
export function liveSiteForRepo(repo: string): string | undefined {
  return LIVE_SITES[repo];
}

/** Canonical GitHub URL for a repo slug like "ScienceIsNeato/slop-mop". */
export function repoUrl(repo: string): string {
  return `https://github.com/${repo}`;
}
