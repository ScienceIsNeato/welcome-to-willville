"use client";

/**
 * Willbot — the harbor leviathan.
 *
 * A great serpent that floats in the Atlantic north of the shipping routes
 * (the open-sea boat stream that exits the bay heading ESE and bends NNE).
 * It is Will. It is willbot. Clicking it opens the Willbot chat panel.
 *
 * Coordinates are TOWN space — this layer renders inside TownStage's
 * `translate(TOWN_OFFSET …)` group, like FogDog. The east coast ends around
 * x≈1450; the leviathan drifts around TOWN {1840, 520}, clear of the boat
 * fan's spine at comparable radius from the bay mouth.
 *
 * Drift uses SVG-native `<animateMotion>` (no rAF); the humps bob with
 * cheap staggered CSS transforms. Art is inline vector for now — the art
 * pipeline can swap in a painted sprite later without touching the chat
 * wiring (the willbot brain itself is being built separately; see
 * functions/api/willbot.ts for the interface this stub calls).
 */

const DRIFT_SECONDS = 52;

// Slow closed drift loop around the leviathan's anchorage (TOWN coords).
const DRIFT_PATH =
  "M1840,520 C1892,512 1924,540 1906,566 C1888,592 1812,588 1782,560 " +
  "C1760,538 1796,514 1840,520 Z";

const INK = "#14323c";
const INK_DEEP = "#0c2630";
const CREAM = "#f4f1e8";
const GLOW = "#7fe3d4";

type Props = {
  /** Open the Willbot chat. Wired by TownStage; also marks skip-drag. */
  onChat: () => void;
};

export function Leviathan({ onChat }: Props) {
  return (
    <g id="leviathan-layer">
      <style>{`
        @keyframes leviathan-bob {
          0%, 100% { transform: translateY(0px); }
          50%      { transform: translateY(-4px); }
        }
        @keyframes leviathan-ripple {
          0%   { opacity: 0; transform: scale(0.6); }
          25%  { opacity: 0.5; }
          100% { opacity: 0; transform: scale(1.5); }
        }
        @keyframes leviathan-blink {
          0%, 92%, 100% { opacity: 1; }
          95%           { opacity: 0.15; }
        }
        @keyframes leviathan-ping {
          0%, 78%, 100% { opacity: 0.35; }
          86%           { opacity: 1; }
        }
        .leviathan-hump {
          animation: leviathan-bob 7s ease-in-out infinite;
          will-change: transform;
        }
        .leviathan-ripple {
          animation: leviathan-ripple 9s ease-out infinite;
          transform-origin: center;
          transform-box: fill-box;
          will-change: transform, opacity;
        }
        .leviathan-eye { animation: leviathan-blink 6s linear infinite; }
        .leviathan-antenna-tip { animation: leviathan-ping 5s linear infinite; }
        .leviathan-name {
          opacity: 0;
          transition: opacity 180ms ease;
        }
        #leviathan-layer:hover .leviathan-name { opacity: 1; }
        #leviathan-layer:hover .leviathan-body { filter: brightness(1.18); }
      `}</style>

      <g
        role="button"
        tabIndex={0}
        aria-label="Willbot, the harbor leviathan — click to chat"
        style={{ cursor: "pointer" }}
        onClick={onChat}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onChat();
          }
        }}
      >
        <animateMotion
          dur={`${DRIFT_SECONDS}s`}
          repeatCount="indefinite"
          path={DRIFT_PATH}
          calcMode="linear"
        />
        <title>Willbot — the harbor leviathan. Click to chat.</title>

        {/* Wake ripples under the beast. */}
        <g aria-hidden="true" style={{ pointerEvents: "none" }}>
          {[0, 3, 6].map((delay, i) => (
            <ellipse
              key={i}
              className="leviathan-ripple"
              style={{ animationDelay: `${delay}s` }}
              cx={0}
              cy={14}
              rx={78}
              ry={12}
              fill="none"
              stroke={CREAM}
              strokeWidth={1}
            />
          ))}
        </g>

        {/* Generous invisible hit area so the whole silhouette is clickable. */}
        <ellipse cx={0} cy={-6} rx={95} ry={44} fill="transparent" />

        <g className="leviathan-body">
          {/* Tail fluke. */}
          <g className="leviathan-hump" style={{ animationDelay: "-1.5s" }}>
            <path
              d={
                "M -88 2 C -96 -14, -82 -26, -72 -18 " +
                "C -78 -10, -76 -4, -66 4 C -74 10, -84 10, -88 2 Z"
              }
              fill={INK}
              stroke={CREAM}
              strokeWidth={1.1}
            />
          </g>

          {/* Two back humps, bobbing out of phase. */}
          <g className="leviathan-hump" style={{ animationDelay: "-3.5s" }}>
            <path
              d="M -58 8 C -52 -18, -28 -18, -22 8 Z"
              fill={INK}
              stroke={CREAM}
              strokeWidth={1.1}
            />
            <path
              d="M -46 -11 L -42 -19 L -38 -11 Z"
              fill={INK_DEEP}
              stroke={CREAM}
              strokeWidth={0.8}
            />
          </g>
          <g className="leviathan-hump" style={{ animationDelay: "-5.5s" }}>
            <path
              d="M -10 8 C -2 -26, 28 -26, 36 8 Z"
              fill={INK}
              stroke={CREAM}
              strokeWidth={1.1}
            />
            <path
              d="M 8 -18 L 13 -27 L 18 -18 Z"
              fill={INK_DEEP}
              stroke={CREAM}
              strokeWidth={0.8}
            />
          </g>

          {/* Neck + head, rising at the bow (faces east, out to sea). */}
          <g className="leviathan-hump">
            <path
              d={
                "M 48 8 C 50 -12, 54 -28, 66 -36 " +
                "C 80 -45, 92 -38, 90 -28 C 89 -21, 83 -18, 76 -19 " +
                "C 70 -14, 68 -4, 68 8 Z"
              }
              fill={INK}
              stroke={CREAM}
              strokeWidth={1.1}
            />
            {/* Eye — it watches the town. */}
            <circle
              className="leviathan-eye"
              cx={79}
              cy={-30}
              r={2.4}
              fill={GLOW}
            />
            {/* Antenna: the tell that this leviathan is a bot. */}
            <line
              x1={84}
              y1={-37}
              x2={88}
              y2={-48}
              stroke={CREAM}
              strokeWidth={1.1}
              strokeLinecap="round"
            />
            <circle
              className="leviathan-antenna-tip"
              cx={88.5}
              cy={-49.5}
              r={2}
              fill={GLOW}
            />
          </g>
        </g>

        {/* Nameplate, revealed on hover. */}
        <text
          className="leviathan-name"
          x={0}
          y={34}
          textAnchor="middle"
          fontSize={13}
          fontWeight={700}
          letterSpacing={2}
          fill={CREAM}
          style={{ pointerEvents: "none" }}
        >
          WILLBOT
        </text>
      </g>
    </g>
  );
}
