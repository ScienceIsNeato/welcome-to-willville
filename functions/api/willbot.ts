/**
 * POST /api/willbot — STUB.
 *
 * The chat endpoint behind the leviathan (components/WillbotChatPanel.tsx).
 * The real willbot brain is being built separately; until it lands, this
 * returns canned leviathan lines and marks every response `stub: true`.
 *
 * Contract the panel depends on (keep this stable when wiring the real bot):
 *
 *   Request:  { message: string }
 *   Response: { reply: string, stub?: boolean, generatedAt: string }
 *
 * The real implementation replaces pickCannedReply with the actual model
 * call; everything else (shape, CORS, no-store) should survive as-is.
 */

import { withCorsHeaders } from "./cors";

const CANNED_REPLIES = [
  "I heard that. I can't answer it yet — my brain is still in another repo, being assembled.",
  "The tide carries your words to me, and I file them under 'soon'. Willbot proper is on its way.",
  "Ten thousand merged boats have sailed past me and I remember none of them. That changes when my memory ships.",
  "For now I only float and listen. Ask me again after they finish the wiring.",
  "North of the shipping lanes, nothing is urgent. Your question is safe with me until I can think.",
];

function pickCannedReply(message: string): string {
  // Deterministic pick so the same question gets the same canned line —
  // makes the stub feel less random and is trivially testable.
  let h = 0;
  for (let i = 0; i < message.length; i += 1) {
    h = (h * 31 + message.charCodeAt(i)) >>> 0;
  }
  return CANNED_REPLIES[h % CANNED_REPLIES.length]!;
}

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

export const onRequestPost: PagesFunction = async ({ request }) => {
  let message = "";
  try {
    const payload = (await request.json()) as { message?: unknown };
    if (typeof payload.message === "string") {
      message = payload.message.trim();
    }
  } catch {
    // Fall through to the empty-message error below.
  }

  if (!message) {
    return jsonResponse(request, 400, {
      error: "Expected JSON body: { message: string }",
      stub: true,
    });
  }

  return jsonResponse(request, 200, {
    reply: pickCannedReply(message),
    stub: true,
    generatedAt: new Date().toISOString(),
  });
};

/** Health probe so the willbot agent can tell stub from real at a glance. */
export const onRequestGet: PagesFunction = async ({ request }) => {
  return jsonResponse(request, 200, {
    status: "stub",
    hint: "POST { message } for a canned reply. Real willbot not wired yet.",
  });
};
