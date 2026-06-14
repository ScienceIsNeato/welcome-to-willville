import type { MetadataRoute } from "next";
import { DISTRICT_SLUGS } from "@/lib/slugs";

// Static export: emits out/sitemap.xml at build (the live site currently 404s
// on /sitemap.xml). Lists the town square, the crawlable project directory, and
// every district page so search + AI crawlers can discover the full structure.
export const dynamic = "force-static";

const BASE = "https://willville.ai";
const LASTMOD = new Date().toISOString().split("T")[0];

export default function sitemap(): MetadataRoute.Sitemap {
  const home = {
    url: `${BASE}/`,
    lastModified: LASTMOD,
    changeFrequency: "weekly" as const,
    priority: 1.0,
  };

  const directory = {
    url: `${BASE}/projects/`,
    lastModified: LASTMOD,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  };

  const faq = {
    url: `${BASE}/faq/`,
    lastModified: LASTMOD,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  };

  const districts = DISTRICT_SLUGS.map((slug) => ({
    url: `${BASE}/${slug}/`,
    lastModified: LASTMOD,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [home, directory, faq, ...districts];
}
