import { GENERATED_TOWN_LAYOUT } from "@/lib/town-layout";

const SIGN_BOARD = {
  width: 472,
  height: 50,
  y: -10,
};

export function HollywoodSign() {
  const sign = GENERATED_TOWN_LAYOUT.landmarks.welcomeSign;

  const topBulbs = Array.from({ length: 12 }, (_, idx) => ({
    x: -206 + idx * 38,
    y: SIGN_BOARD.y - 8,
    delay: `${idx * 0.06}s`,
  }));

  const bottomBulbs = Array.from({ length: 12 }, (_, idx) => ({
    x: -206 + idx * 38,
    y: SIGN_BOARD.y + SIGN_BOARD.height + 8,
    delay: `${0.32 + idx * 0.06}s`,
  }));

  const leftBulbs = Array.from({ length: 3 }, (_, idx) => ({
    x: -SIGN_BOARD.width / 2 - 8,
    y: SIGN_BOARD.y + 10 + idx * 16,
    delay: `${0.18 + idx * 0.08}s`,
  }));

  const rightBulbs = Array.from({ length: 3 }, (_, idx) => ({
    x: SIGN_BOARD.width / 2 + 8,
    y: SIGN_BOARD.y + 10 + idx * 16,
    delay: `${0.5 + idx * 0.08}s`,
  }));

  const bulbs = [...topBulbs, ...bottomBulbs, ...leftBulbs, ...rightBulbs];

  return (
    <g
      id="willville-welcome-sign"
      transform={`translate(${sign.x}, ${sign.y}) rotate(-8)`}
      aria-label="Welcome to Willville sign"
      style={{ pointerEvents: "none" }}
    >
      {[-182, -92, 0, 92, 182].map((x) => (
        <line
          key={x}
          x1={x}
          y1={SIGN_BOARD.y + SIGN_BOARD.height - 2}
          x2={x - 10}
          y2={96}
          stroke="#5b3a22"
          strokeWidth={5}
          strokeLinecap="round"
        />
      ))}

      <rect
        x={-SIGN_BOARD.width / 2}
        y={SIGN_BOARD.y}
        width={SIGN_BOARD.width}
        height={SIGN_BOARD.height}
        rx={3}
        fill="rgba(245,230,200,0.96)"
        stroke="#4c3320"
        strokeWidth={6}
        style={{
          filter: "drop-shadow(0 0 8px rgba(255, 224, 128, 0.25))",
          animation: "willville-sign-frame-pulse 3.2s ease-in-out infinite",
        }}
      />

      {bulbs.map((bulb, idx) => (
        <circle
          key={`marquee-bulb-${idx}`}
          cx={bulb.x}
          cy={bulb.y}
          r={3.4}
          fill="#ffeab0"
          stroke="#9b5b20"
          strokeWidth={1.1}
          style={{
            filter:
              "drop-shadow(0 0 3px rgba(255, 228, 150, 0.72)) drop-shadow(0 0 6px rgba(255, 188, 94, 0.35))",
            animation: "willville-sign-bulb-twinkle 2.8s ease-in-out infinite",
            animationDelay: bulb.delay,
          }}
        />
      ))}

      <text
        x={0}
        y={SIGN_BOARD.y + SIGN_BOARD.height / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={34}
        fontWeight={900}
        fill="#ffe29a"
        letterSpacing={1.4}
        style={{
          paintOrder: "stroke",
          stroke: "rgba(76, 51, 32, 0.96)",
          strokeWidth: 4,
          filter:
            "drop-shadow(0 0 5px rgba(255, 220, 128, 0.72)) drop-shadow(0 0 12px rgba(255, 220, 128, 0.35))",
          animation: "willville-sign-text-pulse 2.4s ease-in-out infinite",
        }}
      >
        WELCOME TO WILLVILLE
      </text>

      <style>{`
        @keyframes willville-sign-text-pulse {
          0%,
          100% {
            opacity: 0.84;
          }
          50% {
            opacity: 1;
          }
        }

        @keyframes willville-sign-frame-pulse {
          0%,
          100% {
            opacity: 0.9;
          }
          50% {
            opacity: 1;
          }
        }

        @keyframes willville-sign-bulb-twinkle {
          0%,
          100% {
            opacity: 0.88;
            transform: scale(0.97);
          }
          38% {
            opacity: 0.98;
            transform: scale(1);
          }
          56% {
            opacity: 0.9;
            transform: scale(0.985);
          }
          72% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </g>
  );
}
