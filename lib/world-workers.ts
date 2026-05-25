import townWorkers from "@/data/town-workers.v1.json";
import type { Stop } from "@/lib/town";
import type { Point } from "@/lib/town-layout";

type WorkerLayer = "town-workers" | "canal-traffic" | "debug-paths";

export type WorkerAnimation = {
  row: number;
  frames: number;
  fps: number;
};

export type WorkerAnimatedArt = {
  id: string;
  src: string;
  sheetWidth: number;
  sheetHeight: number;
  frameWidth: number;
  frameHeight: number;
  visualScale: number;
  animations: Record<string, WorkerAnimation>;
};

type WorkerStaticArt = {
  id: string;
  src: string;
  width: number;
  height: number;
  anchor: Point;
};

type WorkerRouteState = {
  id: string;
  from: number;
  to: number;
  animation: string;
};

type WorkerRouteSiteFilter = {
  excludeDistricts?: string[];
};

type WorkerSystem = {
  id: string;
  kind: string;
  homeSiteId: string;
  homeLandmark: string;
  routeStrategy: "home-to-site-loop";
  routeSiteFilter?: WorkerRouteSiteFilter;
  renderPath: boolean;
  animateWorker: boolean;
  animatedArt?: string;
  staticArt?: string;
  maxWorkers: number;
  maxAnimatedWorkers: number;
  secondsPerRoute: number;
  rotateToPath: boolean;
  layer: WorkerLayer;
  routeStates: WorkerRouteState[];
};

type ResolvedWorkerRoute = {
  pathD: string;
  visiblePathD: string;
  keyPoints: string;
  keyTimes: string;
};

export type WorldWorker = {
  id: string;
  kind: string;
  systemId: string;
  homeSiteId: string;
  routeSites: Stop[];
  targetSite: Stop;
  renderPath: boolean;
  animateWorker: boolean;
  rotateToPath: boolean;
  layer: WorkerLayer;
  delaySeconds: number;
  secondsPerRoute: number;
  routeStates: WorkerRouteState[];
  route: ResolvedWorkerRoute;
  animatedArt?: WorkerAnimatedArt;
  staticArt?: WorkerStaticArt;
};

type TownWorkersData = {
  animatedArt: WorkerAnimatedArt[];
  staticArt: WorkerStaticArt[];
  systems: WorkerSystem[];
};

const WORKER_DATA = townWorkers as TownWorkersData;

const ANIMATED_ART = new Map(
  WORKER_DATA.animatedArt.map((art) => [art.id, art]),
);
const STATIC_ART = new Map(WORKER_DATA.staticArt.map((art) => [art.id, art]));

function routeStopsForSystem(system: WorkerSystem, stops: Stop[]): Stop[] {
  const excluded = new Set(system.routeSiteFilter?.excludeDistricts ?? []);
  return stops
    .filter((stop) => stop.id !== system.homeSiteId)
    .filter((stop) => !excluded.has(stop.district))
    .slice(0, system.maxWorkers);
}

function keyTimesFor(system: WorkerSystem): string {
  const outbound =
    system.routeStates.find((state) => state.id === "outbound") ??
    system.routeStates[0];
  const mopping =
    system.routeStates.find((state) => state.id === "mopping") ??
    system.routeStates[1];
  return `0;${outbound?.to ?? 0.44};${mopping?.to ?? 0.56};1`;
}

function midpoint(a: Point, b: Point): Point {
  return {
    x: Math.round((a.x + b.x) / 2),
    y: Math.round((a.y + b.y) / 2),
  };
}

function cubicLength(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  steps = 36,
): number {
  let length = 0;
  let previous = p0;
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const mt = 1 - t;
    const point = {
      x:
        mt * mt * mt * p0.x +
        3 * mt * mt * t * p1.x +
        3 * mt * t * t * p2.x +
        t * t * t * p3.x,
      y:
        mt * mt * mt * p0.y +
        3 * mt * mt * t * p1.y +
        3 * mt * t * t * p2.y +
        t * t * t * p3.y,
    };
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return length;
}

