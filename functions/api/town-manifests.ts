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

export type ManifestCacheStore = {
  get(
    key: string,
    options?: { type?: "text" | "json" },
  ): Promise<unknown | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
  delete?(key: string): Promise<void>;
};

type PersistedManifestSnapshot = {
  schemaVersion: 1;
  cachedAt: string;
  manifests: Record<string, WillvilleManifest>;
};

export const MANIFEST_CACHE_KEY = "willville:manifests:cache:v1";
const MANIFEST_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

let manifestCache = new Map<string, WillvilleManifest>();
let manifestCacheCachedAt: string | null = null;
let hydrateManifestCachePromise: Promise<void> | null = null;
let hydratedManifestCache = false;

function snapshotFromCache(
  source: Map<string, WillvilleManifest>,
): PersistedManifestSnapshot {
  return {
    schemaVersion: 1,
    cachedAt: new Date().toISOString(),
    manifests: Object.fromEntries(source),
  };
}

function parsePersistedSnapshot(
  raw: unknown,
): PersistedManifestSnapshot | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const snapshot = raw as Partial<PersistedManifestSnapshot>;
  if (snapshot.schemaVersion !== 1) {
    return undefined;
  }

  if (typeof snapshot.cachedAt !== "string") {
    return undefined;
  }

  if (!snapshot.manifests || typeof snapshot.manifests !== "object") {
    return undefined;
  }

  return {
    schemaVersion: 1,
    cachedAt: snapshot.cachedAt,
    manifests: snapshot.manifests as Record<string, WillvilleManifest>,
  };
}

function cacheFromSnapshot(
  snapshot: PersistedManifestSnapshot | undefined,
): Map<string, WillvilleManifest> {
  if (!snapshot) {
    return new Map<string, WillvilleManifest>();
  }

  const parsed = new Map<string, WillvilleManifest>();
  for (const [repo, manifest] of Object.entries(snapshot.manifests)) {
    if (!manifest || typeof manifest !== "object") {
      continue;
    }
    parsed.set(repo, manifest as WillvilleManifest);
  }

  return parsed;
}

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
  manifestCacheCachedAt = new Date().toISOString();
}

export function getManifestCacheCachedAt(): string | null {
  return manifestCacheCachedAt;
}

function parseIsoTimestamp(value: string | null): number {
  if (!value) {
    return Number.NaN;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function isManifestCacheOlderThan(cachedAt: string | null): boolean {
  const incoming = parseIsoTimestamp(cachedAt);
  if (!Number.isFinite(incoming)) {
    return false;
  }

  const current = parseIsoTimestamp(manifestCacheCachedAt);
  if (!Number.isFinite(current)) {
    return true;
  }

  return incoming > current;
}

export async function readPersistedManifestCacheCachedAt(
  store?: ManifestCacheStore,
): Promise<string | null> {
  if (!store) {
    return null;
  }

  try {
    const raw = await store.get(MANIFEST_CACHE_KEY, { type: "json" });
    const snapshot = parsePersistedSnapshot(raw);
    return snapshot?.cachedAt ?? null;
  } catch {
    return null;
  }
}

export async function hydrateManifestCacheFromStore(
  store?: ManifestCacheStore,
  options: { force?: boolean } = {},
): Promise<void> {
  if (!store || (hydratedManifestCache && !options.force)) {
    return;
  }

  if (hydrateManifestCachePromise) {
    await hydrateManifestCachePromise;
    if (!options.force) {
      return;
    }
  }

  hydrateManifestCachePromise = (async () => {
    try {
      const raw = await store.get(MANIFEST_CACHE_KEY, { type: "json" });
      const snapshot = parsePersistedSnapshot(raw);
      const persisted = cacheFromSnapshot(snapshot);
      if (persisted.size > 0) {
        manifestCache = persisted;
      }
      manifestCacheCachedAt = snapshot?.cachedAt ?? manifestCacheCachedAt;
      hydratedManifestCache = true;
    } catch {
      // Keep in-memory behavior if durable cache read fails.
    } finally {
      hydrateManifestCachePromise = null;
    }
  })();

  await hydrateManifestCachePromise;
}

export async function persistManifestCacheToStore(
  source: Map<string, WillvilleManifest>,
  store?: ManifestCacheStore,
): Promise<void> {
  if (!store) {
    return;
  }

  try {
    const snapshot = snapshotFromCache(source);
    await store.put(MANIFEST_CACHE_KEY, JSON.stringify(snapshot), {
      expirationTtl: MANIFEST_CACHE_TTL_SECONDS,
    });
    manifestCacheCachedAt = snapshot.cachedAt;
    hydratedManifestCache = true;
  } catch {
    // No-op: bell should still succeed with in-memory cache even if KV write fails.
  }
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
