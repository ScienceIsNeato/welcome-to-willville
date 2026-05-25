import type {
  RepoMeta,
  WillvilleManifest,
  WillvillePacket,
} from "../../lib/town";
import { WillvilleManifestParser, WillvillePacketParser } from "./town-parsers";

type RepoRef = {
  fullName: string;
  ref: string;
};

export class WillvilleManifestClient {
  private readonly headers: Record<string, string>;
  private readonly manifestParser = new WillvilleManifestParser();
  private readonly packetParser = new WillvillePacketParser();

  constructor(token?: string) {
    this.headers = {
      "User-Agent": "willville-edge",
      Accept: "application/vnd.github+json",
    };
    if (token) this.headers.Authorization = `Bearer ${token}`;
  }

  async fetchRepoPackets(
    fullName: string,
    defaultBranch: string,
    activeBranch?: RepoMeta["activeBranch"],
  ): Promise<{
    willvilleManifest?: WillvilleManifest;
    willvillePacket?: WillvillePacket;
  }> {
    const prRef = await this.fetchMostRecentPrRef(fullName);
    const refs = this.uniqueRefs([
      activeBranch?.name ? { fullName, ref: activeBranch.name } : undefined,
      prRef,
      { fullName, ref: defaultBranch },
    ]);
    const [willvilleManifest, willvillePacket] = await Promise.all([
      this.mergeResolvedManifests(refs),
      this.firstResolved(refs, (ref) => this.fetchStatusPacket(ref)),
    ]);
    return { willvilleManifest, willvillePacket };
  }

  private async fetchMostRecentPrRef(
    fullName: string,
  ): Promise<RepoRef | undefined> {
    try {
      type GitHubPull = {
        head?: {
          ref?: string;
          sha?: string;
          repo?: { full_name?: string } | null;
        };
      };
      const r = await fetch(
        `https://api.github.com/repos/${fullName}/pulls?state=open&sort=updated&direction=desc&per_page=1`,
        { headers: this.headers },
      );
      if (!r.ok) return undefined;
      const pulls = (await r.json()) as GitHubPull[];
      const head = Array.isArray(pulls) ? pulls[0]?.head : undefined;
      const headFullName = head?.repo?.full_name;
      const headRef = head?.ref ?? head?.sha;
      if (!headFullName || !headRef) return undefined;
      if (headFullName.toLowerCase() !== fullName.toLowerCase()) {
        return undefined;
      }
      return { fullName: headFullName, ref: headRef };
    } catch {
      return undefined;
    }
  }

  private uniqueRefs(refs: Array<RepoRef | undefined>): RepoRef[] {
    const seen = new Set<string>();
    const result: RepoRef[] = [];
    for (const ref of refs) {
      if (!ref) continue;
      const key = `${ref.fullName}:${ref.ref}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(ref);
    }
    return result;
  }

  private async firstResolved<T>(
    refs: RepoRef[],
    fetcher: (ref: RepoRef) => Promise<T | undefined>,
  ): Promise<T | undefined> {
    for (const ref of refs) {
      const value = await fetcher(ref);
      if (value !== undefined) return value;
    }
    return undefined;
  }

  private async mergeResolvedManifests(
    refs: RepoRef[],
  ): Promise<WillvilleManifest | undefined> {
    let merged: WillvilleManifest | undefined;
    for (const ref of refs) {
      const next = await this.fetchManifest(ref);
      if (!next) continue;
      merged = this.mergeManifestSections(merged, next);
    }
    return merged;
  }

  private mergeManifestSections(
    preferred: WillvilleManifest | undefined,
    fallback: WillvilleManifest,
  ): WillvilleManifest {
    if (!preferred) return fallback;
    return {
      schemaVersion: preferred.schemaVersion ?? fallback.schemaVersion,
      project: this.mergeSection(preferred.project, fallback.project),
      status: this.mergeSection(preferred.status, fallback.status),
      queue: this.mergeSection(preferred.queue, fallback.queue),
      agent: this.mergeAgent(preferred.agent, fallback.agent),
    };
  }

  private mergeSection<T extends object>(
    preferred: T | undefined,
    fallback: T | undefined,
  ): T | undefined {
    if (!preferred) return fallback;
    if (!fallback) return preferred;

    const merged = { ...fallback } as T;
    for (const [key, value] of Object.entries(preferred) as Array<
      [keyof T, T[keyof T]]
    >) {
      if (value !== undefined) {
        merged[key] = value;
      }
    }

    return merged;
  }

  private mergeAgent(
    preferred: WillvilleManifest["agent"],
    fallback: WillvilleManifest["agent"],
  ): WillvilleManifest["agent"] {
    if (!preferred) return fallback;
    if (!fallback) return preferred;
    return {
      status: preferred.status ?? fallback.status,
      direction: preferred.direction ?? fallback.direction,
      difficulties: preferred.difficulties ?? fallback.difficulties,
      needsHuman: preferred.needsHuman ?? fallback.needsHuman,
      lastUpdate: preferred.lastUpdate ?? fallback.lastUpdate,
    };
  }

  private async fetchStatusPacket(
    repoRef: RepoRef,
  ): Promise<WillvillePacket | undefined> {
    const body = await this.fetchContent(repoRef, "STATUS.md");
    return body ? this.packetParser.parse(body) : undefined;
  }

  private async fetchManifest(
    repoRef: RepoRef,
  ): Promise<WillvilleManifest | undefined> {
    const body = await this.fetchContent(repoRef, ".willville.json");
    if (!body) return undefined;
    try {
      return this.manifestParser.parse(JSON.parse(body));
    } catch {
      return undefined;
    }
  }

  private async fetchContent(
    repoRef: RepoRef,
    path: string,
  ): Promise<string | undefined> {
    try {
      const r = await fetch(
        `https://api.github.com/repos/${repoRef.fullName}/contents/${path}?ref=${encodeURIComponent(repoRef.ref)}`,
        { headers: this.headers },
      );
      if (!r.ok) return undefined;
      const data = (await r.json()) as { content?: string; encoding?: string };
      if (!data.content || data.encoding !== "base64") return undefined;
      return atob(data.content.replace(/\s/g, ""));
    } catch {
      return undefined;
    }
  }
}
