import type { Metadata } from "next";
import { DISTRICT_SLUGS } from "@/lib/slugs";
import { directoryDistrict } from "@/lib/willville.directory";

export const dynamicParams = false;

export function generateStaticParams() {
  return DISTRICT_SLUGS.map((district) => ({ district }));
}

// Unique per-district <head> so each district URL is a distinct, indexable page
// (previously every route shared the homepage title — ~15 duplicate pages to a
// crawler). The visible body stays the interactive town map; the project
// directory at /projects carries the crawlable text content.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ district: string }>;
}): Promise<Metadata> {
  const { district } = await params;
  const entry = directoryDistrict(district);
  if (!entry) return {};

  const names = entry.projects.map((p) => p.displayName).slice(0, 6);
  const projectClause =
    names.length === 0
      ? ""
      : ` Projects in ${entry.displayName}: ${names.join(", ")}${entry.projects.length > names.length ? ", and more" : ""}.`;
  const description = `${entry.blurb}${projectClause}`;
  const canonical = `/${district}/`;

  return {
    title: entry.displayName,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: `https://willville.ai${canonical}`,
      title: `${entry.displayName} · Willville`,
      description,
    },
  };
}

export default function DistrictPage() {
  return null;
}
