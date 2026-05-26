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
      />
      <text
        x={0}
        y={SIGN_BOARD.y + SIGN_BOARD.height / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={34}
        fontWeight={900}
        fill="#4c3320"
        letterSpacing={1.4}
        style={{
          paintOrder: "stroke",
          stroke: "rgba(245,230,200,0.72)",
          strokeWidth: 4,
        }}
      >
        WELCOME TO WILLVILLE
      </text>
    </g>
  );
}
