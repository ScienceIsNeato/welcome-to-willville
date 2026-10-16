/**
 * POST /api/willbot — proxy to the real Will-bot, with a canned fallback.
 *
 * Will-bot is a separate private service that answers in character as Will.
 * This function forwards the visitor's message to it (text-only for now —
 * voice is phase 2) and returns the reply verbatim. The persona is the
 * feature: nothing is added, filtered, or framed on this side.
 *
 * Browser contract (components/WillbotChatPanel.tsx depends on this):
 *
 *   Request:  { message: string, sessionId?: string }
 *   Response: { reply: string, stub?: boolean, generatedAt: string }
 *
 * Fallback: if the secrets are unset (production today), Will-bot is
 * unreachable, replies non-200, or takes longer than ~20s, the visitor gets
 * the canned leviathan lines with `stub: true`. Errors are never surfaced.
 *
 * Secrets (local .dev.vars only for now — production stays canned):
 *   WILLBOT_URL          e.g. http://127.0.0.1:8780
 *   WILLBOT_ACCESS_TOKEN bearer token; used only here, never sent to the
 *                        browser or logged.
 */

import { withCorsHeaders } from "./cors";
import {
  probeWillbot,
  proxyWillbotChat,
  type WillbotEnv,
} from "./willbot-core";

function jsonResponse(
  request: Request,
  status: number,
  body: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: withCorsHeaders(request, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    }),
  });
}

export const onRequestPost: PagesFunction<WillbotEnv> = async ({
  request,
  env,
}) => {
  let body: { message?: unknown; sessionId?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // Fall through — the proxy returns the 400 for a missing message.
  }
  const result = await proxyWillbotChat(body, env);
  return jsonResponse(request, result.status, result.payload);
};

/** Health probe: "live" when Will-bot is wired and answering, else "stub". */
export const onRequestGet: PagesFunction<WillbotEnv> = async ({
  request,
  env,
}) => {
  const status = await probeWillbot(env);
  return jsonResponse(request, 200, {
    status,
    hint:
      status === "live"
        ? "POST { message, sessionId? } to talk to Will."
        : "POST { message } for a canned reply. Will-bot not reachable from here.",
  });
};
