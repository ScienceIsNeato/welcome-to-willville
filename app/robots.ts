import type { MetadataRoute } from "next";

// Static export: emits out/robots.txt at build. Replaces Cloudflare's injected
// boilerplate (which carried no Sitemap directive). All crawlers — including AI
// search bots (OAI-SearchBot, PerplexityBot, etc.) — are allowed via "*".
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: "https://willville.ai/sitemap.xml",
    host: "https://willville.ai",
  };
}
