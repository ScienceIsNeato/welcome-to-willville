"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  speakWillbotReply,
  stopWillbotSpeech,
  type VisemeFrame,
} from "@/lib/willbot-speech";

/**
 * Chat with Willbot — STUB.
 *
 * The real willbot brain is being built separately. This panel owns the chat
 * UI and talks to POST /api/willbot, which currently returns canned leviathan
 * lines (and says so). When the real willbot lands, only the API's insides
 * change — the request/response contract here stays:
 *
 *   POST /api/willbot  { message: string }  →  { reply: string, stub?: boolean }
 *
 * The panel surfaces right below the leviathan (TownStage computes the spot
 * from the beast's on-screen position at click time) and can be dragged
 * anywhere in the stage by its header. Dragging is plain left/top state —
 * the panel doesn't track the map camera after it opens, which is the point:
 * grab it and park it wherever it isn't in the way.
 */

type ChatMessage = {
  role: "visitor" | "willbot";
  text: string;
};

type Props = {
  /** Where to surface, in stage-relative pixels (below the leviathan). */
  initialPosition: { left: number; top: number };
  onClose: () => void;
};

export const WILLBOT_PANEL_WIDTH = 400;

const GREETING: ChatMessage = {
  role: "willbot",
  text:
    "You found me. I am the leviathan north of the shipping lanes. " +
    "Say something.",
};

const SESSION_STORAGE_KEY = "willbot-session-id";

/**
 * One Will-bot session per browser tab: Will's memory is keyed by session id,
 * so a reload keeps the conversation (sessionStorage survives it) while a new
 * tab starts fresh. sessionStorage can throw (private windows, blocked
 * storage) — then the id just lives for this mount.
 */
function obtainSessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function WillbotChatPanel({ initialPosition, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  // null = unknown (no badge yet); the mount probe below resolves it before
  // the visitor sends anything, and each reply keeps it current after that.
  const [stubMode, setStubMode] = useState<boolean | null>(null);
  // When the probe hands back Will-bot's own UI, embed the real thing —
  // face, Talk mic, voice — instead of this panel's text chat.
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  // Voice on by default; muting also silences any speech mid-sentence.
  const [muted, setMuted] = useState(false);
  const [position, setPosition] = useState(initialPosition);
  const [sessionId] = useState(obtainSessionId);
  const panelRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null);

  // Re-anchor if the leviathan is clicked again while the panel is open —
  // state adjustment during render (not an effect) per the React docs, so
  // the drag position resets without a cascading render or losing messages.
  const [lastAnchor, setLastAnchor] = useState(initialPosition);
  if (lastAnchor !== initialPosition) {
    setLastAnchor(initialPosition);
    setPosition(initialPosition);
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  // Closing the panel cuts Will off mid-sentence; the mouth rests.
  useEffect(() => stopWillbotSpeech, []);

  // The embed panel is much taller than the text chat it replaces; after the
  // embed commit has painted (effect + rAF, so the 620px height is real),
  // pull the panel fully back inside the stage so Will-bot's Talk controls
  // aren't cut off below the fold.
  useEffect(() => {
    if (!embedUrl) return;
    const id = requestAnimationFrame(() => {
      setPosition((p) => {
        const panel = panelRef.current;
        const parent = panel?.offsetParent as HTMLElement | null;
        if (!panel || !parent) return p;
        return {
          left: Math.min(
            Math.max(0, p.left),
            Math.max(0, parent.clientWidth - panel.offsetWidth),
          ),
          top: Math.min(
            Math.max(0, p.top),
            Math.max(0, parent.clientHeight - panel.offsetHeight - 8),
          ),
        };
      });
    });
    return () => cancelAnimationFrame(id);
  }, [embedUrl]);

  // Ask the proxy whether Will is actually on the line, so the header badge
  // is honest from the first moment — and when he is, take the full UI.
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/willbot")
      .then((res) => res.json())
      .then((data: { status?: string; embedUrl?: string }) => {
        if (cancelled) return;
        setStubMode(data.status !== "live");
        setEmbedUrl(
          data.status === "live" && typeof data.embedUrl === "string"
            ? data.embedUrl
            : null,
        );
      })
      .catch(() => {
        if (!cancelled) setStubMode(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function clampToParent(left: number, top: number) {
    const panel = panelRef.current;
    const parent = panel?.offsetParent as HTMLElement | null;
    if (!panel || !parent) return { left, top };
    return {
      left: Math.min(
        Math.max(0, left),
        Math.max(0, parent.clientWidth - panel.offsetWidth),
      ),
      top: Math.min(Math.max(0, top), Math.max(0, parent.clientHeight - 48)),
    };
  }

  function onDragStart(e: ReactPointerEvent<HTMLElement>) {
    dragOffset.current = {
      dx: e.clientX - position.left,
      dy: e.clientY - position.top,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onDragMove(e: ReactPointerEvent<HTMLElement>) {
    const offset = dragOffset.current;
    if (!offset) return;
    setPosition(clampToParent(e.clientX - offset.dx, e.clientY - offset.dy));
  }

  function onDragEnd(e: ReactPointerEvent<HTMLElement>) {
    dragOffset.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

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
        body: JSON.stringify({ message, sessionId, speak: !muted }),
      });
      const payload = (await res.json()) as {
        reply?: string;
        stub?: boolean;
        audioWavB64?: string;
        visemes?: VisemeFrame[];
      };
      if (payload.reply) {
        setStubMode(Boolean(payload.stub));
      }
      if (payload.audioWavB64 && !muted) {
        // Fire and forget: the leviathan's mouth follows via the speech bus.
        void speakWillbotReply(payload.audioWavB64, payload.visemes);
      }
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
      ref={panelRef}
      aria-label="Chat with Willbot"
      // The camera hook attaches NATIVE pointer listeners to the stage div,
      // which run before React's synthetic handlers — so stopPropagation alone
      // can't keep a panel drag from also panning the map. data-no-pan is the
      // camera's own opt-out (useTownCamera checks event.target.closest).
      data-no-pan="true"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        left: position.left,
        top: position.top,
        zIndex: 40,
        width: `min(${WILLBOT_PANEL_WIDTH}px, calc(100vw - 16px))`,
        display: "flex",
        flexDirection: "column",
        // The embedded Will-bot UI (face + Talk controls) needs real estate;
        // the text fallback keeps its compact chat height.
        height: embedUrl ? "min(620px, 78vh)" : undefined,
        maxHeight: embedUrl ? undefined : 420,
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
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "8px 10px",
          backgroundColor: "var(--willville-ink)",
          color: "var(--willville-paper)",
          cursor: "grab",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        <strong style={{ letterSpacing: 1 }}>
          WILLBOT{" "}
          <span style={{ opacity: 0.65, fontWeight: 400 }}>
            · harbor leviathan{stubMode === true ? " · stub" : ""}
          </span>
        </strong>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {/* Will-bot's own UI has its voice/face toggles; the mute button
              belongs to the text fallback only. */}
          {!embedUrl && (
            <button
              type="button"
              onClick={() => {
                setMuted((m) => {
                  if (!m) stopWillbotSpeech();
                  return !m;
                });
              }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={muted ? "Unmute Will's voice" : "Mute Will's voice"}
              aria-pressed={muted}
              title={muted ? "Voice off" : "Voice on"}
              style={{
                border: "none",
                background: "transparent",
                color: "inherit",
                fontSize: 13,
                lineHeight: 1,
                cursor: "pointer",
                padding: 2,
                opacity: muted ? 0.5 : 1,
              }}
            >
              {muted ? "🔇" : "🔊"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
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
        </span>
      </header>

      {embedUrl && (
        /* The real Will-bot: his own UI — animated face, Talk mic, voice —
           served by the will-bot service and embedded whole. allow grants
           the mic (Talk button) and audio autoplay inside the frame. */
        <iframe
          src={embedUrl}
          title="Will-bot"
          allow="microphone; autoplay"
          style={{
            flex: 1,
            width: "100%",
            border: "none",
            backgroundColor: "#111",
          }}
        />
      )}

      {!embedUrl && (
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
      )}

      {!embedUrl && (
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
      )}
    </aside>
  );
}
