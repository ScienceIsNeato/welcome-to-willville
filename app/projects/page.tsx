import type { Metadata } from "next";
import Link from "next/link";
import { buildDirectory } from "@/lib/willville.directory";

export const metadata: Metadata = {
  title: "Project Directory",
  description:
    "Every project in Willville, grouped by district — with links to each live site and its source repo. A crawlable index of Will's work across AI, code quality, web, writing, and Halloween projects.",
  alternates: { canonical: "/projects/" },
  openGraph: {
    type: "website",
    url: "https://willville.ai/projects/",
    title: "Willville Project Directory",
    description:
      "Every project in Willville, grouped by district, with links to each live site and source repo.",
  },
};

const directory = buildDirectory();

// CollectionPage + ItemList so AI search / rich results can read the portfolio
// as a structured list of works with their live URLs.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Willville Project Directory",
  url: "https://willville.ai/projects/",
  description:
    "Every project in Willville, grouped by district, with links to each live site and source repo.",
  mainEntity: {
    "@type": "ItemList",
    itemListElement: directory
      .flatMap((d) => d.projects)
      .filter((p) => p.liveUrl)
      .map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: p.displayName,
        url: p.liveUrl,
        description: p.blurb,
      })),
  },
};

export default function ProjectsDirectory() {
  return (
    <main
      style={{
        pointerEvents: "auto",
        position: "absolute",
        inset: 0,
        overflowY: "auto",
        background: "#0d0b14",
        color: "#e7e3f0",
        font: "16px/1.6 system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div
        style={{ maxWidth: 820, margin: "0 auto", padding: "48px 24px 96px" }}
      >
        <p style={{ margin: "0 0 8px" }}>
          <Link href="/" style={{ color: "#9d8cff", textDecoration: "none" }}>
            ← Back to the town
          </Link>
        </p>
        <h1 style={{ fontSize: 34, margin: "0 0 8px", lineHeight: 1.2 }}>
          Willville Project Directory
        </h1>
        <p style={{ margin: "0 0 40px", color: "#b3acc6", maxWidth: 640 }}>
          Willville is a visual town where each of Will&rsquo;s projects lives
          in a district. This is the readable index of that town — every
          project, where it lives, what it does, and links to the live site and
          the source repo.
        </p>

        {directory.map((district) => (
          <section
            key={district.id}
            style={{ marginBottom: 44 }}
            aria-labelledby={`district-${district.id}`}
          >
            <h2
              id={`district-${district.id}`}
              style={{ fontSize: 22, margin: "0 0 4px" }}
            >
              <Link
                href={`/${district.id}/`}
                style={{ color: "#e7e3f0", textDecoration: "none" }}
              >
                {district.displayName}
              </Link>
            </h2>
            <p style={{ margin: "0 0 16px", color: "#8f88a6", fontSize: 15 }}>
              {district.blurb}
            </p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {district.projects.map((p) => (
                <li
                  key={p.repo}
                  style={{
                    padding: "14px 0",
                    borderTop: "1px solid #221d33",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{p.displayName}</div>
                  {p.blurb && (
                    <div style={{ color: "#b3acc6", fontSize: 15 }}>
                      {p.blurb}
                    </div>
                  )}
                  <div style={{ marginTop: 6, fontSize: 14 }}>
                    {p.liveUrl && (
                      <a
                        href={p.liveUrl}
                        style={{ color: "#9d8cff", marginRight: 16 }}
                      >
                        Visit site ↗
                      </a>
                    )}
                    {p.repoIsPublic ? (
                      <a
                        href={p.repoUrl}
                        rel="nofollow"
                        style={{ color: "#7d7694" }}
                      >
                        Source ↗
                      </a>
                    ) : (
                      <span style={{ color: "#8f88a6" }}>Private repo</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
