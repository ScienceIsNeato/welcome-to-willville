/**
 * Mayor credential: an HMAC-signed cookie, not a forgeable fixed value.
 *
 * `/api/auth/keys` validates WILLVILLE_MAYOR_KEY server-side and then issues a
 * cookie whose value is HMAC-SHA256(key, "mayor-v1"). Readers (currently
 * /api/canal) recompute that MAC and compare in constant time, so a caller who
 * doesn't know the key can't mint a valid cookie — and the raw key never leaves
 * the server after login. Bump the MAC label to invalidate all sessions.
 */

export interface MayorEnv {
  WILLVILLE_MAYOR_KEY?: string;
}

const COOKIE_NAME = "willville_mayor";
const MAC_LABEL = "mayor-v1";

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function mayorToken(key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(MAC_LABEL));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Serialized Set-Cookie for a validated mayor, or null if no key is configured. */
export async function issueMayorCookie(env: MayorEnv): Promise<string | null> {
  if (!env.WILLVILLE_MAYOR_KEY) return null;
  const token = await mayorToken(env.WILLVILLE_MAYOR_KEY);
  return [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
    `Max-Age=${60 * 60 * 24 * 30}`,
  ].join("; ");
}

/** True only when the request carries a cookie whose MAC matches the key. */
export async function isMayorRequest(
  request: Request,
  env: MayorEnv,
): Promise<boolean> {
  if (!env.WILLVILLE_MAYOR_KEY) return false;
  const cookie = request.headers.get("Cookie") ?? "";
  const entry = cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!entry) return false;
  const value = entry.slice(COOKIE_NAME.length + 1);
  if (value.length === 0) return false;
  const expected = await mayorToken(env.WILLVILLE_MAYOR_KEY);
  return constantTimeEqual(value, expected);
}
