const ALLOWED_ORIGINS = new Set([
  "https://willville.ai",
  "https://www.willville.ai",
  "https://welcome-to-willville.pages.dev",
]);

function appendVary(current: string | null, value: string): string {
  const parts = new Set(
    (current ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
  parts.add(value);
  return Array.from(parts).join(", ");
}

export function withCorsHeaders(
  request: Request,
  headers: HeadersInit = {},
): Headers {
  const next = new Headers(headers);
  const origin = request.headers.get("Origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return next;
  }

  next.set("Access-Control-Allow-Origin", origin);
  next.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  next.set("Access-Control-Allow-Headers", "Content-Type");
  next.set("Vary", appendVary(next.get("Vary"), "Origin"));
  return next;
}
