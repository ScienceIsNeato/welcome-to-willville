"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Tiny landing page that takes ?key=... from the URL, hands it to
 * /api/auth/keys, and on success redirects back to the Town Square with the
 * Mayor cookie set.
 */
export default function KeysToTheCity() {
  return (
    <Suspense
      fallback={<KeysOverlay message="Trying the key in the lock..." />}
    >
      <KeysInner />
    </Suspense>
  );
}

function KeysInner() {
  const router = useRouter();
  const params = useSearchParams();
  const key = params?.get("key") ?? "";
  const [message, setMessage] = useState("Trying the key in the lock...");

  useEffect(() => {
    if (!key) return;
    fetch(`/api/auth/keys?key=${encodeURIComponent(key)}`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (r) => {
        if (r.ok) {
          setMessage("Keys to the city granted. Welcome home, Mayor.");
          setTimeout(() => router.push("/"), 800);
        } else {
          setMessage("That key doesn't fit. The constables are watching you.");
        }
      })
      .catch(() =>
        setMessage("The lock didn't answer. Try again in a moment."),
      );
  }, [key, router]);

  if (!key) {
    return (
      <KeysOverlay message="No key provided. Append ?key=... to this URL." />
    );
  }

  return <KeysOverlay message={message} />;
}

function KeysOverlay({ message }: { message: string }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          background: "rgba(245,230,200,0.97)",
          color: "var(--willville-ink)",
          padding: "24px 28px",
          borderRadius: 8,
          maxWidth: 420,
          textAlign: "center",
          fontFamily: "var(--font-sans), serif",
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: 2,
            textTransform: "uppercase",
            opacity: 0.6,
          }}
        >
          Willville Town Hall
        </div>
        <h1 style={{ fontSize: 22, margin: "8px 0 12px" }}>Keys to the City</h1>
        <p style={{ fontSize: 14, lineHeight: 1.5 }}>{message}</p>
      </div>
    </div>
  );
}
