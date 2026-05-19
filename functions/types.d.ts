/**
 * Shared TypeScript ambient types for Cloudflare Pages Functions.
 * Lives outside the Next.js app so it doesn't pollute the React types.
 */

declare global {
  type PagesFunction<E = unknown> = (context: {
    request: Request;
    env: E;
    waitUntil: (p: Promise<unknown>) => void;
  }) => Response | Promise<Response>;
}

export {};
