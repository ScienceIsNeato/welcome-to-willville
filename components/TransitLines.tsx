import { LINES } from "@/lib/willville";
import { Train } from "./Train";

/**
 * Renders all transit Lines + their vehicles. Lines are drawn first as dashed
 * paths (the "rails"); vehicles ride on top via Train -> animateMotion.
 *
 * The whole group lives inside the camera-transformed <g>, so pan/zoom moves
 * everything together — but the vehicles' motion stays in path-space and so
 * keeps circulating regardless of camera state.
 */
export function TransitLines() {
  return (
    <g aria-hidden="true" style={{ pointerEvents: "none" }}>
      {LINES.map((line) => (
        <path
          key={`rail-${line.id}`}
          d={line.path}
          fill="none"
          stroke={`var(${line.colorVar})`}
          strokeOpacity={0.35}
          strokeWidth={4}
          strokeDasharray="2 8"
          strokeLinecap="round"
        />
      ))}
      {LINES.flatMap((line) =>
        Array.from({ length: line.vehicleCount }, (_, i) => {
          const begin = i / line.vehicleCount;
          return (
            <Train key={`train-${line.id}-${i}`} line={line} begin={begin} />
          );
        }),
      )}
    </g>
  );
}
