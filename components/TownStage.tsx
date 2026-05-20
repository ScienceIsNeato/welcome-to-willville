"use client";

import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useSyncExternalStore,
  type MouseEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { DISTRICTS, TOWN, TOWN_OFFSET, WORLD } from "@/lib/willville";
import { type Stop } from "@/lib/town";
import { isKnownDistrict } from "@/lib/slugs";
import type { CanalBoat } from "@/lib/canal";
import { DistrictZone } from "./DistrictZone";
import { BucolicMargin } from "./BucolicMargin";
import { TransitLines } from "./TransitLines";
import { StopMarker } from "./StopMarker";
import { ProjectHud } from "./ProjectHud";
import { MainLine } from "./MainLine";
import { MayorsExpressHud } from "./MayorsExpressHud";
import { Canal } from "./Canal";
import { ChimneySmoke } from "./ChimneySmoke";
import { DynamicWalls } from "./DynamicWalls";
import { screenToWorld, useTownCamera } from "@/hooks/useTownCamera";

const DAY_MS = 1000 * 60 * 60 * 24;
const STOP_HIT_RADIUS = 24;

function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function findStopAt(
  stops: Stop[],
  wx: number,
  wy: number,
  scale: number,
): Stop | null {
  const threshold = STOP_HIT_RADIUS / scale;
  const thresholdSq = threshold * threshold;
  let best: Stop | null = null;
  let bestDist = thresholdSq;
  for (const stop of stops) {
    const sx = TOWN_OFFSET.x + stop.position.x;
    const sy = TOWN_OFFSET.y + stop.position.y;
    const dx = wx - sx;
    const dy = wy - sy;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = stop;
    }
  }
  return best;
}

/**
 * Persistent SVG stage with viewport camera (pan/zoom) and center HUD for stops.
 */
