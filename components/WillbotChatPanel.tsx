"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Chat with Willbot — STUB.
 *
 * The real willbot brain is being built separately. This panel owns the chat
 * UI and talks to POST /api/willbot, which currently returns canned leviathan
 * lines (and says so). When the real willbot lands, only the API's insides
 * change — the request/response contract here stays:
 *
 *   POST /api/willbot  { message: string }  →  { reply: string, stub?: boolean }
 */

type ChatMessage = {
  role: "visitor" | "willbot";
  text: string;
};

type Props = {
  mobileSafeMode: boolean;
  onClose: () => void;
};

const GREETING: ChatMessage = {
  role: "willbot",
  text:
    "You found me. I am the leviathan north of the shipping lanes — " +
    "willbot, mostly asleep while they finish building my brain. " +
    "Say something and I'll answer as best a stub can.",
};

export function WillbotChatPanel({ mobileSafeMode, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  async function send() {
    const message = draft.trim();
    if (!message || sending) return;
    setDraft("");
    setMessages((m) => [...m, { role: "visitor", text: message }]);
    setSending(true);
    try {
      const res = await fetch("/api/willbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const payload = (await res.json()) as { reply?: string };
      setMessages((m) => [
        ...m,
        {
          role: "willbot",
          text:
            payload.reply ??
            "…the deep swallowed that one. Try again in a moment.",
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "willbot",
          text: "…the deep swallowed that one. Try again in a moment.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <aside
      aria-label="Chat with Willbot"
      style={{
        position: "absolute",
        right: mobileSafeMode ? 8 : 18,
        bottom: mobileSafeMode ? 8 : 18,
        zIndex: 40,
        width: mobileSafeMode ? "calc(100% - 16px)" : 340,
        maxWidth: 380,
        display: "flex",
        flexDirection: "column",
        maxHeight: mobileSafeMode ? "55%" : 420,
        borderRadius: 10,
        overflow: "hidden",
        border: "2px solid var(--willville-ink)",
        backgroundColor: "var(--willville-paper)",
        color: "var(--willville-ink)",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.45)",
        fontSize: 13,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "8px 10px",
          backgroundColor: "var(--willville-ink)",
          color: "var(--willville-paper)",
        }}
      >
        <strong style={{ letterSpacing: 1 }}>
          WILLBOT{" "}
          <span style={{ opacity: 0.65, fontWeight: 400 }}>
            · harbor leviathan · stub
          </span>
        </strong>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Willbot chat"
          style={{
            border: "none",
            background: "transparent",
            color: "inherit",
            fontSize: 16,
            lineHeight: 1,
            cursor: "pointer",
            padding: 2,
          }}
        >
          ×
        </button>
      </header>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 120,
          overflowY: "auto",
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              alignSelf: msg.role === "visitor" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              padding: "6px 9px",
              borderRadius: 8,
              border: "1px solid var(--willville-ink)",
              backgroundColor:
                msg.role === "visitor" ? "rgba(42, 29, 16, 0.08)" : "#fdf8ec",
            }}
          >
            {msg.text}
          </div>
        ))}
        {sending && (
          <div style={{ alignSelf: "flex-start", opacity: 0.6 }}>
            the water stirs…
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        style={{
          display: "flex",
          gap: 6,
          padding: 8,
          borderTop: "1px solid var(--willville-ink)",
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Speak to the leviathan…"
          aria-label="Message for Willbot"
          style={{
            flex: 1,
            padding: "6px 8px",
            borderRadius: 6,
            border: "1px solid var(--willville-ink)",
            background: "#fffdf6",
            color: "inherit",
            font: "inherit",
          }}
        />
        <button
          type="submit"
          disabled={sending || draft.trim().length === 0}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid var(--willville-ink)",
            backgroundColor: "var(--willville-ink)",
            color: "var(--willville-paper)",
            cursor: sending ? "default" : "pointer",
            font: "inherit",
          }}
        >
          Send
        </button>
      </form>
    </aside>
  );
}
