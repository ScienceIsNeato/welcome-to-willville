import { WillvilleGuestbook } from "./WillvilleGuestbook";

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
  pullTabLabel: string;
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
    pullTabLabel: "Pull tab -> Town Square",
  },
  {
    title: "The Planning Office",
    href: "/reposition/?site_type=desktop",
    note: "Stage placement and repaint review.",
    pullTabLabel: "Pull tab -> Planning Office",
  },
  {
    title: "Slop-Mop Rails",
    href: "https://slop-mop.com",
    note: "Visit the rails that power my force multiplier loop.",
    pullTabLabel: "Pull tab -> slop-mop.com",
    external: true,
  },
];

const MECHANISM_ROTATIONS = [-1.4, 1.1, -0.9, 1.2, -1.1];
const LINK_ROTATIONS = [-1.2, 0.9, -0.8];

export function WillvilleAboutPane({ panelOpacity = 1, onClose }: Props) {
  return (
    <section
      data-town-control
      aria-label="About Willville"
      style={{
        pointerEvents: "auto",
        background: `linear-gradient(180deg, rgba(130, 88, 48, ${Math.max(0.86, panelOpacity * 0.94)}) 0%, rgba(97, 61, 34, ${Math.max(0.92, panelOpacity * 0.97)}) 100%)`,
        color: "#2b1b12",
        border: "3px solid rgba(72, 44, 24, 0.96)",
        borderRadius: 10,
        boxShadow:
          "0 14px 28px rgba(0, 0, 0, 0.56), inset 0 0 0 2px rgba(255, 221, 165, 0.2), inset 0 -12px 36px rgba(61, 37, 20, 0.3)",
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
            "radial-gradient(circle at 14% 24%, rgba(255,226,178,0.15) 0 2px, transparent 2px), radial-gradient(circle at 73% 59%, rgba(255,233,188,0.11) 0 1.6px, transparent 1.6px), radial-gradient(circle at 36% 76%, rgba(246,188,124,0.13) 0 1.9px, transparent 1.9px), repeating-linear-gradient(14deg, rgba(67,40,21,0.08) 0 2px, rgba(136,95,57,0.04) 2px 6px)",
          pointerEvents: "none",
        }}
      />

      {[
        { left: 18, top: 12 },
        { right: 20, top: 12 },
      ].map((pin, index) => (
        <div
          key={`forum-pin-${index}`}
          aria-hidden
          style={{
            position: "absolute",
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#d7c7a4",
            boxShadow: "0 1px 0 rgba(0,0,0,0.45)",
            border: "1px solid rgba(70,45,27,0.9)",
            zIndex: 2,
            ...pin,
          }}
        />
      ))}

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
              color: "rgba(255, 236, 196, 0.95)",
            }}
          >
            Town Bulletin Board
          </div>
          <h2
            style={{
              margin: "4px 0 0",
              fontSize: 22,
              letterSpacing: 0.3,
              color: "#fff1d0",
              textShadow: "0 1px 0 rgba(45, 28, 17, 0.6)",
            }}
          >
            WTF: Willville Town Forum
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            border: "1px solid rgba(255, 218, 153, 0.65)",
            borderRadius: 6,
            background: "rgba(95, 58, 34, 0.56)",
            color: "#ffe6b6",
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
          color: "rgba(255, 236, 201, 0.95)",
          position: "relative",
          zIndex: 1,
        }}
      >
        Welcome to the Willville Town Forum board. This is where I post how the
        city runs: mostly my personal force multiplier for steering daily build
        flow, and also my portfolio frontage for showing the shape of my sites
        in one living map.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          marginBottom: 10,
          position: "relative",
          zIndex: 1,
        }}
      >
        {MECHANISMS.map((item, index) => (
          <article
            key={item.title}
            style={{
              border: "1px solid rgba(90, 62, 38, 0.45)",
              borderRadius: 7,
              background:
                "linear-gradient(180deg, rgba(251, 242, 224, 0.98), rgba(236, 220, 189, 0.95))",
              padding: "11px 11px 10px",
              boxShadow:
                "0 3px 0 rgba(49,31,20,0.24), 0 8px 14px rgba(32,20,12,0.2)",
              transform: `rotate(${MECHANISM_ROTATIONS[index % MECHANISM_ROTATIONS.length]}deg)`,
              transformOrigin: "center top",
              position: "relative",
            }}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: -5,
                left: "50%",
                transform: "translateX(-50%)",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle at 32% 28%, #fbf2e4 0%, #d6bf9f 42%, #815b39 100%)",
                boxShadow: "0 1px 1px rgba(18, 9, 3, 0.46)",
                border: "1px solid rgba(73, 45, 23, 0.65)",
              }}
            />
            <h3
              style={{
                margin: "0 0 4px",
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: 0.7,
                color: "#4a311f",
              }}
            >
              {item.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                lineHeight: 1.35,
                color: "rgba(70, 44, 27, 0.92)",
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
          gap: 12,
          marginTop: 2,
          position: "relative",
          zIndex: 1,
        }}
      >
        {LINK_CARDS.map((link, index) => (
          <a
            key={link.title}
            href={link.href}
            onClick={() => {
              if (!link.external) {
                onClose();
              }
            }}
            target={link.external ? "_blank" : undefined}
            rel={link.external ? "noreferrer" : undefined}
            style={{
              textDecoration: "none",
              color: "#3f2919",
              border: "1px solid rgba(82, 52, 30, 0.45)",
              borderRadius: 8,
              background:
                "linear-gradient(180deg, rgba(252, 243, 226, 0.98), rgba(238, 219, 186, 0.96))",
              padding: "11px 11px 0",
              display: "block",
              boxShadow:
                "0 3px 0 rgba(49,31,20,0.22), 0 8px 14px rgba(32,20,12,0.2)",
              transform: `rotate(${LINK_ROTATIONS[index % LINK_ROTATIONS.length]}deg)`,
              transformOrigin: "center top",
              position: "relative",
            }}
            title={link.pullTabLabel}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: -5,
                left: "50%",
                transform: "translateX(-50%)",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle at 32% 28%, #faf1e3 0%, #d6bf9f 44%, #805a39 100%)",
                boxShadow: "0 1px 1px rgba(18, 9, 3, 0.46)",
                border: "1px solid rgba(73, 45, 23, 0.65)",
              }}
            />
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                marginBottom: 3,
                color: "#4a311f",
              }}
            >
              {link.title}
            </div>
            <div
              style={{
                fontSize: 11,
                lineHeight: 1.35,
                color: "rgba(76, 48, 28, 0.86)",
                marginBottom: 8,
              }}
            >
              {link.note}
            </div>

            <div
              style={{
                margin: "0 -11px",
                borderTop: "1px dashed rgba(86, 53, 30, 0.4)",
                background: "rgba(223, 195, 153, 0.7)",
                padding: "6px 11px",
                borderBottomLeftRadius: 8,
                borderBottomRightRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 0.7,
                  textTransform: "uppercase",
                  color: "rgba(66, 41, 24, 0.9)",
                }}
              >
                {link.pullTabLabel}
              </span>
              <span
                aria-hidden
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "rgba(66, 41, 24, 0.9)",
                }}
              >
                {"->"}
              </span>
            </div>
          </a>
        ))}
      </div>

      <WillvilleGuestbook />
    </section>
  );
}
