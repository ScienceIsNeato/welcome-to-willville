/**
 * A single vehicle sprite that animates along an SVG <path> via animateMotion.
 *
 * The vehicle style is chosen per-line (steam, trolley, hearse, cart, paperboy).
 * Sprites are intentionally simple SVG so the file loads instantly; they can be
 * replaced with LLM-generated PNGs later by swapping the inner shape only.
 */
import type { Line } from "@/lib/willville";

type Props = {
  line: Line;
  /** 0..1 offset along the path for staggered animation. */
  begin: number;
};

function VehicleShape({
  vehicle,
  color,
}: {
  vehicle: Line["vehicle"];
  color: string;
}) {
  switch (vehicle) {
    case "steam":
      return (
        <g>
          <rect x={-12} y={-6} width={20} height={10} rx={2} fill={color} />
          <rect x={6} y={-12} width={6} height={10} rx={1} fill={color} />
          <circle cx={-8} cy={6} r={3} fill="#222" />
          <circle cx={4} cy={6} r={3} fill="#222" />
          <circle cx={9} cy={-14} r={2.5} fill="#fff" opacity={0.7} />
        </g>
      );
    case "trolley":
      return (
        <g>
          <rect x={-14} y={-8} width={28} height={12} rx={3} fill={color} />
          <rect x={-10} y={-6} width={6} height={4} fill="#fff" opacity={0.5} />
          <rect x={-2} y={-6} width={6} height={4} fill="#fff" opacity={0.5} />
          <rect x={6} y={-6} width={6} height={4} fill="#fff" opacity={0.5} />
          <circle cx={-8} cy={6} r={2.5} fill="#222" />
          <circle cx={8} cy={6} r={2.5} fill="#222" />
        </g>
      );
    case "hearse":
      return (
        <g>
          <rect x={-14} y={-6} width={26} height={10} rx={1} fill={color} />
          <polygon points="-14,-6 -8,-12 6,-12 12,-6" fill={color} />
          <rect x={-4} y={-10} width={6} height={4} fill="#000" opacity={0.6} />
          <circle cx={-8} cy={6} r={2.5} fill="#222" />
          <circle cx={8} cy={6} r={2.5} fill="#222" />
        </g>
      );
    case "cart":
      return (
        <g>
          <rect x={-12} y={-6} width={22} height={9} rx={1} fill={color} />
          <rect x={-12} y={-9} width={3} height={3} fill={color} />
          <rect x={7} y={-9} width={3} height={3} fill={color} />
          <circle cx={-7} cy={6} r={3} fill="#3a2410" />
          <circle cx={5} cy={6} r={3} fill="#3a2410" />
        </g>
      );
    case "paperboy":
      return (
        <g>
          <circle cx={0} cy={-6} r={4} fill={color} />
          <rect x={-2} y={-3} width={4} height={6} fill={color} />
          <circle cx={-6} cy={6} r={3} fill="#222" />
          <circle cx={6} cy={6} r={3} fill="#222" />
          <rect x={2} y={-2} width={6} height={3} fill="#fff" opacity={0.8} />
        </g>
      );
  }
}

export function Train({ line, begin }: Props) {
  const color = `var(${line.colorVar})`;
  const dur = `${line.loopSeconds}s`;
  const beginAttr = `${(-begin * line.loopSeconds).toFixed(2)}s`;
  return (
    <g>
      <VehicleShape vehicle={line.vehicle} color={color} />
      <animateMotion
        dur={dur}
        repeatCount="indefinite"
        rotate="auto"
        path={line.path}
        begin={beginAttr}
      />
    </g>
  );
}
