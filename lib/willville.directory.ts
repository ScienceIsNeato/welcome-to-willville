/**
 * Assembles the crawlable project directory from the town's existing data model
 * (districts + per-repo heuristics). This is the server-rendered, SEO-visible
 * mirror of the visual town: every district and the projects that live in it,
 * with links out to the live product site and the source repo.
 */
import { DISTRICTS, type DistrictId } from "./willville";
import { HEURISTICS } from "./willville.heuristics";
import { liveSiteForRepo, repoUrl } from "./willville.links";

export type DirectoryProject = {
  repo: string;
  displayName: string;
  blurb?: string;
  repoUrl: string;
  liveUrl?: string;
};

export type DirectoryDistrict = {
  id: DistrictId;
  displayName: string;
  blurb: string;
  projects: DirectoryProject[];
};

function projectsInDistrict(id: DistrictId): DirectoryProject[] {
  return HEURISTICS.filter((h) => h.district === id).map((h) => ({
    repo: h.repo,
    displayName: h.displayName ?? h.repo.split("/")[1]!,
    blurb: h.blurb,
    repoUrl: repoUrl(h.repo),
    liveUrl: liveSiteForRepo(h.repo),
  }));
}

/** Full directory, districts in town order, empty districts omitted. */
export function buildDirectory(): DirectoryDistrict[] {
  return DISTRICTS.map((d) => ({
    id: d.id,
    displayName: d.displayName,
    blurb: d.blurb,
    projects: projectsInDistrict(d.id),
  })).filter((d) => d.projects.length > 0);
}

/** One district's directory entry, or undefined if the slug is unknown. */
export function directoryDistrict(id: string): DirectoryDistrict | undefined {
  const d = DISTRICTS.find((entry) => entry.id === id);
  if (!d) return undefined;
  return {
    id: d.id,
    displayName: d.displayName,
    blurb: d.blurb,
    projects: projectsInDistrict(d.id),
  };
}
