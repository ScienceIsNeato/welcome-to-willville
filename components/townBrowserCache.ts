import type { Stop } from "@/lib/town";
import type { CanalBoat } from "@/lib/canal";

const BROWSER_TOWN_CACHE_KEY = "willville:town:last:v1";

type BrowserTownSnapshot = {
  schemaVersion: 1;
  cachedAt: string;
  stops: Stop[];
};

export function parseTimestamp(value: string | undefined): number {
  if (!value) {
    return Number.NaN;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function readBrowserTownSnapshot(): BrowserTownSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(BROWSER_TOWN_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<BrowserTownSnapshot>;
    if (
      parsed.schemaVersion !== 1 ||
      typeof parsed.cachedAt !== "string" ||
      !Array.isArray(parsed.stops)
    ) {
      return null;
    }

    return {
      schemaVersion: 1,
      cachedAt: parsed.cachedAt,
      stops: parsed.stops as Stop[],
    };
  } catch {
    return null;
  }
}

export function writeBrowserTownSnapshot(
  stops: Stop[],
  options: { cachedAt?: string } = {},
): void {
  if (typeof window === "undefined" || stops.length === 0) {
    return;
  }

  const incomingCachedAt = options.cachedAt;
  const cachedAt =
    typeof incomingCachedAt === "string" &&
    Number.isFinite(parseTimestamp(incomingCachedAt))
      ? incomingCachedAt
      : new Date().toISOString();

  try {
    window.localStorage.setItem(
      BROWSER_TOWN_CACHE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        cachedAt,
        stops,
      } satisfies BrowserTownSnapshot),
    );
  } catch {
    // Ignore storage errors (private mode/quota) and keep town rendering.
  }
}

const BROWSER_CANAL_CACHE_KEY = "willville:canal:last:v1";

type BrowserCanalSnapshot = {
  schemaVersion: 1;
  cachedAt: string;
  boats: CanalBoat[];
};

export function readBrowserCanalSnapshot(): BrowserCanalSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(BROWSER_CANAL_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<BrowserCanalSnapshot>;
    if (
      parsed.schemaVersion !== 1 ||
      typeof parsed.cachedAt !== "string" ||
      !Array.isArray(parsed.boats)
    ) {
      return null;
    }

    return {
      schemaVersion: 1,
      cachedAt: parsed.cachedAt,
      boats: parsed.boats as CanalBoat[],
    };
  } catch {
    return null;
  }
}

export function writeBrowserCanalSnapshot(
  boats: CanalBoat[],
  options: { cachedAt?: string } = {},
): void {
  if (typeof window === "undefined" || boats.length === 0) {
    return;
  }

  const incomingCachedAt = options.cachedAt;
  const cachedAt =
    typeof incomingCachedAt === "string" &&
    Number.isFinite(parseTimestamp(incomingCachedAt))
      ? incomingCachedAt
      : new Date().toISOString();

  try {
    window.localStorage.setItem(
      BROWSER_CANAL_CACHE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        cachedAt,
        boats,
      } satisfies BrowserCanalSnapshot),
    );
  } catch {
    // Ignore storage errors (private mode/quota) and keep boats rendering.
  }
}
