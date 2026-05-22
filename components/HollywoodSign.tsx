import { GENERATED_TOWN_LAYOUT } from "@/lib/town-layout";

export function HollywoodSign() {
  const sign = GENERATED_TOWN_LAYOUT.landmarks.welcomeSign;
  const boardOffset = { x: -sign.x, y: -sign.y };
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
          y1={38}
          x2={x - 10}
          y2={96}
          stroke="#5b3a22"
          strokeWidth={5}
          strokeLinecap="round"
        />
      ))}
      <path
        d={sign.pathD}
        transform={`translate(${boardOffset.x}, ${boardOffset.y})`}
        fill="rgba(245,230,200,0.96)"
        stroke="#4c3320"
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <text
        x={0}
        y={18}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={34}
        fontWeight={900}
        fill="#4c3320"
        letterSpacing={1.4}
        transform="rotate(-7)"
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
