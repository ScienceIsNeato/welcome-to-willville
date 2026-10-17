/**
 * POST /api/willbot — proxy to the real Will-bot, with a canned fallback.
 *
 * Will-bot is a separate private service that answers in character as Will.
 * This function forwards the visitor's message to it — voice on by default,
 * `speak: false` for text-only — and returns the reply verbatim. The persona
 * is the feature: nothing is added, filtered, or framed on this side.
 *
 * Browser contract (components/WillbotChatPanel.tsx depends on this):
 *
 *   Request:  { message: string, sessionId?: string, speak?: boolean }
 *   Response: { reply: string, stub?: boolean, generatedAt: string,
 *               audioWavB64?: string,            // base64 WAV of Will's voice
 *               visemes?: [number, string][] }   // mouth shapes timed to it
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
  let body: { message?: unknown; sessionId?: unknown; speak?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // Fall through — the proxy returns the 400 for a missing message.
  }
  const result = await proxyWillbotChat(body, env);
  return jsonResponse(request, result.status, result.payload);
};

/**
 * Health probe: "live" when Will-bot is wired and answering, else "stub".
 * Live responses carry embedUrl — the full Will-bot UI for the panel's
 * iframe. Must never be cached: it is per-deployment state and, locally,
 * the embed link carries Will-bot's own UI login token.
 */
export const onRequestGet: PagesFunction<WillbotEnv> = async ({
  request,
  env,
}) => {
  const probe = await probeWillbot(env);
  return jsonResponse(request, 200, {
    status: probe.status,
    ...(probe.embedUrl && { embedUrl: probe.embedUrl }),
    hint:
      probe.status === "live"
        ? "POST { message, sessionId? } to talk to Will, or embed embedUrl for the full experience."
        : "POST { message } for a canned reply. Will-bot not reachable from here.",
  });
};
