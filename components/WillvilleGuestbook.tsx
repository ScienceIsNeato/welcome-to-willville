"use client";

/**
 * The Willville Guest Book — an open logbook pinned to the Town Forum board.
 *
 * Any visitor can sign it and leave a note; there's no auth and no account.
 * Reads the book on mount, lets a visitor add an entry, and optimistically
 * drops the new note to the top of the list. Talks to GET/POST /api/guestbook
 * through fetchApiRoute so it still resolves on the willville.ai → pages.dev
 * fallback path.
 */

import { useCallback, useEffect, useState } from "react";
import { fetchApiRoute } from "./townStageUtils";

type GuestbookEntry = {
  id: string;
  name: string;
  message: string;
  at: string;
};

const MAX_NAME_LEN = 40;
const MAX_MESSAGE_LEN = 500;
const NOTE_ROTATIONS = [-1.6, 1.3, -0.7, 1.1, -1.2, 0.8];

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

export function WillvilleGuestbook() {
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Open the book on mount. State is only touched after the await resolves, so
  // nothing fires synchronously inside the effect body; `loading` already
  // starts true, so the spinner shows until the first read lands.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetchApiRoute("/api/guestbook");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as { entries?: GuestbookEntry[] };
        if (cancelled) return;
        setEntries(Array.isArray(data.entries) ? data.entries : []);
      } catch {
        if (cancelled) return;
        setLoadError("Couldn't open the book right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const trimmedMessage = message.trim();
      if (!trimmedMessage || submitting) return;

      setSubmitting(true);
      setSubmitError(null);
      try {
        const response = await fetchApiRoute("/api/guestbook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), message: trimmedMessage }),
        });
        if (response.status === 429) {
          throw new Error("You're signing a bit fast — give it a few seconds.");
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as { entry?: GuestbookEntry };
        if (data.entry) {
          setEntries((prev) => [data.entry as GuestbookEntry, ...prev]);
        }
        setMessage("");
      } catch (error) {
        setSubmitError(
          error instanceof Error
            ? error.message
            : "Couldn't sign the book just now.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [message, name, submitting],
  );

  const canSubmit = message.trim().length > 0 && !submitting;

  return (
    <section
      aria-label="Guest book"
      style={{
        marginTop: 14,
        position: "relative",
        zIndex: 1,
        border: "1px solid rgba(82, 52, 30, 0.5)",
        borderRadius: 9,
        background:
          "linear-gradient(180deg, rgba(250, 241, 222, 0.97), rgba(235, 217, 184, 0.95))",
        padding: "12px 13px 13px",
        boxShadow:
          "0 3px 0 rgba(49,31,20,0.22), 0 8px 16px rgba(32,20,12,0.22)",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: -6,
          left: "50%",
          transform: "translateX(-50%)",
          width: 11,
          height: 11,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 32% 28%, #fbf2e4 0%, #d6bf9f 42%, #815b39 100%)",
          boxShadow: "0 1px 1px rgba(18, 9, 3, 0.46)",
          border: "1px solid rgba(73, 45, 23, 0.65)",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            textTransform: "uppercase",
            letterSpacing: 0.8,
            color: "#4a311f",
          }}
        >
          Guest Book
        </h3>
        <span
          style={{
            fontSize: 11,
            color: "rgba(76, 48, 28, 0.75)",
          }}
        >
          Sign in — say whatever you want.
        </span>
      </div>

      <form onSubmit={handleSubmit} style={{ marginBottom: 10 }}>
        <input
          type="text"
          value={name}
          maxLength={MAX_NAME_LEN}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name (optional)"
          aria-label="Your name"
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "1px solid rgba(96, 64, 38, 0.5)",
            borderRadius: 6,
            background: "rgba(255, 252, 244, 0.9)",
            color: "#3a2516",
            fontSize: 12,
            padding: "7px 9px",
            marginBottom: 6,
          }}
        />
        <textarea
          value={message}
          maxLength={MAX_MESSAGE_LEN}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Leave a note for the town…"
          aria-label="Your message"
          rows={2}
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "1px solid rgba(96, 64, 38, 0.5)",
            borderRadius: 6,
            background: "rgba(255, 252, 244, 0.9)",
            color: "#3a2516",
            fontSize: 12,
            lineHeight: 1.4,
            padding: "7px 9px",
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginTop: 6,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: submitError
                ? "rgba(150, 46, 28, 0.95)"
                : "rgba(76, 48, 28, 0.7)",
            }}
          >
            {submitError ?? `${message.trim().length}/${MAX_MESSAGE_LEN}`}
          </span>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              border: "1px solid rgba(73, 45, 23, 0.7)",
              borderRadius: 6,
              background: canSubmit
                ? "linear-gradient(180deg, #a9763f, #8a5b2f)"
                : "rgba(150, 120, 88, 0.55)",
              color: "#fff1d0",
              fontSize: 12,
              fontWeight: 700,
              padding: "7px 14px",
              cursor: canSubmit ? "pointer" : "default",
            }}
          >
            {submitting ? "Signing…" : "Sign the book"}
          </button>
        </div>
      </form>

      <div
        style={{
          maxHeight: 220,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          paddingRight: 2,
        }}
      >
        {loading ? (
          <p style={{ margin: 0, fontSize: 12, color: "rgba(76,48,28,0.8)" }}>
            Opening the book…
          </p>
        ) : loadError ? (
          <p style={{ margin: 0, fontSize: 12, color: "rgba(150,46,28,0.95)" }}>
            {loadError}
          </p>
        ) : entries.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: "rgba(76,48,28,0.8)" }}>
            No one&apos;s signed yet — be the first.
          </p>
        ) : (
          entries.map((entry, index) => (
            <article
              key={entry.id}
              style={{
                border: "1px solid rgba(90, 62, 38, 0.4)",
                borderRadius: 6,
                background: "rgba(255, 250, 240, 0.92)",
                padding: "8px 9px",
                boxShadow: "0 2px 0 rgba(49,31,20,0.16)",
                transform: `rotate(${
                  NOTE_ROTATIONS[index % NOTE_ROTATIONS.length]
                }deg)`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 3,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#4a311f",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {entry.name}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: "rgba(76, 48, 28, 0.65)",
                    flexShrink: 0,
                  }}
                >
                  {relativeTime(entry.at)}
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  lineHeight: 1.4,
                  color: "rgba(60, 38, 22, 0.95)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {entry.message}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
