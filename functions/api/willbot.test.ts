/**
 * Unit tests for the Will-bot proxy core (proxyWillbotChat / probeWillbot)
 * with fetch mocked — no server needed.
 *
 * Run: node --test functions/api/willbot.test.ts
 * (Node 23+ strips types natively; no test framework dependency.)
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CANNED_REPLIES,
  pickCannedReply,
  probeWillbot,
  proxyWillbotChat,
} from "./willbot-core.ts";

const ENV = {
  WILLBOT_URL: "http://willbot.test",
  WILLBOT_ACCESS_TOKEN: "test-token",
};

function fetchReturning(status: number, body: unknown): typeof fetch {
  return async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
}

test("success: forwards message, returns live reply without stub", async () => {
  let seen: { url?: string; init?: RequestInit } = {};
  const fetcher: typeof fetch = async (url, init) => {
    seen = { url: String(url), init };
    return new Response(
      JSON.stringify({ reply: "will here.", action: "reply" }),
      {
        status: 200,
      },
    );
  };
  const result = await proxyWillbotChat(
    { message: "who is this?", sessionId: "abc-123" },
    ENV,
    fetcher,
  );

  assert.equal(result.status, 200);
  assert.equal(result.payload.reply, "will here.");
  assert.equal(result.payload.stub, undefined);
  assert.equal(typeof result.payload.generatedAt, "string");

  assert.equal(seen.url, "http://willbot.test/api/chat");
  const headers = seen.init?.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer test-token");
  const sent = JSON.parse(String(seen.init?.body));
  assert.deepEqual(sent, {
    session_id: "abc-123",
    message: "who is this?",
    speak: true,
    stream: false,
  });
});

test("401 from will-bot: canned fallback with stub", async () => {
  const result = await proxyWillbotChat(
    { message: "hello", sessionId: "abc" },
    ENV,
    fetchReturning(401, { detail: "bad token" }),
  );
  assert.equal(result.status, 200);
  assert.equal(result.payload.stub, true);
  assert.equal(result.payload.reply, pickCannedReply("hello"));
});

test("timeout / network error: canned fallback with stub", async () => {
  const fetcher: typeof fetch = async () => {
    throw new DOMException("The operation timed out.", "TimeoutError");
  };
  const result = await proxyWillbotChat({ message: "slow?" }, ENV, fetcher);
  assert.equal(result.status, 200);
  assert.equal(result.payload.stub, true);
  assert.ok(CANNED_REPLIES.includes(String(result.payload.reply)));
});

test("missing secrets: canned fallback, no fetch attempted", async () => {
  const fetcher: typeof fetch = async () => {
    throw new Error("must not be called");
  };
  const result = await proxyWillbotChat(
    { message: "anyone home?" },
    {},
    fetcher,
  );
  assert.equal(result.status, 200);
  assert.equal(result.payload.stub, true);
});

test("empty message: 400, regardless of secrets", async () => {
  for (const body of [
    {},
    { message: "" },
    { message: "   " },
    { message: 7 },
  ]) {
    const result = await proxyWillbotChat(body, ENV, fetchReturning(200, {}));
    assert.equal(result.status, 400);
    assert.equal(result.payload.stub, true);
  }
});

test("invalid sessionId is replaced with a generated UUID", async () => {
  let sent: { session_id?: string } = {};
  const fetcher: typeof fetch = async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ reply: "ok" }), { status: 200 });
  };
  for (const bad of [undefined, "", "has space", "x".repeat(65), "emoji🦑"]) {
    await proxyWillbotChat({ message: "hi", sessionId: bad }, ENV, fetcher);
    assert.match(String(sent.session_id), /^[A-Za-z0-9-]{1,64}$/);
    assert.notEqual(sent.session_id, bad);
  }
});

test("over-long message is clamped to 4000 chars", async () => {
  let sent: { message?: string } = {};
  const fetcher: typeof fetch = async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ reply: "ok" }), { status: 200 });
  };
  const result = await proxyWillbotChat(
    { message: "x".repeat(5000), sessionId: "abc" },
    ENV,
    fetcher,
  );
  assert.equal(result.status, 200);
  assert.equal(result.payload.stub, undefined);
  assert.equal(sent.message?.length, 4000);
});

test("malformed reply body: canned fallback", async () => {
  for (const body of [{}, { reply: "" }, { reply: 42 }]) {
    const result = await proxyWillbotChat(
      { message: "hm", sessionId: "abc" },
      ENV,
      fetchReturning(200, body),
    );
    assert.equal(result.payload.stub, true);
  }
});

test("probe: live only on {ok:true}; stub on error/missing secrets", async () => {
  const live = await probeWillbot(ENV, fetchReturning(200, { ok: true }));
  assert.equal(live.status, "live");
  // Live probes carry the full-UI embed link (will-bot's own hash login).
  assert.equal(
    live.embedUrl,
    `${ENV.WILLBOT_URL}/#token=${ENV.WILLBOT_ACCESS_TOKEN}`,
  );
  assert.equal(
    (await probeWillbot(ENV, fetchReturning(200, { ok: false }))).status,
    "stub",
  );
  assert.equal(
    (await probeWillbot(ENV, fetchReturning(500, {}))).status,
    "stub",
  );
  const down = await probeWillbot(ENV, async () => {
    throw new Error("down");
  });
  assert.equal(down.status, "stub");
  assert.equal(down.embedUrl, undefined);
  const noSecrets = await probeWillbot({}, fetchReturning(200, { ok: true }));
  assert.equal(noSecrets.status, "stub");
  assert.equal(noSecrets.embedUrl, undefined);
});

test("voice: speak defaults true, audio+visemes pass through camelCased", async () => {
  let sent: { speak?: boolean } = {};
  const fetcher: typeof fetch = async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        reply: "hear me",
        audio_wav_b64: "UklGRg==",
        visemes: [
          [0.04, "AI"],
          [0.5, "rest"],
        ],
      }),
      { status: 200 },
    );
  };
  const result = await proxyWillbotChat(
    { message: "speak up", sessionId: "abc" },
    ENV,
    fetcher,
  );
  assert.equal(sent.speak, true);
  assert.equal(result.payload.audioWavB64, "UklGRg==");
  assert.deepEqual(result.payload.visemes, [
    [0.04, "AI"],
    [0.5, "rest"],
  ]);
});

test("voice: speak:false is forwarded; absent audio stays absent", async () => {
  let sent: { speak?: boolean } = {};
  const fetcher: typeof fetch = async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        reply: "text only",
        audio_wav_b64: null,
        visemes: null,
      }),
      { status: 200 },
    );
  };
  const result = await proxyWillbotChat(
    { message: "hush", sessionId: "abc", speak: false },
    ENV,
    fetcher,
  );
  assert.equal(sent.speak, false);
  assert.equal("audioWavB64" in result.payload, false);
  assert.equal("visemes" in result.payload, false);
});
