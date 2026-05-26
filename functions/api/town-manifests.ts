import type {
  RepoMeta,
  WillvilleManifest,
  WillvillePacket,
} from "../../lib/town";
import { WillvilleManifestParser, WillvillePacketParser } from "./town-parsers";

type RepoRef = {
  fullName: string;
  ref: string;
  commitHash?: string;
};

type FetchedContent = {
  body: string;
  blobSha?: string;
};

function decodeBase64Utf8(input: string): string {
  const binary = atob(input.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export class WillvilleManifestClient {
  private readonly headers: Record<string, string>;
  private readonly manifestParser = new WillvilleManifestParser();
  private readonly packetParser = new WillvillePacketParser();

  constructor(token?: string) {
    this.headers = {
      "User-Agent": "willville-edge",
      Accept: "application/vnd.github+json",
      "Cache-Control": "no-cache",
    };
    if (token) this.headers.Authorization = `Bearer ${token}`;
  }

  async fetchRepoPackets(
    fullName: string,
    defaultBranch: string,
    activeBranch?: RepoMeta["activeBranch"],
    recentBranches?: Array<{ name: string; commitHash?: string }>,
  ): Promise<{
    willvilleManifest?: WillvilleManifest;
    willvillePacket?: WillvillePacket;
  }> {
    const prRef = await this.fetchMostRecentPrRef(fullName);
    const branchRefs = (recentBranches ?? []).map((b) => ({
      fullName,
      ref: b.name,
      commitHash: b.commitHash,
    }));
    const refs = this.uniqueRefs([
      activeBranch?.name
        ? {
            fullName,
            ref: activeBranch.name,
            commitHash: activeBranch.commitHash,
          }
        : undefined,
      prRef,
      ...branchRefs,
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
      return { fullName: headFullName, ref: headRef, commitHash: head?.sha };
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

    // The agent block with the most recent last_update wins — so when
    // multiple branches have .willville.json, the freshest status shows.
    let newer = preferred;
    let older = fallback;
    const prefTime = Date.parse(preferred.lastUpdate ?? "");
    const fallTime = Date.parse(fallback.lastUpdate ?? "");
    if (!Number.isNaN(fallTime) && (Number.isNaN(prefTime) || fallTime > prefTime)) {
      newer = fallback;
      older = preferred;
    }

    return {
      status: newer.status ?? older.status,
      direction: newer.direction ?? older.direction,
      difficulties: newer.difficulties ?? older.difficulties,
      needsHuman: newer.needsHuman ?? older.needsHuman,
      lastUpdate: newer.lastUpdate ?? older.lastUpdate,
      sourceBranch: newer.sourceBranch ?? older.sourceBranch,
      sourceCommitHash: newer.sourceCommitHash ?? older.sourceCommitHash,
      sourceBlobSha: newer.sourceBlobSha ?? older.sourceBlobSha,
    };
  }

  private async fetchStatusPacket(
    repoRef: RepoRef,
  ): Promise<WillvillePacket | undefined> {
    const content = await this.fetchContent(repoRef, "STATUS.md");
    return content ? this.packetParser.parse(content.body) : undefined;
  }

  private async fetchManifest(
    repoRef: RepoRef,
  ): Promise<WillvilleManifest | undefined> {
    const content = await this.fetchContent(repoRef, ".willville.json");
    if (!content) return undefined;
    try {
      const manifest = this.manifestParser.parse(JSON.parse(content.body));
      if (manifest?.agent) {
        manifest.agent.sourceBranch = repoRef.ref;
        manifest.agent.sourceCommitHash = repoRef.commitHash;
        manifest.agent.sourceBlobSha = content.blobSha;
      }
      return manifest;
    } catch {
      return undefined;
    }
  }

  private async fetchContent(
    repoRef: RepoRef,
    path: string,
  ): Promise<FetchedContent | undefined> {
    try {
      const r = await fetch(
        `https://api.github.com/repos/${repoRef.fullName}/contents/${path}?ref=${encodeURIComponent(repoRef.ref)}`,
        { headers: this.headers, cache: "no-store" },
      );
      if (!r.ok) return undefined;
      const data = (await r.json()) as {
        content?: string;
        encoding?: string;
        sha?: string;
      };
      if (!data.content || data.encoding !== "base64") return undefined;
      return {
        body: decodeBase64Utf8(data.content),
        blobSha: data.sha,
      };
    } catch {
      return undefined;
    }
  }
}
