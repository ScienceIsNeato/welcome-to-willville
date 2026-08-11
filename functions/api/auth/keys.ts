/**
 * POST/GET /api/auth/keys?key=<WILLVILLE_MAYOR_KEY>
 *
 * Validates the provided key against the configured secret. On success,
 * sets a long-lived signed cookie that unlocks Mayor-only views of /api/town.
 */
import { issueMayorCookie, type MayorEnv } from "../mayor-auth";

type Env = MayorEnv;

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

const handle: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const provided = url.searchParams.get("key") ?? "";
  const expected = env.WILLVILLE_MAYOR_KEY ?? "";
  if (!expected || !constantTimeEqual(provided, expected)) {
    return new Response(JSON.stringify({ mayor: false }), {
      status: 401,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
  // Signed cookie (HMAC of the key) rather than a forgeable fixed value.
  const cookie = (await issueMayorCookie(env))!;
  return new Response(JSON.stringify({ mayor: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": cookie,
      "Cache-Control": "no-store",
    },
  });
};

export const onRequestGet = handle;
export const onRequestPost = handle;
