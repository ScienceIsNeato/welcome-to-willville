import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // Static export is only needed at build time. Omitting it in dev mode
  // allows rewrites so the Next.js dev server can proxy /api/* requests
  // to a running `wrangler pages dev` instance (npm run dev:cf).
  output: isDev ? undefined : "export",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  ...(isDev
    ? {
        rewrites: async () => ({
          beforeFiles: [
            {
              source: "/api/:path*",
              destination: `http://localhost:${process.env.WRANGLER_PORT ?? "3737"}/api/:path*`,
            },
          ],
        }),
      }
    : {}),
};

export default nextConfig;
