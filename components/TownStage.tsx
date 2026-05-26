"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
  useDeferredValue,
  type MouseEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { DISTRICTS, TOWN, TOWN_OFFSET, WORLD } from "@/lib/willville";
import type { Stop } from "@/lib/town";
import { isKnownDistrict } from "@/lib/slugs";
import type { CanalBoat } from "@/lib/canal";
import { DistrictZone } from "./DistrictZone";
import { WorldSubstrate } from "./WorldSubstrate";
import { TransitLines } from "./TransitLines";
import { StopMarker } from "./StopMarker";
import { MainLine } from "./MainLine";
import { CentralBoard } from "./CentralBoard";
import { DigitalDetailBoard } from "./DigitalDetailBoard";
import { Canal } from "./Canal";
import { ChimneySmoke } from "./ChimneySmoke";
import { DynamicWalls } from "./DynamicWalls";
import { GeneratedTownBase } from "./GeneratedTownBase";
import { WorldWorkerLayer } from "./WorldWorkerLayer";
import { HollywoodSign } from "./HollywoodSign";
import { BellMessengers } from "./BellMessengers";
import { TownPerfPanel } from "./TownPerfPanel";
import { PanelChromeControls } from "./PanelChromeControls";
import { screenToWorld, useTownCamera } from "@/hooks/useTownCamera";
import { useTownInteractionProfiler } from "@/hooks/useTownInteractionProfiler";
import { useTownPerfJourney } from "@/hooks/useTownPerfJourney";
import { GENERATED_TOWN_LAYOUT } from "@/lib/town-layout";
import {
  BELL_BOARD_FLASH_MS,
  DAY_MS,
  TOWN_ART_FEATHER,
  buildBellBoardAnnouncement,
  buildEasterEggAnnouncement,
  findStopAt,
  getBellErrorDetail,
  mergeStops,
  playBellChime,
  useIsClient,
  type BoardAnnouncement,
} from "./townStageUtils";

/**
 * Persistent SVG stage with viewport camera (pan/zoom) and center HUD for stops.
 */
