type Props = {
  panelOpacity?: number;
  onClose: () => void;
};

type Mechanism = {
  title: string;
  blurb: string;
};

type LinkCard = {
  title: string;
  href: string;
  note: string;
  external?: boolean;
};

const MECHANISMS: Mechanism[] = [
  {
    title: "Bell Rounds",
    blurb:
      "Ring the bell and town messengers sweep every repo, update board health, and report what is moving.",
  },
  {
    title: "District Life",
    blurb:
      "Stops auto-group into districts so nearby projects feel like neighborhoods instead of random pins.",
  },
  {
    title: "Detail Boards",
    blurb:
      "Pick any stop to pull up activity, stars, PR state, and the latest little piece of local lore.",
  },
  {
    title: "Maker Mode",
    blurb:
      "Reposition mode lets the mayor move sites, stage edits, and approve paint changes one stop at a time.",
  },
];

const LINK_CARDS: LinkCard[] = [
  {
    title: "Main Street",
    href: "/",
    note: "Back to town square.",
  },
  {
    title: "The Planning Office",
    href: "/reposition/?site_type=desktop",
    note: "Stage placement and repaint review.",
  },
  {
    title: "Willville Source",
    href: "https://github.com/ScienceIsNeato/welcome-to-willville",
    note: "See the code that runs the town.",
    external: true,
  },
  {
    title: "Slop-Mop Rails",
    href: "https://github.com/ScienceIsNeato/slop-mop",
    note: "How quality and CI rails stay tidy.",
    external: true,
  },
];

export function WillvilleAboutPane({ panelOpacity = 1, onClose }: Props) {
  return (
    <section
      data-town-control
      aria-label="About Willville"
      style={{
        pointerEvents: "auto",
        background: `rgba(245, 230, 200, ${Math.max(0.78, panelOpacity * 0.96)})`,
        color: "var(--willville-ink)",
        border: "3px solid rgba(76, 51, 32, 0.9)",
        borderRadius: 10,
        boxShadow: "0 12px 26px rgba(0, 0, 0, 0.45)",
        padding: "14px 16px 12px",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 1.3,
              textTransform: "uppercase",
              opacity: 0.68,
            }}
          >
            Willville Information Bureau
          </div>
          <h2
            style={{
              margin: "4px 0 0",
              fontSize: 24,
              letterSpacing: 0.3,
            }}
          >
            WTF? How This Town Works
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            border: "1px solid rgba(76, 51, 32, 0.45)",
            borderRadius: 6,
            background: "rgba(76, 51, 32, 0.12)",
            color: "var(--willville-ink)",
            fontSize: 12,
            fontWeight: 700,
            padding: "8px 10px",
            cursor: "pointer",
          }}
        >
          Return to Time Central
        </button>
      </header>

      <p
        style={{
          margin: "0 0 10px",
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        Think of Willville as a tiny living city for your repos: bells wake it,
        workers move through it, and the boards gossip about what changed.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
          marginBottom: 10,
        }}
      >
        {MECHANISMS.map((item) => (
          <article
            key={item.title}
            style={{
              border: "1px solid rgba(76, 51, 32, 0.32)",
              borderRadius: 8,
              background: "rgba(255, 255, 255, 0.34)",
              padding: "9px 10px",
            }}
          >
            <h3
              style={{
                margin: "0 0 4px",
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: 0.7,
              }}
            >
              {item.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                lineHeight: 1.35,
                opacity: 0.92,
              }}
            >
              {item.blurb}
            </p>
          </article>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 8,
        }}
      >
        {LINK_CARDS.map((link) => (
          <a
            key={link.title}
            href={link.href}
            target={link.external ? "_blank" : undefined}
            rel={link.external ? "noreferrer" : undefined}
            style={{
              textDecoration: "none",
              color: "var(--willville-ink)",
              border: "1px solid rgba(76, 51, 32, 0.36)",
              borderRadius: 8,
              background: "rgba(245, 230, 200, 0.55)",
              padding: "8px 10px",
              display: "block",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                marginBottom: 3,
              }}
            >
              {link.title}
            </div>
            <div
              style={{
                fontSize: 11,
                lineHeight: 1.35,
                opacity: 0.88,
              }}
            >
              {link.note}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
