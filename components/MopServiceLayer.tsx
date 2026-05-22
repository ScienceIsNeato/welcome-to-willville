import townAnimation from "@/data/town-animation.v1.json";
import {
  serviceLoopRouteForStop,
  serviceRouteForStop,
} from "@/lib/town-layout";
import type { Stop } from "@/lib/town";
import type { CSSProperties } from "react";

type Props = {
  stops: Stop[];
};

type SpriteAnimation = {
  row: number;
  frames: number;
  fps: number;
};

type SpriteConfig = {
  id: string;
  src: string;
  sheetWidth: number;
  sheetHeight: number;
  frameWidth: number;
  frameHeight: number;
  animations: Record<string, SpriteAnimation>;
};

type MopSystemConfig = {
  id: string;
  originLandmark: string;
  sprite: string;
  routeStrategy: string;
  maxAgents: number;
  secondsPerRoute: number;
  frameSeconds: number;
  routeStates: {
    id: string;
    from: number;
    to: number;
    animation: string;
  }[];
};

const MOP_SYSTEM = townAnimation.systems.find(
  (system) => system.id === "mop-service",
) as MopSystemConfig | undefined;
const MOP_SPRITE = townAnimation.sprites.find(
  (sprite) => sprite.id === MOP_SYSTEM?.sprite,
) as SpriteConfig | undefined;
const MOP_VISUAL_SCALE = 2.2;

export function MopServiceLayer({ stops }: Props) {
  if (!MOP_SYSTEM || !MOP_SPRITE) return null;
  const activeStops = stops
    .filter((stop) => stop.district !== "slop-wharf")
    .slice(0, MOP_SYSTEM.maxAgents);
  const moppingState =
    MOP_SYSTEM.routeStates.find((state) => state.id === "mopping") ??
    MOP_SYSTEM.routeStates[1];
  const outboundState =
    MOP_SYSTEM.routeStates.find((state) => state.id === "outbound") ??
    MOP_SYSTEM.routeStates[0];
  const keyTimes = `0;${outboundState.to};${moppingState.to};1`;
  const keyPoints = "0;0.5;0.5;1";

  return (
    <g
      id="mop-service-layer"
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    >
      <style>{`
        .mop-agent {
          filter: drop-shadow(0 3px 3px rgba(11, 20, 24, 0.58));
        }
        .mop-agent__visibility-ring {
          fill: transparent;
          stroke: transparent;
          stroke-width: 0;
          vector-effect: non-scaling-stroke;
        }
        .mop-agent__sheet {
          opacity: 1;
        }
        .mop-agent__site-suds {
          animation: mop-site-suds ${MOP_SYSTEM.secondsPerRoute}s linear infinite;
          animation-delay: var(--mop-route-delay);
          opacity: 0;
        }
        @keyframes mop-site-suds {
          0%, ${Math.max(0, Math.round(moppingState.from * 100) - 1)}% { opacity: 0; }
          ${Math.round(moppingState.from * 100)}%, ${Math.round(moppingState.to * 100)}% { opacity: 0.72; }
          ${Math.min(100, Math.round(moppingState.to * 100) + 1)}%, 100% { opacity: 0; }
        }
      `}</style>
      {activeStops.map((stop, index) => {
        const serviceRoute = serviceRouteForStop(stop.position);
        const loopRoute = serviceLoopRouteForStop(stop.position);
        const delay = -(
          (index / activeStops.length) *
          MOP_SYSTEM.secondsPerRoute
        );
        const clipId = `mop-agent-clip-${stop.id}`;
        return (
          <g
            key={`mop-agent-${stop.id}`}
            className="mop-agent"
            style={
              {
                "--mop-route-delay": `${delay.toFixed(2)}s`,
              } as CSSProperties
            }
          >
            <defs>
              <clipPath id={clipId}>
                <rect
                  x={-MOP_SPRITE.frameWidth / 2}
                  y={-MOP_SPRITE.frameHeight / 2}
                  width={MOP_SPRITE.frameWidth}
                  height={MOP_SPRITE.frameHeight}
                />
              </clipPath>
            </defs>
            <path
              d={serviceRoute}
              fill="none"
              stroke="rgba(185, 244, 230, 0.18)"
              strokeWidth={1.6}
              strokeDasharray="2 24"
              strokeLinecap="round"
            />
            <g transform={`translate(${stop.position.x}, ${stop.position.y})`}>
              <g className="mop-agent__site-suds">
                <circle cx={-8} cy={3} r={3} fill="#dff8ff" />
                <circle cx={4} cy={-2} r={2.5} fill="#bcefff" />
                <circle cx={12} cy={4} r={2} fill="#e9fbff" />
              </g>
            </g>
            <g className="mop-agent__traveler">
              <circle className="mop-agent__visibility-ring" r={13} />
              <g transform={`scale(${MOP_VISUAL_SCALE})`}>
                <image
                  className="mop-agent__sheet"
                  href={MOP_SPRITE.src}
                  x={-MOP_SPRITE.frameWidth / 2}
                  y={-MOP_SPRITE.frameHeight / 2}
                  width={MOP_SPRITE.sheetWidth}
                  height={MOP_SPRITE.sheetHeight}
                  clipPath={`url(#${clipId})`}
                />
              </g>
              <animateMotion
                dur={`${MOP_SYSTEM.secondsPerRoute}s`}
                repeatCount="indefinite"
                rotate="auto"
                begin={`${delay.toFixed(2)}s`}
                path={loopRoute}
                keyPoints={keyPoints}
                keyTimes={keyTimes}
                calcMode="linear"
              />
            </g>
          </g>
        );
      })}
    </g>
  );
}