export function TownStage({ initialStops }: { initialStops: Stop[] }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [stops] = useState<Stop[]>(initialStops);
  const isClient = useIsClient();
  const [now, setNow] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const {
    getCameraSnapshot,
    isDragging,
    gX,
    gY,
    mvScale,
    markSkipDrag,
    zoomAtWorldPoint,
    stageHandlers,
  } = useTownCamera(svgRef, stageRef);

  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const hudDismissPendingRef = useRef(false);

  const [liveStops, setLiveStops] = useState<Stop[] | null>(null);
  const [isMayor, setIsMayor] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/town")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.stops)) {
          setLiveStops(data.stops as Stop[]);
          setIsMayor(data.mayor === true);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSync = useCallback(() => {
    setSyncing(true);
    fetch("/api/town")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.stops)) {
          setLiveStops(data.stops as Stop[]);
        }
      })
      .catch(() => undefined)
      .finally(() => setSyncing(false));
  }, []);

  const [boats, setBoats] = useState<CanalBoat[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/canal")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!cancelled && data && Array.isArray(data.boats)) {
            setBoats(data.boats as CanalBoat[]);
          }
        })
        .catch(() => undefined);
    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => setNow(Date.now()), 0);
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, []);

  const currentStops = liveStops ?? stops;

  const parts = pathname.split("/").filter(Boolean);
  const districtSlug = parts[0] ?? "";
  const pathDistrict = isKnownDistrict(districtSlug) ? districtSlug : null;
  const pathStopId = parts[1] ?? null;

  // Deep link: open HUD without reframing camera.
  useEffect(() => {
    if (!pathDistrict || !pathStopId) {
      hudDismissPendingRef.current = false;
      return;
    }
    if (hudDismissPendingRef.current) return;
    const stop = currentStops.find(
      (s) => s.district === pathDistrict && s.id === pathStopId,
    );
    if (!stop) return;
    const open = window.setTimeout(() => setSelectedStop(stop), 0);
    return () => window.clearTimeout(open);
  }, [pathDistrict, pathStopId, currentStops]);

  const openStopHud = useCallback((stop: Stop) => {
    setSelectedStop(stop);
    window.history.replaceState(null, "", `/${stop.district}/${stop.id}/`);
  }, []);

  const closeHud = useCallback(() => {
    hudDismissPendingRef.current = true;
    window.history.replaceState(null, "", "/");
    setSelectedStop(null);
    router.replace("/", { scroll: false });
  }, [router]);

  const enterDistrict = useCallback(
    (district: (typeof DISTRICTS)[number]) => {
      hudDismissPendingRef.current = false;
      setSelectedStop(null);
      router.push(`/${district.id}/`);
    },
    [router],
  );

  const handleStageClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const svg = svgRef.current;
      if (!svg || isDragging) return;
      const snap = getCameraSnapshot();
      const { wx, wy } = screenToWorld(svg, e.clientX, e.clientY, snap);
      const hit = findStopAt(currentStops, wx, wy, snap.scale);
      if (hit) openStopHud(hit);
    },
    [currentStops, getCameraSnapshot, isDragging, openStopHud],
  );

  const handleStageDoubleClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      markSkipDrag();
      const svg = svgRef.current;
      if (!svg) return;
      const snap = getCameraSnapshot();
      const { wx, wy } = screenToWorld(svg, e.clientX, e.clientY, snap);
      zoomAtWorldPoint(wx, wy);
      const hit = findStopAt(currentStops, wx, wy, snap.scale);
      if (hit) {
        openStopHud(hit);
      } else if (selectedStop) {
        closeHud();
      }
    },
    [
      closeHud,
      currentStops,
      getCameraSnapshot,
      markSkipDrag,
      openStopHud,
      selectedStop,
      zoomAtWorldPoint,
    ],
  );

  const handleStopDoubleClick = useCallback(
    (stop: Stop) => {
      const wx = TOWN_OFFSET.x + stop.position.x;
      const wy = TOWN_OFFSET.y + stop.position.y;
      zoomAtWorldPoint(wx, wy);
      openStopHud(stop);
    },
    [openStopHud, zoomAtWorldPoint],
  );

  const showWelcomeHint = !selectedStop && pathDistrict === null;

  return (
    <div
      id="willville-stage"
      ref={stageRef}
      style={{
        touchAction: "none",
        cursor: isDragging ? "grabbing" : "default",
        background:
          "linear-gradient(180deg, #283b6d 0%, #283b6d 28%, #244631 72%, #244631 100%)",
      }}
      onClick={handleStageClick}
      onDoubleClick={handleStageDoubleClick}
      {...stageHandlers}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WORLD.width} ${WORLD.height}`}
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        height="100%"
        style={{ pointerEvents: isDragging ? "none" : "auto" }}
      >
        <defs>
          <radialGradient id="ground" cx="50%" cy="42%" r="65%">
            <stop offset="0%" stopColor="#3b2a5e" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#15102a" stopOpacity="0.95" />
          </radialGradient>
        </defs>

        <motion.g
          style={{
            x: gX,
            y: gY,
            scale: mvScale,
            transformOrigin: `${WORLD.width / 2}px ${WORLD.height / 2}px`,
          }}
        >
          <BucolicMargin />

          <g transform={`translate(${TOWN_OFFSET.x}, ${TOWN_OFFSET.y})`}>
            <rect
              x={0}
              y={0}
              width={TOWN.width}
              height={TOWN.height}
              fill="url(#ground)"
            />
            <image
              href="/art/town/willville-v3-closed-loops-draft.png"
              x={0}
              y={0}
              width={TOWN.width}
              height={TOWN.height}
              preserveAspectRatio="none"
            />
            <ChimneySmoke />
            <DynamicWalls />
            {DISTRICTS.map((d) => (
              <DistrictZone
                key={d.id}
                district={d}
                onEnterDistrict={enterDistrict}
              />
            ))}
            <TransitLines />
            <MainLine stops={currentStops} />
            {currentStops.map((stop) => {
              const updated = stop.status.updated
                ? Date.parse(stop.status.updated)
                : NaN;
              const recently =
                isClient &&
                now !== null &&
                !Number.isNaN(updated) &&
                now - updated < DAY_MS;
              return (
                <StopMarker
                  key={`${stop.district}-${stop.id}`}
                  stop={stop}
                  isFocused={selectedStop?.id === stop.id}
                  recentlyUpdated={recently}
                  onClick={() => openStopHud(stop)}
                  onDoubleClick={() => handleStopDoubleClick(stop)}
                />
              );
            })}
            <Canal boats={boats} />
          </g>
        </motion.g>
      </svg>

      {selectedStop && (
        <ProjectHud
          stop={selectedStop}
          boats={boats}
          allStops={currentStops}
          onClose={closeHud}
        />
      )}

      {!selectedStop && (
        <MayorsExpressHud stops={currentStops} onSelectStop={openStopHud} />
      )}

      {showWelcomeHint && (
        <motion.div
          style={{
            position: "absolute",
            bottom: 16,
            left: 16,
            color: "var(--willville-paper)",
            opacity: 0.8,
            fontSize: 14,
            letterSpacing: 0.6,
            pointerEvents: "none",
            textShadow: "0 1px 4px rgba(0,0,0,0.6)",
          }}
        >
          Welcome to Willville · scroll to zoom · drag to pan · double-click to
          zoom in
        </motion.div>
      )}

      {isMayor && (
        <button
          onClick={handleSync}
          disabled={syncing}
          aria-label="Sync town data from GitHub"
          title="Sync from GitHub"
          style={{
            position: "absolute",
            bottom: 16,
            right: 16,
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "1px solid rgba(230,198,106,0.45)",
            background:
              "linear-gradient(180deg, rgba(36,24,12,0.92) 0%, rgba(20,12,6,0.96) 100%)",
            color: "var(--willville-paper)",
            fontSize: 18,
            cursor: syncing ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow:
              "0 4px 12px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(230,198,106,0.2)",
            opacity: syncing ? 0.6 : 1,
            transition: "opacity 0.2s",
          }}
        >
          <span
            style={{
              display: "inline-block",
              animation: syncing ? "spin 1s linear infinite" : "none",
            }}
          >
            ↻
          </span>
        </button>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