function siteToSiteRoute(
  from: Point,
  to: Point,
): {
  outbound: [Point, Point, Point, Point];
  inbound: [Point, Point, Point, Point];
} {
  const mid = midpoint(from, to);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const bend = Math.min(110, Math.max(34, distance * 0.16));
  const normal = { x: -dy / distance, y: dx / distance };
  const outboundLift = { x: normal.x * bend, y: normal.y * bend };
  const inboundLift = {
    x: -normal.x * bend * 0.75,
    y: -normal.y * bend * 0.75,
  };
  return {
    outbound: [
      from,
      {
        x: Math.round(mid.x + outboundLift.x),
        y: Math.round(mid.y + outboundLift.y),
      },
      {
        x: Math.round(mid.x + outboundLift.x),
        y: Math.round(mid.y + outboundLift.y),
      },
      to,
    ],
    inbound: [
      to,
      {
        x: Math.round(mid.x + inboundLift.x),
        y: Math.round(mid.y + inboundLift.y),
      },
      {
        x: Math.round(mid.x + inboundLift.x),
        y: Math.round(mid.y + inboundLift.y),
      },
      from,
    ],
  };
}

function cubicPath([p0, p1, p2, p3]: [Point, Point, Point, Point]): string {
  return `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;
}

function cubicContinuation([_p0, p1, p2, p3]: [
  Point,
  Point,
  Point,
  Point,
]): string {
  return `C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;
}

function resolveRoute(
  system: WorkerSystem,
  home: Stop,
  target: Stop,
): ResolvedWorkerRoute {
  if (system.routeStrategy !== "home-to-site-loop") {
    throw new Error(
      `Unsupported worker route strategy: ${system.routeStrategy}`,
    );
  }
  const route = siteToSiteRoute(home.position, target.position);
  const outboundLength = cubicLength(...route.outbound);
  const inboundLength = cubicLength(...route.inbound);
  const totalLength = outboundLength + inboundLength;
  const siteKeyPoint = totalLength > 0 ? outboundLength / totalLength : 0.5;
  return {
    pathD: `${cubicPath(route.outbound)} ${cubicContinuation(route.inbound)}`,
    visiblePathD: cubicPath(route.outbound),
    keyPoints: `0;${siteKeyPoint.toFixed(4)};${siteKeyPoint.toFixed(4)};1`,
    keyTimes: keyTimesFor(system),
  };
}

export function resolveWorldWorkers(stops: Stop[]): WorldWorker[] {
  return WORKER_DATA.systems.flatMap((system) => {
    const homeSite = stops.find((stop) => stop.id === system.homeSiteId);
    if (!homeSite) return [];
    const routeSites = routeStopsForSystem(system, stops).slice(
      0,
      system.maxAnimatedWorkers,
    );
    const animatedArt = system.animatedArt
      ? ANIMATED_ART.get(system.animatedArt)
      : undefined;
    const staticArt = system.staticArt
      ? STATIC_ART.get(system.staticArt)
      : undefined;
    return routeSites.map((targetSite, index) => ({
      id: `${system.id}-${targetSite.district}-${targetSite.id}`,
      kind: system.kind,
      systemId: system.id,
      homeSiteId: system.homeSiteId,
      routeSites: [homeSite, targetSite],
      targetSite,
      renderPath: system.renderPath,
      animateWorker: system.animateWorker,
      rotateToPath: system.rotateToPath,
      layer: system.layer,
      delaySeconds: -((index / routeSites.length) * system.secondsPerRoute),
      secondsPerRoute: system.secondsPerRoute,
      routeStates: system.routeStates,
      route: resolveRoute(system, homeSite, targetSite),
      animatedArt,
      staticArt,
    }));
  });
}