export function TownStage({ initialStops }: { initialStops: Stop[] }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [stops] = useState<Stop[]>(initialStops);
  const isClient = useIsClient();
  const deferredPathname = useDeferredValue(pathname);
  const perfSearchParams = useMemo(() => {
    if (!isClient) return null;
    return new URLSearchParams(window.location.search);
  }, [deferredPathname, isClient]);
  const perfEnabled = perfSearchParams?.get("perf") === "1";
  const perfAutorun = perfSearchParams?.get("autorun") === "1";
  const routeWithCurrentSearch = useCallback(
    (path: string) => {
      if (!isClient || !window.location.search) return path;
      return `${path}${window.location.search}`;
    },
    [isClient],
  );
  const [now, setNow] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cameraGroupRef = useRef<SVGGElement>(null);
  const perfProfiler = useTownInteractionProfiler(perfEnabled);
  const perfProbe = useMemo(
    () => ({
      measure: perfProfiler.measure,
      scheduleFrameSample: perfProfiler.scheduleFrameSample,
    }),
    [perfProfiler.measure, perfProfiler.scheduleFrameSample],
  );

  const {
    getCameraSnapshot,
    isDragging,
    cameraTransform,
    markSkipDrag,
    setCameraImmediate,
    zoomAtWorldPoint,
    stageHandlers,
    wasDragging,
  } = useTownCamera(svgRef, stageRef, perfEnabled ? perfProbe : undefined);

  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const dismissedStopIdRef = useRef<string | null>(null);
  const transitioningToStopIdRef = useRef<string | null>(null);
  const boardAnnouncementTimerRef = useRef<number | null>(null);

  const [liveStops, setLiveStops] = useState<Stop[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showCentralBoard, setShowCentralBoard] = useState(true);
  const [showDigitalBoard, setShowDigitalBoard] = useState(true);
  const [centralBoardOpacity, setCentralBoardOpacity] = useState(0.94);
  const [digitalBoardOpacity, setDigitalBoardOpacity] = useState(0.94);
  const [showPerfPanel, setShowPerfPanel] = useState(true);
  const [perfPanelOpacity, setPerfPanelOpacity] = useState(0.94);
  const [mobileSafeMode, setMobileSafeMode] = useState(false);
  const [populating, setPopulating] = useState<
    "idle" | "running" | "done" | "error"
  >("idle");
  const [bellErrorMessage, setBellErrorMessage] = useState("✕ Bell failed");
  const [bellHovered, setBellHovered] = useState(false);
  const [eggHovered, setEggHovered] = useState(false);
  const [boardAnnouncement, setBoardAnnouncement] =
    useState<BoardAnnouncement | null>(null);

  const currentStops = useMemo(
    () => mergeStops(stops, liveStops),
    [liveStops, stops],
  );

  const loadTown = useCallback(
    (options: { signal?: AbortSignal; fresh?: boolean } = {}) => {
      const url = options.fresh
        ? `/api/town?refresh=${encodeURIComponent(String(Date.now()))}`
        : "/api/town";
      return fetch(url, {
        cache: options.fresh ? "no-store" : "default",
        signal: options.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.stops)) {
            setLiveStops(data.stops as Stop[]);
          }
          return data;
        });
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadTown({ signal: controller.signal }).catch(() => undefined);
    return () => {
      controller.abort();
    };
  }, [loadTown]);

  useEffect(() => {
    if (!isClient || typeof window.matchMedia !== "function") {
      return;
    }

    const media = window.matchMedia(
      "(pointer: coarse) and (hover: none) and (max-width: 1024px)",
    );

    const apply = () => {
      setMobileSafeMode(media.matches);
    };

    apply();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", apply);
      return () => {
        media.removeEventListener("change", apply);
      };
    }

    media.addListener(apply);
    return () => {
      media.removeListener(apply);
    };
  }, [isClient]);

  useEffect(
    () => () => {
      if (boardAnnouncementTimerRef.current !== null) {
        window.clearTimeout(boardAnnouncementTimerRef.current);
      }
    },
    [],
  );

  const handlePopulate = useCallback(() => {
    if (populating === "running") return;
    playBellChime();
    const previousStops = currentStops;
    setPopulating("running");
    setBellErrorMessage("✕ Bell failed");
    fetch("/api/manifests", { method: "POST" })
      .then(async (response) => {
        if (response.ok) {
          return response.json();
        }

        throw new Error(await getBellErrorDetail(response));
      })
      .then(() => loadTown({ fresh: true }))
      .then((data) => {
        const nextStops =
          data && Array.isArray(data.stops)
            ? mergeStops(previousStops, data.stops as Stop[])
            : previousStops;
        const announcement = buildBellBoardAnnouncement(
          previousStops,
          nextStops,
        );
        if (boardAnnouncementTimerRef.current !== null) {
          window.clearTimeout(boardAnnouncementTimerRef.current);
        }
        setBoardAnnouncement(announcement);
        boardAnnouncementTimerRef.current = window.setTimeout(() => {
          setBoardAnnouncement(null);
          boardAnnouncementTimerRef.current = null;
        }, BELL_BOARD_FLASH_MS);
        setPopulating("done");
        setTimeout(() => setPopulating("idle"), 4000);
      })
      .catch((error: unknown) => {
        const detail =
          error instanceof Error && error.message
            ? error.message
            : "Unknown error";
        setBellErrorMessage(`✕ Bell failed — ${detail}`);
        setPopulating("error");
        setTimeout(() => setPopulating("idle"), 4000);
      });
  }, [currentStops, loadTown, populating]);

  const handleSync = useCallback(() => {
    setSyncing(true);
    loadTown({ fresh: true })
      .catch(() => undefined)
      .finally(() => setSyncing(false));
  }, [loadTown]);

  const handleEasterEgg = useCallback(() => {
    if (boardAnnouncementTimerRef.current !== null) {
      window.clearTimeout(boardAnnouncementTimerRef.current);
    }
    setBoardAnnouncement(buildEasterEggAnnouncement());
    boardAnnouncementTimerRef.current = window.setTimeout(() => {
      setBoardAnnouncement(null);
      boardAnnouncementTimerRef.current = null;
    }, BELL_BOARD_FLASH_MS);
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
    return () => {
      cancelled = true;
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

  useLayoutEffect(() => {
    const applyTransform = (value: string) => {
      if (perfEnabled) {
        perfProbe.measure("domApply", () => {
          cameraGroupRef.current?.setAttribute("transform", value);
        });
        return;
      }
      cameraGroupRef.current?.setAttribute("transform", value);
    };
    applyTransform(cameraTransform.get());
    return cameraTransform.on("change", applyTransform);
  }, [cameraTransform, perfEnabled, perfProbe]);

  const { runOfficialPerfProfile, downloadPerfReport } = useTownPerfJourney({
    currentStops,
    getCameraSnapshot,
    perfAutorun,
    perfEnabled,
    perfProfiler,
    setCameraImmediate,
    stageRef,
    svgRef,
  });

  const hydratedSelectedStop = selectedStop
    ? (currentStops.find(
        (s) => s.district === selectedStop.district && s.id === selectedStop.id,
      ) ?? selectedStop)
    : null;

  const parts = pathname.split("/").filter(Boolean);
  const districtSlug = parts[0] ?? "";
  const pathDistrict = isKnownDistrict(districtSlug) ? districtSlug : null;
  const pathStopId = parts[1] ?? null;
  const pathSelectedStop =
    pathDistrict && pathStopId
      ? (currentStops.find(
          (s) => s.district === pathDistrict && s.id === pathStopId,
        ) ?? null)
      : null;
  const boardStop = hydratedSelectedStop ?? pathSelectedStop;
  const areChromeBoardsHidden = !showCentralBoard && !showDigitalBoard;

  // Deep link: open HUD without reframing camera.
  useEffect(() => {
    if (!pathDistrict || !pathStopId) {
      if (transitioningToStopIdRef.current !== null) {
        return;
      }
      dismissedStopIdRef.current = null;
      const dismiss = window.setTimeout(() => setSelectedStop(null), 0);
      return () => window.clearTimeout(dismiss);
    }
    if (pathStopId === transitioningToStopIdRef.current) {
      transitioningToStopIdRef.current = null;
    }
    if (pathStopId === dismissedStopIdRef.current) {
      return;
    }
    dismissedStopIdRef.current = null;
    const stop = currentStops.find(
      (s) => s.district === pathDistrict && s.id === pathStopId,
    );
    if (!stop) return;
    const open = window.setTimeout(() => setSelectedStop(stop), 0);
    return () => window.clearTimeout(open);
  }, [pathDistrict, pathStopId, currentStops]);

  const openStopHud = useCallback(
    (stop: Stop) => {
      if (!showCentralBoard || !showDigitalBoard) {
        setShowCentralBoard(true);
        setShowDigitalBoard(true);
      }
      transitioningToStopIdRef.current = stop.id;
      dismissedStopIdRef.current = null;
      setSelectedStop(stop);
      router.replace(routeWithCurrentSearch(`/${stop.district}/${stop.id}/`), {
        scroll: false,
      });
    },
    [routeWithCurrentSearch, router, showCentralBoard, showDigitalBoard],
  );

  const closeHud = useCallback(() => {
    transitioningToStopIdRef.current = null;
    dismissedStopIdRef.current = pathStopId;
    setSelectedStop(null);
    router.replace(routeWithCurrentSearch("/"), { scroll: false });
  }, [pathStopId, routeWithCurrentSearch, router]);

  const enterDistrict = useCallback(
    (district: (typeof DISTRICTS)[number]) => {
      transitioningToStopIdRef.current = null;
      dismissedStopIdRef.current = pathStopId;
      setSelectedStop(null);
      router.push(routeWithCurrentSearch(`/${district.id}/`), {
        scroll: false,
      });
    },
    [pathStopId, routeWithCurrentSearch, router],
  );

  const handleStageClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const svg = svgRef.current;
      if (!svg || wasDragging()) return;
      const snap = getCameraSnapshot();
      const { wx, wy } = screenToWorld(svg, e.clientX, e.clientY, snap);
      const hit = findStopAt(currentStops, wx, wy, snap.scale);
      if (hit) openStopHud(hit);
    },
    [currentStops, getCameraSnapshot, wasDragging, openStopHud],
  );

  const handleStageDoubleClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      markSkipDrag();
      const svg = svgRef.current;
      if (!svg) return;
      const snap = getCameraSnapshot();
      const { wx, wy } = screenToWorld(svg, e.clientX, e.clientY, snap);
      const hit = findStopAt(currentStops, wx, wy, snap.scale);
      if (hit) {
        zoomAtWorldPoint(wx, wy);
        openStopHud(hit);
        return;
      }
      zoomAtWorldPoint(wx, wy);
      if (selectedStop) {
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

  const handleStopClick = useCallback(
    (e: MouseEvent<SVGGElement>, stop: Stop) => {
      e.stopPropagation();
      markSkipDrag();
      openStopHud(stop);
    },
    [markSkipDrag, openStopHud],
  );

  const handleStopDoubleClick = useCallback(
    (e: MouseEvent<SVGGElement>, stop: Stop) => {
      e.stopPropagation();
      markSkipDrag();
      const wx = TOWN_OFFSET.x + stop.position.x;
      const wy = TOWN_OFFSET.y + stop.position.y;
      zoomAtWorldPoint(wx, wy);
      openStopHud(stop);
    },
    [markSkipDrag, openStopHud, zoomAtWorldPoint],
  );

  const showWelcomeHint = !boardStop && pathDistrict === null;
  const stageControlTop = showCentralBoard ? 196 : 16;
  const stageControlBottom = showDigitalBoard ? 236 : 16;

  return (
    <div
      id="willville-stage"
      style={{
        position: "relative",
        display: "grid",
        gridTemplateRows: showCentralBoard
          ? showDigitalBoard
            ? "auto minmax(0, 1fr) auto"
            : "auto minmax(0, 1fr)"
          : showDigitalBoard
            ? "minmax(0, 1fr) auto"
            : "minmax(0, 1fr)",
        gap: showCentralBoard || showDigitalBoard ? 10 : 0,
        backgroundColor: "#063755",
        backgroundImage:
          "linear-gradient(rgba(6, 55, 85, 0.32), rgba(8, 5, 21, 0.42))",
      }}
    >
      {showCentralBoard && (
        <div
          style={{
            gridRow: "1 / 2",
            position: "relative",
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          <CentralBoard
            stops={currentStops}
            selectedStop={boardStop}
            activeDistrict={pathDistrict}
            onSelectStop={openStopHud}
            announcementRows={boardAnnouncement?.rows}
            announcementLabel={boardAnnouncement?.label}
            panelOpacity={centralBoardOpacity}
          />

          <div
            style={{
              position: "absolute",
              top: 10,
              right: 14,
              zIndex: 4,
              pointerEvents: "auto",
            }}
          >
            <PanelChromeControls
              panelLabel="Time Central panel"
              visible={showCentralBoard}
              opacity={centralBoardOpacity}
              onToggleVisibility={() => {
                setShowCentralBoard((current) => !current);
              }}
              onOpacityChange={setCentralBoardOpacity}
            />
          </div>
        </div>
      )}

      <div
        ref={stageRef}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          minHeight: 0,
          touchAction: "none",
          cursor: isDragging ? "grabbing" : "default",
          overflow: "hidden",
        }}
        onClick={handleStageClick}
        onDoubleClick={handleStageDoubleClick}
        {...stageHandlers}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WORLD.width} ${WORLD.height}`}
          preserveAspectRatio={
            areChromeBoardsHidden ? "xMidYMid slice" : "xMidYMid meet"
          }
          width="100%"
          height="100%"
          style={{ pointerEvents: "auto" }}
        >
          <defs>
            <linearGradient id="town-feather-top" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="black" />
              <stop offset="100%" stopColor="white" />
            </linearGradient>
            <linearGradient
              id="town-feather-bottom"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="white" />
              <stop offset="100%" stopColor="black" />
            </linearGradient>
            <linearGradient id="town-feather-left" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="black" />
              <stop offset="100%" stopColor="white" />
            </linearGradient>
            <linearGradient id="town-feather-right" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="white" />
              <stop offset="100%" stopColor="black" />
            </linearGradient>
            <radialGradient
              id="town-feather-corner-top-left"
              gradientUnits="userSpaceOnUse"
              cx={TOWN_ART_FEATHER}
              cy={TOWN_ART_FEATHER}
              r={TOWN_ART_FEATHER}
            >
              <stop offset="0%" stopColor="white" />
              <stop offset="100%" stopColor="black" />
            </radialGradient>
            <radialGradient
              id="town-feather-corner-top-right"
              gradientUnits="userSpaceOnUse"
              cx={TOWN.width - TOWN_ART_FEATHER}
              cy={TOWN_ART_FEATHER}
              r={TOWN_ART_FEATHER}
            >
              <stop offset="0%" stopColor="white" />
              <stop offset="100%" stopColor="black" />
            </radialGradient>
            <radialGradient
              id="town-feather-corner-bottom-left"
              gradientUnits="userSpaceOnUse"
              cx={TOWN_ART_FEATHER}
              cy={TOWN.height - TOWN_ART_FEATHER}
              r={TOWN_ART_FEATHER}
            >
              <stop offset="0%" stopColor="white" />
              <stop offset="100%" stopColor="black" />
            </radialGradient>
            <radialGradient
              id="town-feather-corner-bottom-right"
              gradientUnits="userSpaceOnUse"
              cx={TOWN.width - TOWN_ART_FEATHER}
              cy={TOWN.height - TOWN_ART_FEATHER}
              r={TOWN_ART_FEATHER}
            >
              <stop offset="0%" stopColor="white" />
              <stop offset="100%" stopColor="black" />
            </radialGradient>
            <mask
              id="town-art-feather-mask"
              maskUnits="userSpaceOnUse"
              maskContentUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={TOWN.width}
              height={TOWN.height}
            >
              <rect width={TOWN.width} height={TOWN.height} fill="black" />
              <rect
                x={TOWN_ART_FEATHER}
                y={TOWN_ART_FEATHER}
                width={TOWN.width - TOWN_ART_FEATHER * 2}
                height={TOWN.height - TOWN_ART_FEATHER * 2}
                fill="white"
              />
              <rect
                x={TOWN_ART_FEATHER}
                width={TOWN.width - TOWN_ART_FEATHER * 2}
                height={TOWN_ART_FEATHER}
                fill="url(#town-feather-top)"
              />
              <rect
                x={TOWN_ART_FEATHER}
                y={TOWN.height - TOWN_ART_FEATHER}
                width={TOWN.width - TOWN_ART_FEATHER * 2}
                height={TOWN_ART_FEATHER}
                fill="url(#town-feather-bottom)"
              />
              <rect
                y={TOWN_ART_FEATHER}
                width={TOWN_ART_FEATHER}
                height={TOWN.height - TOWN_ART_FEATHER * 2}
                fill="url(#town-feather-left)"
              />
              <rect
                x={TOWN.width - TOWN_ART_FEATHER}
                y={TOWN_ART_FEATHER}
                width={TOWN_ART_FEATHER}
                height={TOWN.height - TOWN_ART_FEATHER * 2}
                fill="url(#town-feather-right)"
              />
              <rect
                width={TOWN_ART_FEATHER}
                height={TOWN_ART_FEATHER}
                fill="url(#town-feather-corner-top-left)"
              />
              <rect
                x={TOWN.width - TOWN_ART_FEATHER}
                width={TOWN_ART_FEATHER}
                height={TOWN_ART_FEATHER}
                fill="url(#town-feather-corner-top-right)"
              />
              <rect
                y={TOWN.height - TOWN_ART_FEATHER}
                width={TOWN_ART_FEATHER}
                height={TOWN_ART_FEATHER}
                fill="url(#town-feather-corner-bottom-left)"
              />
              <rect
                x={TOWN.width - TOWN_ART_FEATHER}
                y={TOWN.height - TOWN_ART_FEATHER}
                width={TOWN_ART_FEATHER}
                height={TOWN_ART_FEATHER}
                fill="url(#town-feather-corner-bottom-right)"
              />
            </mask>
          </defs>

          <g ref={cameraGroupRef} transform={cameraTransform.get()}>
            <WorldSubstrate />

            <g transform={`translate(${TOWN_OFFSET.x}, ${TOWN_OFFSET.y})`}>
              <GeneratedTownBase stops={currentStops} />
              {!mobileSafeMode && <ChimneySmoke />}
              {!mobileSafeMode && <DynamicWalls />}
              <Canal boats={boats} layer="base" />
              {DISTRICTS.map((d) => (
                <DistrictZone
                  key={d.id}
                  district={d}
                  layer="hit"
                  onEnterDistrict={enterDistrict}
                />
              ))}
              <TransitLines />
              <MainLine stops={currentStops} />
              {!mobileSafeMode && <Canal boats={boats} layer="traffic" />}
              {!mobileSafeMode && <WorldWorkerLayer stops={currentStops} />}
              {populating !== "idle" && (
                <BellMessengers stops={currentStops} phase={populating} />
              )}
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
                    isFocused={
                      boardStop?.district === stop.district &&
                      boardStop?.id === stop.id
                    }
                    recentlyUpdated={recently}
                    onClick={(e) => handleStopClick(e, stop)}
                    onDoubleClick={(e) => handleStopDoubleClick(e, stop)}
                  />
                );
              })}
              {DISTRICTS.map((d) => (
                <DistrictZone
                  key={`label-${d.id}`}
                  district={d}
                  layer="label"
                  onEnterDistrict={enterDistrict}
                />
              ))}
              {!mobileSafeMode && <HollywoodSign />}

              {/* Easter egg — tucked in the bottom-right */}
              <g
                transform="translate(1440, 1100)"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setEggHovered(true)}
                onMouseLeave={() => setEggHovered(false)}
                onClick={(e) => {
                  e.stopPropagation();
                  markSkipDrag();
                  handleEasterEgg();
                }}
              >
                <circle r={18} fill="transparent" pointerEvents="all" />
                <image
                  href="/art/egg.png"
                  x={-14}
                  y={-18}
                  width={28}
                  height={36}
                  opacity={eggHovered ? 1 : 0.6}
                  style={{ transition: "opacity 0.3s" }}
                />
              </g>

              {/* Town square — clock tower bell */}
              <g
                transform={`translate(${GENERATED_TOWN_LAYOUT.landmarks.bellTower.x}, ${GENERATED_TOWN_LAYOUT.landmarks.bellTower.y})`}
                style={{
                  cursor: populating === "running" ? "wait" : "pointer",
                }}
                onMouseEnter={() => setBellHovered(true)}
                onMouseLeave={() => setBellHovered(false)}
                onClick={(e) => {
                  e.stopPropagation();
                  markSkipDrag();
                  handlePopulate();
                }}
              >
                {/* large invisible hit area — generous polygon covering the full tower */}
                <polygon
                  points="0,-155 42,-130 54,-88 58,-42 64,6 42,24 0,32 -42,24 -64,6 -58,-42 -54,-88 -42,-130"
                  fill="transparent"
                  pointerEvents="all"
                />

                {/* hover outline — traces the tower silhouette */}
                {bellHovered && populating === "idle" && (
                  <polygon
                    points="0,-145 38,-122 48,-80 50,-38 58,4 38,20 0,28 -38,20 -58,4 -50,-38 -48,-80 -38,-122"
                    fill="none"
                    stroke="rgba(230,198,106,0.55)"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    strokeLinejoin="round"
                  />
                )}

                {/* running pulse outline */}
                {populating === "running" && (
                  <polygon
                    points="0,-145 38,-122 48,-80 50,-38 58,4 38,20 0,28 -38,20 -58,4 -50,-38 -48,-80 -38,-122"
                    fill="none"
                    stroke="rgba(230,198,106,0.8)"
                    strokeWidth={2}
                    strokeLinejoin="round"
                  />
                )}

                {/* tooltip */}
                {bellHovered &&
                  (populating === "idle" || populating === "running") && (
                    <g style={{ pointerEvents: "none" }}>
                      <rect
                        x={populating === "running" ? -86 : -68}
                        y={-88}
                        width={populating === "running" ? 172 : 136}
                        height={24}
                        rx={5}
                        fill="rgba(12,7,22,0.88)"
                        stroke="rgba(230,198,106,0.35)"
                        strokeWidth={1}
                      />
                      <text
                        x={0}
                        y={-71}
                        textAnchor="middle"
                        fontSize={13}
                        fill="#e6c66a"
                        fontFamily="var(--font-sans, sans-serif)"
                      >
                        {populating === "running"
                          ? "The Town Bell Sees All"
                          : "Ring the town bell"}
                      </text>
                    </g>
                  )}
              </g>
            </g>
          </g>
        </svg>

        {populating !== "idle" && (
          <div
            style={{
              position: "absolute",
              top: stageControlTop,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(18,10,6,0.92)",
              border: `1px solid ${
                populating === "done"
                  ? "rgba(100,200,100,0.5)"
                  : populating === "error"
                    ? "rgba(220,80,80,0.5)"
                    : "rgba(230,198,106,0.4)"
              }`,
              borderRadius: 8,
              padding: "8px 16px",
              color: "var(--willville-paper)",
              fontSize: 13,
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            {populating === "running" && "The Town Bell Sees All"}
            {populating === "done" && "✓ Manifests updated"}
            {populating === "error" && bellErrorMessage}
          </div>
        )}

        {showWelcomeHint && (
          <motion.div
            style={{
              position: "absolute",
              bottom: stageControlBottom,
              left: 16,
              color: "var(--willville-paper)",
              opacity: 0.8,
              fontSize: 14,
              letterSpacing: 0.6,
              pointerEvents: "none",
              textShadow: "0 1px 4px rgba(0,0,0,0.6)",
            }}
          >
            Welcome to Willville · scroll to zoom · drag to pan · double-click
            to zoom in
          </motion.div>
        )}

        <button
          data-town-control
          onClick={handleSync}
          disabled={syncing}
          aria-label="Sync town data from GitHub"
          title="Sync from GitHub"
          style={{
            position: "absolute",
            bottom: stageControlBottom,
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

        {perfEnabled && showPerfPanel && (
          <div data-town-control style={{ pointerEvents: "none" }}>
            <TownPerfPanel
              report={perfProfiler.report}
              running={perfProfiler.running}
              panelOpacity={perfPanelOpacity}
              onRun={() => {
                void runOfficialPerfProfile();
              }}
              onClear={perfProfiler.clearReport}
              onDownload={downloadPerfReport}
              onSaveBaseline={perfProfiler.saveCurrentAsBaseline}
              onClearBaseline={perfProfiler.clearCurrentBaseline}
            />
          </div>
        )}

        {perfEnabled && (
          <div
            data-town-control
            style={{
              position: "fixed",
              top: "10dvh",
              left: 14,
              zIndex: 1500,
            }}
          >
            <PanelChromeControls
              panelLabel="Performance panel"
              visible={showPerfPanel}
              opacity={perfPanelOpacity}
              onToggleVisibility={() => {
                setShowPerfPanel((current) => !current);
              }}
              onOpacityChange={setPerfPanelOpacity}
            />
          </div>
        )}

        <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      </div>

      {!showCentralBoard && (
        <div
          style={{
            position: "absolute",
            top: 14,
            right: 16,
            zIndex: 20,
          }}
        >
          <PanelChromeControls
            panelLabel="Time Central panel"
            visible={showCentralBoard}
            opacity={centralBoardOpacity}
            onToggleVisibility={() => {
              setShowCentralBoard((current) => !current);
            }}
            onOpacityChange={setCentralBoardOpacity}
          />
        </div>
      )}

      {showDigitalBoard && (
        <div
          style={{
            gridRow: "3 / 4",
            position: "relative",
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          <DigitalDetailBoard
            stop={boardStop}
            boats={boats}
            panelOpacity={digitalBoardOpacity}
          />

          <div
            style={{
              position: "absolute",
              top: 10,
              right: 14,
              zIndex: 4,
              pointerEvents: "auto",
            }}
          >
            <PanelChromeControls
              panelLabel="Digital detail panel"
              visible={showDigitalBoard}
              opacity={digitalBoardOpacity}
              onToggleVisibility={() => {
                setShowDigitalBoard((current) => !current);
              }}
              onOpacityChange={setDigitalBoardOpacity}
            />
          </div>
        </div>
      )}

      {!showDigitalBoard && (
        <div
          style={{
            position: "absolute",
            right: 16,
            bottom: 62,
            zIndex: 20,
          }}
        >
          <PanelChromeControls
            panelLabel="Digital detail panel"
            visible={showDigitalBoard}
            opacity={digitalBoardOpacity}
            onToggleVisibility={() => {
              setShowDigitalBoard((current) => !current);
            }}
            onOpacityChange={setDigitalBoardOpacity}
            popoverDirection="up"
          />
        </div>
      )}
    </div>
  );
}
