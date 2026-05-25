import townWorkers from "@/data/town-workers.v1.json";
import type { Stop } from "@/lib/town";
import {
  serviceLoopRouteForStop,
  serviceLoopSiteKeyPointForStop,
  serviceRouteForStop,
  type Point,
} from "@/lib/town-layout";

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

function resolveRoute(system: WorkerSystem, target: Stop): ResolvedWorkerRoute {
  if (system.routeStrategy !== "home-to-site-loop") {
    throw new Error(
      `Unsupported worker route strategy: ${system.routeStrategy}`,
    );
  }
  const siteKeyPoint = serviceLoopSiteKeyPointForStop(target.position);
  return {
    pathD: serviceLoopRouteForStop(target.position),
    visiblePathD: serviceRouteForStop(target.position),
    keyPoints: `0;${siteKeyPoint.toFixed(4)};${siteKeyPoint.toFixed(4)};1`,
    keyTimes: keyTimesFor(system),
  };
}

export function resolveWorldWorkers(stops: Stop[]): WorldWorker[] {
  return WORKER_DATA.systems.flatMap((system) => {
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
      routeSites: [targetSite],
      targetSite,
      renderPath: system.renderPath,
      animateWorker: system.animateWorker,
      rotateToPath: system.rotateToPath,
      layer: system.layer,
      delaySeconds: -((index / routeSites.length) * system.secondsPerRoute),
      secondsPerRoute: system.secondsPerRoute,
      routeStates: system.routeStates,
      route: resolveRoute(system, targetSite),
      animatedArt,
      staticArt,
    }));
  });
}
