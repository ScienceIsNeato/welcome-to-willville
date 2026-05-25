import type { CSSProperties } from "react";
import type {
  WorkerAnimatedArt,
  WorkerAnimation,
  WorldWorker,
} from "@/lib/world-workers";
import { resolveWorldWorkers } from "@/lib/world-workers";
import type { Stop } from "@/lib/town";

type Props = {
  stops: Stop[];
  layer?: WorldWorker["layer"];
};

function pct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function spriteFrameXValues(
  art: WorkerAnimatedArt,
  animation: WorkerAnimation,
) {
  return Array.from(
    { length: animation.frames },
    (_item, frame) => -art.frameWidth / 2 - frame * art.frameWidth,
  ).join(";");
}

function routeStateVisibilityStyles(workers: WorldWorker[]): string {
  const systems = new Map<string, WorldWorker>();
  for (const worker of workers) {
    if (!systems.has(worker.systemId)) {
      systems.set(worker.systemId, worker);
    }
  }
  return Array.from(systems.values())
    .flatMap((worker) =>
      worker.routeStates.map((state) => {
        const before = Math.max(0, state.from - 0.0001);
        const after = Math.min(1, state.to + 0.0001);
        const className = `world-worker__sprite--${worker.systemId}-${state.id}`;
        return `
          .${className} {
            animation: world-worker-state-${worker.systemId}-${state.id} ${worker.secondsPerRoute}s linear infinite;
            animation-delay: var(--worker-route-delay);
          }
          @keyframes world-worker-state-${worker.systemId}-${state.id} {
            0%, ${pct(before)} { opacity: 0; }
            ${pct(state.from)}, ${pct(state.to)} { opacity: 1; }
            ${pct(after)}, 100% { opacity: 0; }
          }
        `;
      }),
    )
    .join("\n");
}

function siteEffectStyles(workers: WorldWorker[]): string {
  const systems = new Map<string, WorldWorker>();
  for (const worker of workers) {
    if (!systems.has(worker.systemId)) {
      systems.set(worker.systemId, worker);
    }
  }
  return Array.from(systems.values())
    .map((worker) => {
      const active =
        worker.routeStates.find((state) => state.id === "mopping") ??
        worker.routeStates[1];
      const from = active?.from ?? 0.44;
      const to = active?.to ?? 0.56;
      return `
        .world-worker__site-effect--${worker.systemId} {
          animation: world-worker-site-effect-${worker.systemId} ${worker.secondsPerRoute}s linear infinite;
          animation-delay: var(--worker-route-delay);
          opacity: 0;
        }
        @keyframes world-worker-site-effect-${worker.systemId} {
          0%, ${Math.max(0, Math.round(from * 100) - 1)}% { opacity: 0; }
          ${Math.round(from * 100)}%, ${Math.round(to * 100)}% { opacity: 0.72; }
          ${Math.min(100, Math.round(to * 100) + 1)}%, 100% { opacity: 0; }
        }
      `;
    })
    .join("\n");
}

function renderAnimatedWorker(worker: WorldWorker) {
  const art = worker.animatedArt;
  if (!art) return null;
  const routeStates = worker.routeStates.flatMap((state) => {
    const animation = art.animations[state.animation];
    return animation ? [{ ...state, animation }] : [];
  });
  const clipId = `world-worker-clip-${worker.id}`;
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect
            x={-art.frameWidth / 2}
            y={-art.frameHeight / 2}
            width={art.frameWidth}
            height={art.frameHeight}
          />
        </clipPath>
      </defs>
      {routeStates.map((state) => (
        <g
          key={`${worker.id}-${state.id}`}
          className={`world-worker__sprite world-worker__sprite--${worker.systemId}-${state.id}`}
          transform={`scale(${art.visualScale})`}
        >
          <image
            className="world-worker__sheet"
            href={art.src}
            x={-art.frameWidth / 2}
            y={-art.frameHeight / 2 - state.animation.row * art.frameHeight}
            width={art.sheetWidth}
            height={art.sheetHeight}
            clipPath={`url(#${clipId})`}
          >
            <animate
              attributeName="x"
              values={spriteFrameXValues(art, state.animation)}
              dur={`${(state.animation.frames / state.animation.fps).toFixed(3)}s`}
              repeatCount="indefinite"
              calcMode="discrete"
            />
          </image>
        </g>
      ))}
    </>
  );
}

function renderStaticWorker(worker: WorldWorker) {
  const art = worker.staticArt;
  if (!art) return null;
  return (
    <image
      href={art.src}
      x={-art.anchor.x}
      y={-art.anchor.y}
      width={art.width}
      height={art.height}
    />
  );
}

export function WorldWorkerLayer({ stops, layer = "town-workers" }: Props) {
  const workers = resolveWorldWorkers(stops).filter(
    (worker) => worker.layer === layer,
  );
  if (workers.length === 0) return null;

  return (
    <g
      id={`world-worker-layer-${layer}`}
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    >
      <style>{`
        .world-worker {
          filter: drop-shadow(0 1px 1px rgba(11, 20, 24, 0.4));
        }
        .world-worker__sprite {
          opacity: 0;
        }
        .world-worker__route {
          fill: none;
          stroke: rgba(185, 244, 230, 0.18);
          stroke-width: 1.2;
          stroke-dasharray: 2 24;
          stroke-linecap: round;
        }
        ${routeStateVisibilityStyles(workers)}
        ${siteEffectStyles(workers)}
      `}</style>
      {workers.map((worker) => (
        <g
          key={worker.id}
          className={`world-worker world-worker--${worker.kind}`}
          style={
            {
              "--worker-route-delay": `${worker.delaySeconds.toFixed(2)}s`,
            } as CSSProperties
          }
        >
          {worker.renderPath && (
            <path
              className="world-worker__route"
              d={worker.route.visiblePathD}
            />
          )}
          <g
            className={`world-worker__site-effect world-worker__site-effect--${worker.systemId}`}
            transform={`translate(${worker.targetSite.position.x}, ${worker.targetSite.position.y})`}
          >
            <circle cx={-8} cy={3} r={3} fill="#dff8ff" />
            <circle cx={4} cy={-2} r={2.5} fill="#bcefff" />
            <circle cx={12} cy={4} r={2} fill="#e9fbff" />
          </g>
          <g className="world-worker__traveler">
            {worker.animateWorker
              ? renderAnimatedWorker(worker)
              : renderStaticWorker(worker)}
            <animateMotion
              dur={`${worker.secondsPerRoute}s`}
              repeatCount="indefinite"
              rotate={worker.rotateToPath ? "auto" : "0"}
              begin={`${worker.delaySeconds.toFixed(2)}s`}
              path={worker.route.pathD}
              keyPoints={worker.route.keyPoints}
              keyTimes={worker.route.keyTimes}
              calcMode="linear"
            />
          </g>
        </g>
      ))}
    </g>
  );
}
