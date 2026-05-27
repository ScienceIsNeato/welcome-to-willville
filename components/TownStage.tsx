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
import {
  DISTRICTS,
  TOWN,
  TOWN_CENTER,
  TOWN_OFFSET,
  WORLD,
} from "@/lib/willville";
import type { Stop } from "@/lib/town";
import { isKnownDistrict } from "@/lib/slugs";
import type { CanalBoat } from "@/lib/canal";
import { DistrictZone } from "./DistrictZone";
import { WorldSubstrate } from "./WorldSubstrate";
import { TransitLines } from "./TransitLines";
import { StopMarker } from "./StopMarker";
import { MainLine } from "./MainLine";
import { Canal } from "./Canal";
import { ChimneySmoke } from "./ChimneySmoke";
import { DynamicWalls } from "./DynamicWalls";
import { GeneratedTownBase } from "./GeneratedTownBase";
import { WorldWorkerLayer } from "./WorldWorkerLayer";
import { HollywoodSign } from "./HollywoodSign";
import { BellMessengers } from "./BellMessengers";
import { TownPerfPanel } from "./TownPerfPanel";
import { PanelChromeControls } from "./PanelChromeControls";
import { TownStageChrome } from "./TownStageChrome";
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
import {
  markBellRepoCompletion,
  readManifestProgress,
} from "./townStageManifestProgress";

