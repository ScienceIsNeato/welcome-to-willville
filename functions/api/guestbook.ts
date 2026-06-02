/**
 * Willville Guest Book.
 *
 * An open logbook on the Town Forum (WTF) board: any visitor can sign it and
 * leave a note. There is no auth and no account — it's a public scribble wall.
 *
 *   GET  /api/guestbook  -> { entries: GuestbookEntry[] }   (newest first)
 *   POST /api/guestbook  -> { entry: GuestbookEntry }       (the one just added)
 *
 * Storage mirrors the canal snapshot: a single capped array lives in the
 * shared KV store (WILLVILLE_MANIFEST_CACHE) under one key. When that store is
 * unbound — as in local `wrangler pages dev`, which has no KV — we fall back to
 * a module-level in-memory array so the book still works within the running
 * process. Prod binds the KV via the Pages dashboard, so entries are durable
 * there.
 *
 * Guards are technical, not editorial: we cap name/message length, cap the
 * total stored entries, strip control characters, and rate-limit per IP. We do
 * not censor what visitors say.
 */

import type { PagesFunction } from "../types";
import { withCorsHeaders } from "./cors";
import { type ManifestCacheStore } from "./town-manifests";

interface Env {
  WILLVILLE_MANIFEST_CACHE?: ManifestCacheStore;
}

export type GuestbookEntry = {
  id: string;
  name: string;
  message: string;
  at: string;
};

type GuestbookSnapshot = {
  schemaVersion: 1;
  entries: GuestbookEntry[];
};

export const GUESTBOOK_KEY = "willville:guestbook:v1";

const MAX_NAME_LEN = 40;
const MAX_MESSAGE_LEN = 500;
/** Hard cap on stored entries; oldest fall off the back of the book. */
const MAX_ENTRIES = 200;
/** Most entries returned to a reader at once (newest first). */
const READ_LIMIT = 100;
/** Minimum seconds between posts from the same IP. */
const RATE_LIMIT_SECONDS = 15;
const DEFAULT_NAME = "Anonymous Visitor";

const TAB = 0x09;
const NEWLINE = 0x0a;
const CARRIAGE_RETURN = 0x0d;
const UNIT_SEPARATOR = 0x1f;
const DELETE = 0x7f;

/**
 * A character is a control character we want to strip if it sits in the C0
 * range (below 0x20) or is DEL (0x7f) — but we keep tab, newline, and carriage
 * return so multi-line notes survive.
 */
function isStrippableControlChar(code: number): boolean {
  if (code === TAB || code === NEWLINE || code === CARRIAGE_RETURN) {
    return false;
  }
  return code <= UNIT_SEPARATOR || code === DELETE;
}

/**
 * Per-process fallback used only when no KV store is bound (local dev). In prod
 * the KV store is authoritative; this is never read there.
 */
let memoryEntries: GuestbookEntry[] = [];
/** Per-process rate-limit clock, also only used when KV is unbound. */
const memoryRateLimit = new Map<string, number>();

/** Drop control characters (keep newline/tab), then trim and length-cap. */
function sanitizeField(value: unknown, maxLen: number): string {
  if (typeof value !== "string") {
    return "";
  }
  let cleaned = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (!isStrippableControlChar(code)) {
      cleaned += ch;
    }
  }
  return cleaned.trim().slice(0, maxLen);
}

function parseSnapshot(raw: unknown): GuestbookSnapshot {
  if (!raw || typeof raw !== "object") {
    return { schemaVersion: 1, entries: [] };
  }
  const candidate = raw as Partial<GuestbookSnapshot>;
  if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.entries)) {
    return { schemaVersion: 1, entries: [] };
  }
  return { schemaVersion: 1, entries: candidate.entries as GuestbookEntry[] };
}

async function readEntries(
  store?: ManifestCacheStore,
): Promise<GuestbookEntry[]> {
  if (!store) {
    return memoryEntries;
  }
  try {
    const raw = await store.get(GUESTBOOK_KEY, { type: "json" });
    return parseSnapshot(raw).entries;
  } catch {
    return [];
  }
}

async function writeEntries(
  store: ManifestCacheStore | undefined,
  entries: GuestbookEntry[],
): Promise<void> {
  if (!store) {
    memoryEntries = entries;
    return;
  }
  try {
    await store.put(
      GUESTBOOK_KEY,
      JSON.stringify({
        schemaVersion: 1,
        entries,
      } satisfies GuestbookSnapshot),
    );
  } catch {
    // Keep the endpoint available even if the durable write fails.
  }
}

function clientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/**
 * Returns true when this IP is allowed to post right now, and records the
 * attempt. Uses a short-TTL KV key per IP when a store is bound, otherwise an
 * in-process clock. A missing/erroring store never blocks a post.
 */
async function takeRateLimitSlot(
  store: ManifestCacheStore | undefined,
  ip: string,
): Promise<boolean> {
  const now = Date.now();
  if (!store) {
    const last = memoryRateLimit.get(ip) ?? 0;
    if (now - last < RATE_LIMIT_SECONDS * 1000) {
      return false;
    }
    memoryRateLimit.set(ip, now);
    return true;
  }

  const key = `willville:guestbook:rl:${ip}`;
  try {
    const existing = await store.get(key, { type: "text" });
    if (existing) {
      return false;
    }
    await store.put(key, String(now), { expirationTtl: RATE_LIMIT_SECONDS });
    return true;
  } catch {
    // If the rate-limit store is unavailable, fail open rather than blocking.
    return true;
  }
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function jsonResponse(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: withCorsHeaders(request, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    }),
  });
}

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: withCorsHeaders(request),
  });
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const entries = await readEntries(env.WILLVILLE_MANIFEST_CACHE);
  // Stored oldest-first; readers want the freshest signatures on top.
  const newestFirst = entries.slice(-READ_LIMIT).reverse();
  return jsonResponse(request, { entries: newestFirst });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid JSON payload" }, 400);
  }

  const body = (payload ?? {}) as { name?: unknown; message?: unknown };
  const message = sanitizeField(body.message, MAX_MESSAGE_LEN);
  if (!message) {
    return jsonResponse(request, { error: "A message is required." }, 400);
  }
  const name = sanitizeField(body.name, MAX_NAME_LEN) || DEFAULT_NAME;

  const store = env.WILLVILLE_MANIFEST_CACHE;
  const allowed = await takeRateLimitSlot(store, clientIp(request));
  if (!allowed) {
    return jsonResponse(
      request,
      { error: "You're signing a bit fast — give it a few seconds." },
      429,
    );
  }

  const entry: GuestbookEntry = {
    id: makeId(),
    name,
    message,
    at: new Date().toISOString(),
  };

  const entries = await readEntries(store);
  // Append newest at the end, then trim the oldest beyond the cap.
  const next = [...entries, entry].slice(-MAX_ENTRIES);
  await writeEntries(store, next);

  return jsonResponse(request, { entry }, 201);
};
