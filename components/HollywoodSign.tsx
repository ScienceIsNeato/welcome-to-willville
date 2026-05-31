import { GENERATED_TOWN_LAYOUT } from "@/lib/town-layout";

const SIGN_BOARD = {
  width: 472,
  height: 50,
  y: -10,
};

export function HollywoodSign() {
  const sign = GENERATED_TOWN_LAYOUT.landmarks.welcomeSign;
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
      `}</style>
    </g>
  );
}
