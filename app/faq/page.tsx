import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ – Willville",
  description:
    "What is Willville? What are the ships? How does the bell work? Answers to the most common questions about the living town map.",
  alternates: { canonical: "/faq/" },
  openGraph: {
    type: "website",
    url: "https://willville.ai/faq/",
    title: "FAQ – Willville",
    description:
      "What is Willville? What are the ships? How does the bell work?",
  },
};

type QA = { q: string; a: string };

const FAQS: QA[] = [
  {
    q: "What is Willville?",
    a: "A living town map of Will's software projects. Each repo is a stop on the map — it gets a district, a sprite, and a name. The whole thing runs at willville.ai and updates in real time as pull requests ship.",
  },
  {
    q: "What are the ships in the water?",
    a: "Every ship is a pull request. When a repo ships a PR, a boat launches from its stop on the canal, travels west to east at about 30 pixels per real day, and eventually sails out to open sea. Two years of history are loaded at once — that's why there's an armada.",
  },
  {
    q: "What's the bell for?",
    a: "Ringing the bell triggers a live sweep of every tracked repo: pulls fresh PR history, updates board health scores, and reports what's moved since the last ring. After a fresh ring the boats reflect current state.",
  },
  {
    q: "What are the districts?",
    a: "Districts group stops by theme. The Graveyard is for projects no longer actively worked on. The Zeitgeist is public-facing work. Mirrored Mile is writing projects. Slop Wharf is everything slopmop-related. Gates of Hell is Halloween and ganglia projects. Ally Alley is projects Will contributes to but doesn't own. Halls of Judgement is AI training gigs. The Nursery is new projects just getting started. Town Square is the main socializing hub. Each district has its own art style.",
  },
  {
    q: "What is the Mayor's Express?",
    a: "The numbered board in the top corner shows the hottest currently-active repos ranked by recent activity. Clicking a number jumps the camera straight to that stop.",
  },
  {
    q: "What is Time Central Station?",
    a: "The large scrolling board at the top of the map. It shows live repo health scores — activity, stars, and open PR counts — ranked by who's been busiest. It updates every bell ring.",
  },
  {
    q: "How do I navigate?",
    a: "Scroll to zoom, drag to pan, double-click to zoom in on a spot. On mobile, pinch-zoom works too. Click any stop to pull up its detail board with repo stats and recent activity.",
  },
  {
    q: "What's the History timelapse?",
    a: "Click the clock icon (or visit /history) to open Time Central's history mode. Scrub the slider or hit play to replay the canal at any speed and watch two years of boat launches animate in order.",
  },
  {
    q: "Can I see the full project list without the map?",
    a: "Yes — /projects has a plain readable index of every stop, grouped by district, with links to the live sites and source repos. Useful if you just want to browse the portfolio.",
  },
  {
    q: "Who made this?",
    a: "Will Martin. Willville started as a personal force multiplier — a way to see everything in flight at a glance — and grew into a public portfolio. The source is on GitHub under ScienceIsNeato/welcome-to-willville.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

export default function FaqPage() {
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
        style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 96px" }}
      >
        <p style={{ margin: "0 0 8px" }}>
          <Link href="/" style={{ color: "#9d8cff", textDecoration: "none" }}>
            ← Back to the town
          </Link>
        </p>
        <h1 style={{ fontSize: 34, margin: "0 0 8px", lineHeight: 1.2 }}>
          Frequently Asked Questions
        </h1>
        <p style={{ margin: "0 0 48px", color: "#b3acc6", maxWidth: 560 }}>
          Everything you wanted to know about Willville but were afraid to ask
          the bell.
        </p>

        <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {FAQS.map(({ q, a }, i) => (
            <li
              key={i}
              style={{
                borderTop: "1px solid #1e1a2e",
                padding: "28px 0",
              }}
            >
              <h2
                style={{
                  margin: "0 0 10px",
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#e7e3f0",
                  lineHeight: 1.3,
                }}
              >
                {q}
              </h2>
              <p style={{ margin: 0, color: "#b3acc6", fontSize: 15 }}>{a}</p>
            </li>
          ))}
        </ol>

        <div
          style={{
            borderTop: "1px solid #1e1a2e",
            paddingTop: 40,
            marginTop: 8,
            display: "flex",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <Link href="/projects/" style={{ color: "#9d8cff" }}>
            Project directory ↗
          </Link>
          <Link href="/history" style={{ color: "#9d8cff" }}>
            History timelapse ↗
          </Link>
          <Link href="/" style={{ color: "#9d8cff" }}>
            Back to the town ↗
          </Link>
        </div>
      </div>
    </main>
  );
}