const MOBILE_TOWN_CAMERA = {
  cx: TOWN_CENTER.x,
  cy: TOWN_CENTER.y,
  scale: 1.35,
};

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
  const populateResetTimerRef = useRef<number | null>(null);

  const [liveStops, setLiveStops] = useState<Stop[] | null>(null);
  const [showCentralBoard, setShowCentralBoard] = useState(true);
  const [showDigitalBoard, setShowDigitalBoard] = useState(false);
  const [centralBoardOpacity, setCentralBoardOpacity] = useState(0.35);
  const [digitalBoardOpacity, setDigitalBoardOpacity] = useState(0.75);
  const [showPerfPanel, setShowPerfPanel] = useState(true);
  const [perfPanelOpacity, setPerfPanelOpacity] = useState(0.94);
  const [mobileSafeMode, setMobileSafeMode] = useState(false);
  const [mobileDrawerExpanded, setMobileDrawerExpanded] = useState(false);
  const [populating, setPopulating] = useState<
    "idle" | "running" | "done" | "error"
  >("idle");
  const [bellStartedAt, setBellStartedAt] = useState<number | null>(null);
  const [bellCompletedAtByStopId, setBellCompletedAtByStopId] = useState<
    Record<string, number>
  >({});
  const [bellErrorMessage, setBellErrorMessage] = useState("✕ Bell failed");
  const [bellHovered, setBellHovered] = useState(false);
  const [eggHovered, setEggHovered] = useState(false);
  const [boardAnnouncement, setBoardAnnouncement] =
    useState<BoardAnnouncement | null>(null);
  const mobileDefaultCameraAppliedRef = useRef(false);

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

    const compactViewport = window.matchMedia("(max-width: 1024px)");
    const touchLikeInput = window.matchMedia(
      "(pointer: coarse) and (hover: none)",
    );

    const apply = () => {
      setMobileSafeMode(compactViewport.matches || touchLikeInput.matches);
    };

    apply();

    if (
      typeof compactViewport.addEventListener === "function" &&
      typeof touchLikeInput.addEventListener === "function"
    ) {
      compactViewport.addEventListener("change", apply);
      touchLikeInput.addEventListener("change", apply);
      return () => {
        compactViewport.removeEventListener("change", apply);
        touchLikeInput.removeEventListener("change", apply);
      };
    }

    compactViewport.addListener(apply);
    touchLikeInput.addListener(apply);
    return () => {
      compactViewport.removeListener(apply);
      touchLikeInput.removeListener(apply);
    };
  }, [isClient]);

  useEffect(
    () => () => {
      if (boardAnnouncementTimerRef.current !== null) {
        window.clearTimeout(boardAnnouncementTimerRef.current);
      }
      if (populateResetTimerRef.current !== null) {
        window.clearTimeout(populateResetTimerRef.current);
      }
    },
    [],
  );

  const handlePopulate = useCallback(() => {
    if (populating === "running") return;
    if (populateResetTimerRef.current !== null) {
      window.clearTimeout(populateResetTimerRef.current);
      populateResetTimerRef.current = null;
    }
    playBellChime();
    const previousStops = currentStops;
    setBellStartedAt(performance.now());
    setBellCompletedAtByStopId({});
    setPopulating("running");
    setBellErrorMessage("✕ Bell failed");
    fetch("/api/manifests", { method: "POST" })
      .then(async (response) => {
        if (response.ok) {
          return readManifestProgress(response, (event) => {
            setBellCompletedAtByStopId((current) =>
              markBellRepoCompletion(current, event.stopId, performance.now()),
            );
          });
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
        const finishedAt = performance.now();
        setBellCompletedAtByStopId((current) => {
          const next = { ...current };
          for (const stop of previousStops) {
            if (next[stop.id] === undefined) {
              next[stop.id] = finishedAt;
            }
          }
          return next;
        });
        setBoardAnnouncement(announcement);
        boardAnnouncementTimerRef.current = window.setTimeout(() => {
          setBoardAnnouncement(null);
          boardAnnouncementTimerRef.current = null;
        }, BELL_BOARD_FLASH_MS);
        setPopulating("done");
        populateResetTimerRef.current = window.setTimeout(() => {
          setPopulating("idle");
          setBellStartedAt(null);
          setBellCompletedAtByStopId({});
          populateResetTimerRef.current = null;
        }, 4000);
      })
      .catch((error: unknown) => {
        const detail =
          error instanceof Error && error.message
            ? error.message
            : "Unknown error";
        setBellErrorMessage(`✕ Bell failed — ${detail}`);
        setPopulating("error");
        populateResetTimerRef.current = window.setTimeout(() => {
          setPopulating("idle");
          setBellStartedAt(null);
          setBellCompletedAtByStopId({});
          populateResetTimerRef.current = null;
        }, 4000);
      });
  }, [currentStops, loadTown, populating]);

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
  const detailBoardVisible = !!boardStop && showDigitalBoard;
  const mobileDrawerVisible = mobileSafeMode && detailBoardVisible;
  const areChromeBoardsHidden = !showCentralBoard && !detailBoardVisible;

  // Keep the route-selected stop in sync without auto-opening the detail panel.
  useEffect(() => {
    if (!pathDistrict || !pathStopId) {
      if (transitioningToStopIdRef.current !== null) {
        return;
      }
      dismissedStopIdRef.current = null;
      const dismiss = window.setTimeout(() => {
        setSelectedStop(null);
        setShowDigitalBoard(false);
        setMobileDrawerExpanded(false);
      }, 0);
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
    const open = window.setTimeout(() => {
      setSelectedStop(stop);
    }, 0);
    return () => window.clearTimeout(open);
  }, [pathDistrict, pathStopId, currentStops]);

  useEffect(() => {
    if (!mobileSafeMode) {
      mobileDefaultCameraAppliedRef.current = false;
      return;
    }
    if (mobileDefaultCameraAppliedRef.current) {
      return;
    }
    if (pathDistrict || boardStop) {
      return;
    }
    setCameraImmediate(MOBILE_TOWN_CAMERA);
    mobileDefaultCameraAppliedRef.current = true;
  }, [boardStop, mobileSafeMode, pathDistrict, setCameraImmediate]);

  const openStopHud = useCallback(
    (stop: Stop) => {
      if (!showCentralBoard || !showDigitalBoard) {
        setShowCentralBoard(true);
        setShowDigitalBoard(true);
      }
      if (mobileSafeMode) {
        setMobileDrawerExpanded(true);
      }
      transitioningToStopIdRef.current = stop.id;
      dismissedStopIdRef.current = null;
      setSelectedStop(stop);
      router.replace(routeWithCurrentSearch(`/${stop.district}/${stop.id}/`), {
        scroll: false,
      });
    },
    [
      mobileSafeMode,
      routeWithCurrentSearch,
      router,
      showCentralBoard,
      showDigitalBoard,
    ],
  );

  const closeHud = useCallback(() => {
    transitioningToStopIdRef.current = null;
    dismissedStopIdRef.current = pathStopId;
    setSelectedStop(null);
    setShowDigitalBoard(false);
    setMobileDrawerExpanded(false);
    router.replace(routeWithCurrentSearch("/"), { scroll: false });
  }, [pathStopId, routeWithCurrentSearch, router]);

  const enterDistrict = useCallback(
    (district: (typeof DISTRICTS)[number]) => {
      transitioningToStopIdRef.current = null;
      dismissedStopIdRef.current = pathStopId;
      setSelectedStop(null);
      setShowDigitalBoard(false);
      setMobileDrawerExpanded(false);
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

  const showWelcomeHint =
    !mobileSafeMode && !boardStop && pathDistrict === null;
  const stageControlTop = mobileSafeMode
    ? showCentralBoard
      ? 132
      : 16
    : showCentralBoard
      ? 196
      : 16;
  const stageControlBottom = mobileSafeMode
    ? mobileDrawerVisible
      ? mobileDrawerExpanded
        ? 360
        : 126
      : 16
    : detailBoardVisible
      ? 236
      : 16;

  return (
    <div
      id="willville-stage"
      style={{
        position: "relative",
        display: "grid",
        gridTemplateRows: mobileSafeMode
          ? "minmax(0, 1fr)"
          : showCentralBoard
            ? detailBoardVisible
              ? "auto minmax(0, 1fr) auto"
              : "auto minmax(0, 1fr)"
            : detailBoardVisible
              ? "minmax(0, 1fr) auto"
              : "minmax(0, 1fr)",
        gap: mobileSafeMode
          ? 0
          : showCentralBoard || detailBoardVisible
            ? 10
            : 0,
        backgroundColor: "#063755",
        backgroundImage:
          "linear-gradient(rgba(6, 55, 85, 0.32), rgba(8, 5, 21, 0.42))",
      }}
    >
      <TownStageChrome
        mobileSafeMode={mobileSafeMode}
        currentStops={currentStops}
        boardStop={boardStop}
        pathDistrict={pathDistrict}
        boats={boats}
        announcementRows={boardAnnouncement?.rows}
        announcementLabel={boardAnnouncement?.label}
        showCentralBoard={showCentralBoard}
        showDigitalBoard={showDigitalBoard}
        detailBoardVisible={detailBoardVisible}
        mobileDrawerExpanded={mobileDrawerExpanded}
        centralBoardOpacity={centralBoardOpacity}
        digitalBoardOpacity={digitalBoardOpacity}
        onSelectStop={openStopHud}
        onToggleCentralBoard={() => {
          setShowCentralBoard((current) => !current);
        }}
        onCentralOpacityChange={setCentralBoardOpacity}
        onShowDigitalBoard={() => {
          setShowDigitalBoard(true);
          setMobileDrawerExpanded(true);
        }}
        onHideDigitalBoard={() => {
          setShowDigitalBoard(false);
          setMobileDrawerExpanded(false);
        }}
        onToggleDigitalBoard={() => {
          setShowDigitalBoard((current) => !current);
        }}
        onDigitalOpacityChange={setDigitalBoardOpacity}
        onToggleMobileDrawerExpanded={() => {
          setMobileDrawerExpanded((current) => !current);
        }}
      >
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
              mobileSafeMode || areChromeBoardsHidden
                ? "xMidYMid slice"
                : "xMidYMid meet"
            }
            width="100%"
            height="100%"
            style={{ pointerEvents: "auto", touchAction: "none" }}
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
              <linearGradient
                id="town-feather-left"
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop offset="0%" stopColor="black" />
                <stop offset="100%" stopColor="white" />
              </linearGradient>
              <linearGradient
                id="town-feather-right"
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
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
                <MainLine
                  stops={currentStops}
                  onEngineClick={closeHud}
                  engineLabel="Return to the town overview"
                />
                {!mobileSafeMode && <Canal boats={boats} layer="traffic" />}
                {!mobileSafeMode && <WorldWorkerLayer stops={currentStops} />}
                {populating !== "idle" && (
                  <BellMessengers
                    stops={currentStops}
                    phase={populating}
                    startedAt={bellStartedAt}
                    completedAtByStopId={bellCompletedAtByStopId}
                  />
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
                zIndex: 2300,
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
        </div>
      </TownStageChrome>
    </div>
  );
}
