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
    title: "Mayor's Express",
    blurb:
      "Time Central picks the hottest my-sites activity into the express queue. The numbered board buttons jump straight to those stops.",
  },
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
    note: "Peek behind the curtain on the machinery.",
    external: true,
  },
  {
    title: "Slop-Mop Rails",
    href: "https://github.com/ScienceIsNeato/slop-mop",
    note: "The quality rails powering my force multiplier loop.",
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
        background: `linear-gradient(180deg, rgba(43, 27, 16, ${Math.max(0.8, panelOpacity * 0.9)}), rgba(24, 14, 8, ${Math.max(0.84, panelOpacity * 0.94)}))`,
        color: "var(--willville-ink)",
        border: "3px solid rgba(198, 154, 93, 0.9)",
        borderRadius: 10,
        boxShadow:
          "0 12px 26px rgba(0, 0, 0, 0.5), inset 0 0 0 2px rgba(250, 221, 170, 0.18)",
        padding: "14px 16px 12px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 7px)",
          pointerEvents: "none",
        }}
      />

      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 10,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 1.3,
              textTransform: "uppercase",
              color: "rgba(236, 208, 160, 0.88)",
            }}
          >
            Willville Mayor&apos;s Office Ledger
          </div>
          <h2
            style={{
              margin: "4px 0 0",
              fontSize: 24,
              letterSpacing: 0.3,
              color: "#f9dca7",
              textShadow: "0 0 10px rgba(255, 206, 130, 0.25)",
            }}
          >
            WTF? How This Town Works
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            border: "1px solid rgba(244, 205, 144, 0.52)",
            borderRadius: 6,
            background: "rgba(250, 220, 165, 0.13)",
            color: "#f8ddb1",
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
          color: "rgba(245, 224, 188, 0.92)",
          position: "relative",
          zIndex: 1,
        }}
      >
        Willville is dual-purpose by design: mostly my personal force multiplier
        for steering daily build flow, and also my portfolio frontage for
        showing the shape of my sites in one living map.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
          marginBottom: 10,
          position: "relative",
          zIndex: 1,
        }}
      >
        {MECHANISMS.map((item) => (
          <article
            key={item.title}
            style={{
              border: "1px solid rgba(244, 205, 144, 0.36)",
              borderRadius: 8,
              background:
                "linear-gradient(180deg, rgba(81, 50, 31, 0.7), rgba(56, 34, 21, 0.76))",
              padding: "9px 10px",
            }}
          >
            <h3
              style={{
                margin: "0 0 4px",
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: 0.7,
                color: "#f6d7a2",
              }}
            >
              {item.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                lineHeight: 1.35,
                color: "rgba(248, 230, 200, 0.9)",
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
          position: "relative",
          zIndex: 1,
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
              color: "#f4d6a3",
              border: "1px solid rgba(244, 205, 144, 0.4)",
              borderRadius: 8,
              background:
                "linear-gradient(180deg, rgba(92, 57, 35, 0.74), rgba(61, 37, 23, 0.78))",
              padding: "8px 10px",
              display: "block",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                marginBottom: 3,
                color: "#f7dfb5",
              }}
            >
              {link.title}
            </div>
            <div
              style={{
                fontSize: 11,
                lineHeight: 1.35,
                color: "rgba(246, 228, 198, 0.86)",
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
