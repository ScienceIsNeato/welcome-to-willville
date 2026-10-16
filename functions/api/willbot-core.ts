/**
 * Will-bot proxy core — pure logic, no HTTP framing, no imports, so it can be
 * unit-tested with Node's built-in runner (fetch injected). The Pages
 * Function in willbot.ts wraps this with request parsing + CORS.
 */

export type WillbotEnv = {
  WILLBOT_URL?: string;
  WILLBOT_ACCESS_TOKEN?: string;
};

/** Will-bot rejects messages beyond 4000 chars; clamp instead of erroring. */
const MAX_MESSAGE_CHARS = 4000;
const CHAT_TIMEOUT_MS = 20_000;
const HEALTH_TIMEOUT_MS = 3_000;
const SESSION_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

export const CANNED_REPLIES = [
  "I heard that. I can't answer it yet — my brain is still in another repo, being assembled.",
  "The tide carries your words to me, and I file them under 'soon'. Willbot proper is on its way.",
  "Ten thousand merged boats have sailed past me and I remember none of them. That changes when my memory ships.",
  "For now I only float and listen. Ask me again after they finish the wiring.",
  "North of the shipping lanes, nothing is urgent. Your question is safe with me until I can think.",
];

/** Deterministic canned pick — same question, same line; trivially testable. */
export function pickCannedReply(message: string): string {
  let h = 0;
  for (let i = 0; i < message.length; i += 1) {
    h = (h * 31 + message.charCodeAt(i)) >>> 0;
  }
  return CANNED_REPLIES[h % CANNED_REPLIES.length]!;
}

type ProxyResult = {
  status: number;
  payload: Record<string, unknown>;
};

function cannedResult(message: string): ProxyResult {
  return {
    status: 200,
    payload: {
      reply: pickCannedReply(message),
      stub: true,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Core proxy, pure of HTTP framing: takes the parsed request body and an
 * injectable fetch so tests can simulate success / 401 / timeout / missing
 * secrets without a server.
 */
export async function proxyWillbotChat(
  body: { message?: unknown; sessionId?: unknown },
  env: WillbotEnv,
  fetcher: typeof fetch = fetch,
): Promise<ProxyResult> {
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return {
      status: 400,
      payload: {
        error: "Expected JSON body: { message: string }",
        stub: true,
      },
    };
  }

  const sessionId =
    typeof body.sessionId === "string" &&
    SESSION_ID_PATTERN.test(body.sessionId)
      ? body.sessionId
      : crypto.randomUUID();

  if (!env.WILLBOT_URL || !env.WILLBOT_ACCESS_TOKEN) {
    return cannedResult(message);
  }

  try {
    const res = await fetcher(`${env.WILLBOT_URL}/api/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WILLBOT_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId,
        message: message.slice(0, MAX_MESSAGE_CHARS),
        speak: false,
        stream: false,
      }),
      signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    });
    if (!res.ok) {
      return cannedResult(message);
    }
    const data = (await res.json()) as { reply?: unknown };
    if (typeof data.reply !== "string" || data.reply.length === 0) {
      return cannedResult(message);
    }
    return {
      status: 200,
      payload: {
        reply: data.reply,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch {
    // Timeout, refused connection, bad JSON — the visitor never sees it.
    return cannedResult(message);
  }
}

/** Probe Will-bot's health endpoint; "live" only on a confirmed {ok:true}. */
export async function probeWillbot(
  env: WillbotEnv,
  fetcher: typeof fetch = fetch,
): Promise<"live" | "stub"> {
  if (!env.WILLBOT_URL || !env.WILLBOT_ACCESS_TOKEN) {
    return "stub";
  }
  try {
    const res = await fetcher(`${env.WILLBOT_URL}/healthz`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    if (!res.ok) return "stub";
    const data = (await res.json()) as { ok?: unknown };
    return data.ok === true ? "live" : "stub";
  } catch {
    return "stub";
  }
}
