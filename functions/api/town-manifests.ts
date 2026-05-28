import type { RepoMeta, WillvilleManifest } from "../../lib/town";
import { WillvilleManifestParser } from "./town-parsers";

type RepoRef = {
  fullName: string;
  ref: string;
  commitHash?: string;
};

type FetchedContent = {
  body: string;
  blobSha?: string;
};

let manifestCache = new Map<string, WillvilleManifest>();

function decodeBase64Utf8(input: string): string {
  const binary = atob(input.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function readCachedRepoManifest(
  fullName: string,
): WillvilleManifest | undefined {
  return manifestCache.get(fullName);
}

export function replaceManifestCache(
  nextCache: Map<string, WillvilleManifest>,
): void {
  manifestCache = nextCache;
}

export class WillvilleManifestClient {
  private readonly headers: Record<string, string>;
  private readonly manifestParser = new WillvilleManifestParser();

  constructor(token?: string) {
    this.headers = {
      "User-Agent": "willville-edge",
      Accept: "application/vnd.github+json",
      "Cache-Control": "no-cache",
    };
    if (token) this.headers.Authorization = `Bearer ${token}`;
  }

  async fetchRepoManifest(
    fullName: string,
    defaultBranch: string,
    activeBranch?: RepoMeta["activeBranch"],
  ): Promise<WillvilleManifest | undefined> {
    const refs = this.uniqueRefs([
      activeBranch?.name
        ? {
            fullName,
            ref: activeBranch.name,
            commitHash: activeBranch.commitHash,
          }
        : undefined,
      { fullName, ref: defaultBranch },
    ]);
    return this.firstResolved(refs, (ref) => this.fetchManifest(ref));
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
