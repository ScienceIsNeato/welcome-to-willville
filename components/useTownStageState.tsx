"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
  type MouseEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { DISTRICTS, TOWN, TOWN_OFFSET, type DistrictId } from "@/lib/willville";
import type { Stop } from "@/lib/town";
import { isKnownDistrict, KNOWN_STOPS } from "@/lib/slugs";
import type { CanalBoat, LockId } from "@/lib/canal";
import { sitePositionForStop } from "@/lib/town-layout";
import { type RepositionStopDelta } from "./repositionPlannerUtils";
import { useRepaintPipeline } from "./useRepaintPipeline";
import { usePlacementPipeline } from "./usePlacementPipeline";
import { screenToWorld, useTownCamera } from "@/hooks/useTownCamera";
import { StopMarker } from "./StopMarker";
import {
  useEscapeReleaseInteraction,
  type ActiveDragPointer,
} from "@/hooks/useEscapeReleaseInteraction";
import { useTownInteractionProfiler } from "@/hooks/useTownInteractionProfiler";
import { useTownPerfJourney } from "@/hooks/useTownPerfJourney";
import {
  BELL_BOARD_FLASH_MS,
  DAY_MS,
  MOBILE_TOWN_CAMERA,
  buildBellBoardAnnouncement,
  buildEasterEggAnnouncement,
  buildTourismBoardAnnouncement,
  fetchApiRoute,
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
import {
  parseTimestamp,
  readBrowserCanalSnapshot,
  readBrowserTownSnapshot,
  writeBrowserCanalSnapshot,
  writeBrowserTownSnapshot,
} from "./townBrowserCache";
import { summarizeTownHealth } from "./BellMessengers";

export function useTownStageState({ initialStops }: { initialStops: Stop[] }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [localStops, setLocalStops] = useState<Stop[]>(initialStops);
  const isClient = useIsClient();
  const searchParamsString = isClient ? window.location.search.slice(1) : "";
  const query = new URLSearchParams(searchParamsString);
  const siteTypeOverride = query.get("site_type");
  const forcedMobileSafeMode =
    siteTypeOverride === "mobile"
      ? true
      : siteTypeOverride === "desktop"
        ? false
        : null;
  const perfEnabled = query.get("perf") === "1";
  const perfAutorun = query.get("autorun") === "1";

  const routeWithCurrentSearch = useCallback(
    (path: string) => {
      if (!isClient || !searchParamsString) return path;
      return `${path}?${searchParamsString}`;
    },
    [isClient, searchParamsString],
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
    resetDragInteraction,
    setCameraImmediate,
    stageHandlers,
    wasDragging,
    zoomAtWorldPoint,
  } = useTownCamera(svgRef, stageRef, perfEnabled ? perfProbe : undefined);

  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const dismissedStopIdRef = useRef<string | null>(null);
  const transitioningToStopIdRef = useRef<string | null>(null);
  const boardAnnouncementTimerRef = useRef<number | null>(null);
  const populateResetTimerRef = useRef<number | null>(null);
  const activeDragIdRef = useRef<string | null>(null);
  const activeDragPointerRef = useRef<ActiveDragPointer | null>(null);

  const [movedStops, setMovedStops] = useState<
    Record<string, RepositionStopDelta>
  >({});
  const [liveStops, setLiveStops] = useState<Stop[] | null>(null);
  const [showCentralBoard, setShowCentralBoard] = useState(true);
  const [showDigitalBoard, setShowDigitalBoard] = useState(false);
  const [showAboutPane, setShowAboutPane] = useState(false);
  const [centralBoardOpacity, setCentralBoardOpacity] = useState(0.35);
  const [digitalBoardOpacity, setDigitalBoardOpacity] = useState(0.75);
  const [showPerfPanel, setShowPerfPanel] = useState(true);
  const [perfPanelOpacity, setPerfPanelOpacity] = useState(0.94);
  const [responsiveMobileSafeMode, setResponsiveMobileSafeMode] =
    useState(false);
  const mobileSafeMode = forcedMobileSafeMode ?? responsiveMobileSafeMode;

  const [detectedDesktop, setDetectedDesktop] = useState(false);
  const prefersFullArt =
    forcedMobileSafeMode === false
      ? true
      : forcedMobileSafeMode === true
        ? false
        : detectedDesktop;
  const [mobileDrawerExpanded, setMobileDrawerExpanded] = useState(false);
  const [populating, setPopulating] = useState<
    "idle" | "running" | "done" | "error"
  >("idle");
  const [bellStartedAt, setBellStartedAt] = useState<number | null>(null);
  const [bellCompletedAtByStopId, setBellCompletedAtByStopId] = useState<
    Record<string, number>
  >({});
  const [bellErrorMessage, setBellErrorMessage] = useState("✕ Bell failed");
  const [bellCanalInfo, setBellCanalInfo] = useState<{
    sinceLabel: string | null;
    newBoats: number;
  } | null>(null);
  const [boardAnnouncement, setBoardAnnouncement] =
    useState<BoardAnnouncement | null>(null);
  const mobileDefaultCameraAppliedRef = useRef(false);
  const hasAppliedApiStopsRef = useRef(false);

  useEffect(() => {
    if (!isClient) {
      return;
    }

    const snapshot = readBrowserTownSnapshot();
    if (!snapshot || snapshot.stops.length === 0) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      if (hasAppliedApiStopsRef.current) {
        return;
      }

      setLiveStops(snapshot.stops);
      setLocalStops((previousStops) => {
        const knownIds = new Set(previousStops.map((stop) => stop.id));
        const appendedStops = snapshot.stops.filter(
          (stop) => !knownIds.has(stop.id),
        );
        if (appendedStops.length === 0) {
          return previousStops;
        }
        return [...previousStops, ...appendedStops];
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isClient]);

  const isRepositionMode = pathname.startsWith("/reposition");
  const isHistoryMode = pathname.startsWith("/history");

  const mayorEditingLocked = useMemo(() => {
    if (!isClient) {
      return false;
    }

    const hostname = window.location.hostname.toLowerCase();
    return (
      hostname === "willville.ai" ||
      hostname === "www.willville.ai" ||
      hostname.endsWith(".pages.dev")
    );
  }, [isClient]);

  const currentStops = useMemo(() => {
    if (isRepositionMode) {
      return localStops;
    }
    return mergeStops(localStops, liveStops);
  }, [localStops, liveStops, isRepositionMode]);

  const bellTownHealthSummary = useMemo(() => {
    const tally = summarizeTownHealth(currentStops);
    const parts: string[] = [];
    if (tally.healthy > 0) parts.push(`${tally.healthy} healthy`);
    if (tally.running > 0) parts.push(`${tally.running} building`);
    if (tally.attention > 0) parts.push(`${tally.attention} need you`);
    if (tally.dormant > 0) parts.push(`${tally.dormant} quiet`);
    if (bellCanalInfo !== null) {
      if (bellCanalInfo.sinceLabel === null) {
        parts.push(`⛵ 2yr backfill (${bellCanalInfo.newBoats} ships)`);
      } else if (bellCanalInfo.newBoats > 0) {
        parts.push(
          `⛵ +${bellCanalInfo.newBoats} ships (since ${bellCanalInfo.sinceLabel})`,
        );
      } else {
        parts.push("⛵ fleet up to date");
      }
    }
    return parts.length > 0 ? `🔔 ${parts.join(" · ")}` : "✓ Manifests synced";
  }, [currentStops, bellCanalInfo]);

  const repositionableStops = useMemo(
    () =>
      localStops
        .filter((stop) => stop.repo && stop.isManual !== true)
        .sort((left, right) =>
          left.displayName.localeCompare(right.displayName),
        ),
    [localStops],
  );
  const [plannerStopId, setPlannerStopId] = useState<string | null>(null);
  const effectivePlannerStopId =
    plannerStopId &&
    repositionableStops.some((stop) => stop.id === plannerStopId)
      ? plannerStopId
      : (repositionableStops[0]?.id ?? "");

  const plannerStop = useMemo(
    () =>
      repositionableStops.find((stop) => stop.id === effectivePlannerStopId) ??
      null,
    [effectivePlannerStopId, repositionableStops],
  );

  const { clearRepositionDrag, releaseHeldInteraction } =
    useEscapeReleaseInteraction({
      svgRef,
      isDragging,
      activeDragIdRef,
      activeDragPointerRef,
      resetDragInteraction,
    });

  const handleResetStop = useCallback(
    (stopId: string) => {
      const item = movedStops[stopId];
      if (!item) return;

      setLocalStops((prevStops) =>
        prevStops.map((s) =>
          s.id === stopId
            ? {
                ...s,
                district: item.original.district,
                position: { x: item.original.x, y: item.original.y },
              }
            : s,
        ),
      );

      setMovedStops((prev) => {
        const next = { ...prev };
        delete next[stopId];
        return next;
      });
    },
    [movedStops],
  );

  const handleResetAll = useCallback(() => {
    setLocalStops((prevStops) =>
      prevStops.map((s) => {
        const item = movedStops[s.id];
        return item
          ? {
              ...s,
              district: item.original.district,
              position: { x: item.original.x, y: item.original.y },
            }
          : s;
      }),
    );
    setMovedStops({});
  }, [movedStops]);

  const handleDistrictChange = useCallback(
    (stopId: string, nextDistrict: DistrictId) => {
      const stop = localStops.find((item) => item.id === stopId);
      if (!stop?.repo || stop.district === nextDistrict) {
        return;
      }

      const nextPosition = sitePositionForStop(
        nextDistrict,
        stop.id,
        stop.repo,
      );

      setLocalStops((prevStops) =>
        prevStops.map((item) =>
          item.id === stopId
            ? {
                ...item,
                district: nextDistrict,
                position: { x: nextPosition.x, y: nextPosition.y },
              }
            : item,
        ),
      );

      setMovedStops((prev) => {
        const existing = prev[stopId];
        return {
          ...prev,
          [stopId]: {
            original: existing?.original ?? {
              x: stop.position.x,
              y: stop.position.y,
              district: stop.district,
            },
            current: {
              x: nextPosition.x,
              y: nextPosition.y,
              district: nextDistrict,
            },
          },
        };
      });
    },
    [localStops],
  );

  const changedStops = Object.entries(movedStops).filter(
    ([_, item]) =>
      item.original.x !== item.current.x ||
      item.original.y !== item.current.y ||
      item.original.district !== item.current.district,
  );

  const handlePlacementAccepted = useCallback((stopId: string) => {
    setMovedStops((prev) => {
      const next = { ...prev };
      delete next[stopId];
      return next;
    });
  }, []);

  const handlePlacementRejected = useCallback(
    (stopId: string) => {
      handleResetStop(stopId);
    },
    [handleResetStop],
  );

  const {
    placementControlsBusy,
    placementQueueState,
    placementQueueMessage,
    canQueuePlacement,
    queuePlacementLabel,
    canAcceptPlacement,
    canRejectPlacement,
    handleQueuePlacement,
    handleAcceptPlacement,
    handleRejectPlacement,
  } = usePlacementPipeline({
    isClient,
    isRepositionMode,
    plannerStop,
    movedStops,
    onPlacementAccepted: handlePlacementAccepted,
    onPlacementRejected: handlePlacementRejected,
  });

  const {
    customPrompt,
    setCustomPrompt,
    previewUnderlayHrefs,
    replacementUnderlayStopIds,
    repaintControlsBusy,
    repaintQueueState,
    repaintQueueMessage: queueRepaintMessage,
    repaintCliOutput,
    canQueueRepaint,
    queueRepaintLabel,
    canAcceptRepaint,
    canRejectRepaint,
    canCancelRepaint,
    handleQueueRepaint,
    handleAcceptRepaint,
    handleRejectRepaint,
    handleCancelRepaint,
  } = useRepaintPipeline({
    isClient,
    isRepositionMode,
    plannerStop,
    movedStops,
  });

  const handleMarkerDragStart = useCallback(
    (stop: Stop, e: React.PointerEvent<SVGGElement>) => {
      if (
        !isRepositionMode ||
        stop.id !== effectivePlannerStopId ||
        placementQueueState === "review" ||
        placementQueueState === "running" ||
        repaintQueueState === "review" ||
        repaintQueueState === "running"
      ) {
        return;
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      activeDragIdRef.current = stop.id;
      activeDragPointerRef.current = {
        element: e.currentTarget,
        pointerId: e.pointerId,
      };
      setMovedStops((prev) => {
        if (prev[stop.id]) return prev;
        return {
          ...prev,
          [stop.id]: {
            original: { ...stop.position, district: stop.district },
            current: { ...stop.position, district: stop.district },
          },
        };
      });
    },
    [
      effectivePlannerStopId,
      isRepositionMode,
      placementQueueState,
      repaintQueueState,
    ],
  );

  const handleMarkerDragMove = useCallback(
    (stop: Stop, e: React.PointerEvent<SVGGElement>) => {
      if (activeDragIdRef.current !== stop.id) return;
      const svg = svgRef.current;
      if (!svg) return;
      const snap = getCameraSnapshot();
      const { wx, wy } = screenToWorld(svg, e.clientX, e.clientY, snap);

      const newX = Math.round(wx - TOWN_OFFSET.x);
      const newY = Math.round(wy - TOWN_OFFSET.y);

      const clampedX = Math.max(0, Math.min(TOWN.width, newX));
      const clampedY = Math.max(0, Math.min(TOWN.height, newY));

      setLocalStops((prevStops) =>
        prevStops.map((s) =>
          s.id === stop.id
            ? { ...s, position: { x: clampedX, y: clampedY } }
            : s,
        ),
      );

      setMovedStops((prev) => {
        const existing = prev[stop.id];
        if (!existing) return prev;
        return {
          ...prev,
          [stop.id]: {
            ...existing,
            current: {
              ...existing.current,
              x: clampedX,
              y: clampedY,
            },
          },
        };
      });
    },
    [getCameraSnapshot],
  );

  const handleMarkerDragEnd = useCallback(
    (stop: Stop, e: React.PointerEvent<SVGGElement>) => {
      if (activeDragIdRef.current !== stop.id) return;
      if (!releaseHeldInteraction({ dispatchSyntheticEvents: false })) {
        clearRepositionDrag(e.currentTarget, e.pointerId);
      }
    },
    [clearRepositionDrag, releaseHeldInteraction],
  );

  const loadTown = useCallback(
    (
      options: {
        signal?: AbortSignal;
        fresh?: boolean;
        bustCache?: boolean;
      } = {},
    ) => {
      const url = options.fresh
        ? `/api/town?refresh=${encodeURIComponent(String(Date.now()))}`
        : options.bustCache
          ? `/api/town?t=${encodeURIComponent(String(Date.now()))}`
          : "/api/town";
      return fetchApiRoute(url, {
        cache: options.fresh || options.bustCache ? "no-store" : "default",
        signal: options.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.stops)) {
            const incomingStops = data.stops as Stop[];
            const browserSnapshot = readBrowserTownSnapshot();
            const apiGeneratedAt = parseTimestamp(
              typeof data.generatedAt === "string"
                ? data.generatedAt
                : undefined,
            );
            const browserCachedAt = parseTimestamp(browserSnapshot?.cachedAt);

            if (
              Number.isFinite(apiGeneratedAt) &&
              Number.isFinite(browserCachedAt) &&
              apiGeneratedAt < browserCachedAt
            ) {
              return data;
            }

            hasAppliedApiStopsRef.current = true;
            setLiveStops(incomingStops);
            setLocalStops((previousStops) => {
              const knownIds = new Set(previousStops.map((stop) => stop.id));
              const appendedStops = incomingStops.filter(
                (stop) => !knownIds.has(stop.id),
              );
              if (appendedStops.length === 0) {
                return previousStops;
              }
              return [...previousStops, ...appendedStops];
            });
            writeBrowserTownSnapshot(incomingStops, {
              cachedAt:
                typeof data.generatedAt === "string"
                  ? data.generatedAt
                  : undefined,
            });
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

  const [boats, setBoats] = useState<CanalBoat[]>([]);

  // 1. Stable mount/load time baseline
  const [loadTime] = useState(() => Date.now());

  // 2. Derive defaults dynamically from boats contents to prevent render-phase impurity
  const boatBounds = useMemo(() => {
    const times = boats
      .map((b) => Date.parse(b.createdAt))
      .filter((t) => !isNaN(t));
    const updateTimes = boats
      .map((b) => Date.parse(b.updatedAt))
      .filter((t) => !isNaN(t));

    const minTime =
      times.length > 0 ? Math.min(...times) : loadTime - 30 * 24 * 3600 * 1000;
    const maxTime =
      updateTimes.length > 0 ? Math.max(...updateTimes) : loadTime;

    const startStr = new Date(minTime).toISOString().split("T")[0]!;
    const endStr = new Date(maxTime).toISOString().split("T")[0]!;

    return { minTime, maxTime, startStr, endStr };
  }, [boats, loadTime]);

  const [historyStart, setHistoryStart] = useState<string>("");
  const [historyEnd, setHistoryEnd] = useState<string>("");

  const effectiveStartStr = historyStart || boatBounds.startStr;
  const effectiveEndStr = historyEnd || boatBounds.endStr;

  const effectiveStartMs = useMemo(
    () => Date.parse(effectiveStartStr),
    [effectiveStartStr],
  );
  const effectiveEndMs = useMemo(
    () => Date.parse(effectiveEndStr),
    [effectiveEndStr],
  );

  const [historyCurrentTime, setHistoryCurrentTime] = useState<number>(0);
  const currentPlaybackTime = historyCurrentTime || effectiveStartMs;

  const [isHistoryPlaying, setIsHistoryPlaying] = useState(false);
  const [historySpeed, setHistorySpeed] = useState<number>(24 * 3600 * 1000); // 1 day per second

  const lastFrameTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isHistoryPlaying) {
      lastFrameTimeRef.current = null;
      return;
    }

    let frameId: number;

    const tick = (nowTime: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = nowTime;
        frameId = requestAnimationFrame(tick);
        return;
      }

      const deltaRealMs = nowTime - lastFrameTimeRef.current;
      lastFrameTimeRef.current = nowTime;

      setHistoryCurrentTime((prevTime) => {
        const startVal = prevTime || effectiveStartMs;
        const deltaSimulatedMs = historySpeed * (deltaRealMs / 1000);
        let nextTime = startVal + deltaSimulatedMs;

        if (nextTime >= effectiveEndMs) {
          nextTime = effectiveEndMs;
          setIsHistoryPlaying(false);
        }
        return nextTime;
      });

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [isHistoryPlaying, historySpeed, effectiveStartMs, effectiveEndMs]);

  const historyBoats = useMemo(() => {
    if (!isHistoryMode) return boats;

    const targetTime = currentPlaybackTime;

    return boats
      .map((boat) => {
        const createdTime = Date.parse(boat.createdAt);
        const updatedAtTime = Date.parse(boat.updatedAt);

        if (targetTime < createdTime) {
          return null;
        }

        if (targetTime >= updatedAtTime) {
          return boat;
        }

        const lockSequence: LockId[] = [
          "open-dock",
          "inspection",
          "review",
          "edits",
          "final",
        ];
        const finalLockIndex = lockSequence.indexOf(boat.lock);

        let activeSequence = lockSequence;
        if (finalLockIndex !== -1) {
          activeSequence = lockSequence.slice(0, finalLockIndex + 1);
        }

        const totalDuration = updatedAtTime - createdTime;
        const elapsed = targetTime - createdTime;
        const progress = totalDuration > 0 ? elapsed / totalDuration : 1;

        const currentSequenceIndex = Math.min(
          activeSequence.length - 1,
          Math.floor(progress * activeSequence.length),
        );
        const lock = activeSequence[currentSequenceIndex] ?? "open-dock";

        return {
          ...boat,
          lock,
        };
      })
      .filter((b): b is CanalBoat => b !== null);
  }, [isHistoryMode, boats, currentPlaybackTime]);

  const hasAppliedApiBoatsRef = useRef(false);
  const loadCanal = useCallback(
    (options: { signal?: AbortSignal; fresh?: boolean } = {}) => {
      const url = options.fresh
        ? `/api/canal?refresh=${encodeURIComponent(String(Date.now()))}`
        : "/api/canal";
      return fetchApiRoute(url, {
        cache: options.fresh ? "no-store" : "default",
        signal: options.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.boats)) {
            const incoming = data.boats as CanalBoat[];
            if (incoming.length === 0) {
              return data;
            }
            const browserSnapshot = readBrowserCanalSnapshot();
            const apiGeneratedAt = parseTimestamp(
              typeof data.generatedAt === "string"
                ? data.generatedAt
                : undefined,
            );
            const browserCachedAt = parseTimestamp(browserSnapshot?.cachedAt);

            if (
              Number.isFinite(apiGeneratedAt) &&
              Number.isFinite(browserCachedAt) &&
              apiGeneratedAt < browserCachedAt
            ) {
              return data;
            }

            hasAppliedApiBoatsRef.current = true;
            setBoats(incoming);
            writeBrowserCanalSnapshot(incoming, {
              cachedAt:
                typeof data.generatedAt === "string"
                  ? data.generatedAt
                  : undefined,
            });
          }
          return data;
        })
        .catch(() => undefined);
    },
    [],
  );

  useEffect(() => {
    if (forcedMobileSafeMode !== null) return;
    if (!isClient || typeof window.matchMedia !== "function") {
      return;
    }

    const touchLikeInput = window.matchMedia(
      "(pointer: coarse) and (hover: none)",
    );

    const apply = () => {
      setResponsiveMobileSafeMode(touchLikeInput.matches);
    };

    apply();

    if (typeof touchLikeInput.addEventListener === "function") {
      touchLikeInput.addEventListener("change", apply);
      return () => {
        touchLikeInput.removeEventListener("change", apply);
      };
    }

    touchLikeInput.addListener(apply);
    return () => {
      touchLikeInput.removeListener(apply);
    };
  }, [forcedMobileSafeMode, isClient]);

  useEffect(() => {
    if (forcedMobileSafeMode !== null) return;
    if (!isClient || typeof window.matchMedia !== "function") {
      return;
    }
    const desktopInput = window.matchMedia(
      "(pointer: fine) and (hover: hover)",
    );
    const apply = () => setDetectedDesktop(desktopInput.matches);
    apply();
    if (typeof desktopInput.addEventListener === "function") {
      desktopInput.addEventListener("change", apply);
      return () => desktopInput.removeEventListener("change", apply);
    }
    desktopInput.addListener(apply);
    return () => desktopInput.removeListener(apply);
  }, [forcedMobileSafeMode, isClient]);

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
    fetchApiRoute("/api/manifests", { method: "POST" })
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
      .then((completeEvent) => {
        if (completeEvent.canalSince !== undefined) {
          let sinceLabel: string | null = null;
          if (completeEvent.canalSince !== null) {
            const sinceDate = new Date(completeEvent.canalSince);
            const daysDiff = Math.round(
              (Date.now() - sinceDate.getTime()) / (1000 * 60 * 60 * 24),
            );
            sinceLabel =
              daysDiff === 0
                ? "today"
                : daysDiff === 1
                  ? "yesterday"
                  : `${daysDiff}d ago`;
          }
          setBellCanalInfo({
            sinceLabel,
            newBoats: completeEvent.canalNewBoats ?? 0,
          });
        }
        return loadTown({ bustCache: true });
      })
      .then((data) => {
        void loadCanal({ fresh: true });
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
          setBellCanalInfo(null);
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
          setBellCanalInfo(null);
          populateResetTimerRef.current = null;
        }, 4000);
      });
  }, [currentStops, loadCanal, loadTown, populating]);

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

  const handleTourism = useCallback(() => {
    if (boardAnnouncementTimerRef.current !== null) {
      window.clearTimeout(boardAnnouncementTimerRef.current);
      boardAnnouncementTimerRef.current = null;
    }
    transitioningToStopIdRef.current = dismissedStopIdRef.current = null;
    setSelectedStop(null);
    setShowAboutPane(false);
    setShowDigitalBoard(true);
    setMobileDrawerExpanded(false);
    setShowCentralBoard(true);
    setBoardAnnouncement(buildTourismBoardAnnouncement());
    boardAnnouncementTimerRef.current = window.setTimeout(() => {
      setBoardAnnouncement(null);
      boardAnnouncementTimerRef.current = null;
    }, BELL_BOARD_FLASH_MS);
    router.replace(routeWithCurrentSearch("/"), { scroll: false });
  }, [routeWithCurrentSearch, router]);

  const handleAboutPaneOpen = useCallback(() => {
    if (boardAnnouncementTimerRef.current !== null) {
      window.clearTimeout(boardAnnouncementTimerRef.current);
      boardAnnouncementTimerRef.current = null;
    }
    transitioningToStopIdRef.current = dismissedStopIdRef.current = null;
    setSelectedStop(null);
    setShowDigitalBoard(false);
    setMobileDrawerExpanded(false);
    setShowCentralBoard(true);
    setShowAboutPane(true);
    setBoardAnnouncement(null);
    router.replace(routeWithCurrentSearch("/"), { scroll: false });
  }, [routeWithCurrentSearch, router]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const seedTimer = window.setTimeout(() => {
      if (cancelled || hasAppliedApiBoatsRef.current) {
        return;
      }
      const seeded = readBrowserCanalSnapshot();
      if (seeded?.boats.length) {
        setBoats(seeded.boats);
      }
    }, 0);
    loadCanal({ signal: controller.signal });
    const interval = window.setInterval(
      () => loadCanal({ signal: controller.signal }),
      60_000,
    );
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(seedTimer);
      window.clearInterval(interval);
    };
  }, [loadCanal]);

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
  const focusedStopKey = boardStop
    ? `${boardStop.district}/${boardStop.id}`
    : null;
  const detailBoardVisible =
    showDigitalBoard && (!mobileSafeMode || !!boardStop);
  const mobileDrawerVisible = mobileSafeMode && detailBoardVisible;
  const areChromeBoardsHidden = !showCentralBoard && !detailBoardVisible;

  useEffect(() => {
    if (!pathDistrict || !pathStopId) {
      if (transitioningToStopIdRef.current !== null) {
        return;
      }

      if (selectedStop) {
        const routed = KNOWN_STOPS.some(
          (s) =>
            s.id === selectedStop.id && s.district === selectedStop.district,
        );
        if (!routed) return;
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
    setShowAboutPane(false);
    const stop = currentStops.find(
      (s) => s.district === pathDistrict && s.id === pathStopId,
    );
    if (!stop) return;
    const open = window.setTimeout(() => {
      setSelectedStop(stop);
    }, 0);
    return () => window.clearTimeout(open);
  }, [pathDistrict, pathStopId, currentStops, selectedStop]);

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
      setShowAboutPane(false);
      transitioningToStopIdRef.current = stop.id;
      dismissedStopIdRef.current = null;
      setSelectedStop(stop);

      const routed = KNOWN_STOPS.some(
        (s) => s.district === stop.district && s.id === stop.id,
      );

      if (routed) {
        router.replace(
          routeWithCurrentSearch(`/${stop.district}/${stop.id}/`),
          {
            scroll: false,
          },
        );
      } else {
        transitioningToStopIdRef.current = null;
      }
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
    setShowAboutPane(false);
    setShowDigitalBoard(false);
    setMobileDrawerExpanded(false);
    router.replace(routeWithCurrentSearch("/"), { scroll: false });
  }, [pathStopId, routeWithCurrentSearch, router]);

  const enterDistrict = useCallback(
    (district: (typeof DISTRICTS)[number]) => {
      if (isRepositionMode || isHistoryMode) return;
      transitioningToStopIdRef.current = null;
      dismissedStopIdRef.current = pathStopId;
      setSelectedStop(null);
      setShowAboutPane(false);
      setShowDigitalBoard(false);
      setMobileDrawerExpanded(false);
      router.push(routeWithCurrentSearch(`/${district.id}/`), {
        scroll: false,
      });
    },
    [
      pathStopId,
      routeWithCurrentSearch,
      router,
      isRepositionMode,
      isHistoryMode,
    ],
  );

  const handleStageClick = useCallback(
    (_e: MouseEvent<HTMLDivElement>) => {
      if (isRepositionMode || isHistoryMode) return;
      if (wasDragging()) return;
      closeHud();
    },
    [closeHud, isRepositionMode, isHistoryMode, wasDragging],
  );

  const handleStageDoubleClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (isRepositionMode || isHistoryMode) return;
      markSkipDrag();
      const svg = svgRef.current;
      if (!svg) return;
      const snap = getCameraSnapshot();
      const { wx, wy } = screenToWorld(svg, e.clientX, e.clientY, snap);
      zoomAtWorldPoint(wx, wy);
      if (selectedStop) closeHud();
    },
    [
      closeHud,
      getCameraSnapshot,
      isRepositionMode,
      isHistoryMode,
      markSkipDrag,
      selectedStop,
      svgRef,
      zoomAtWorldPoint,
    ],
  );

  const handleStopClick = useCallback(
    (stop: Stop, e: MouseEvent<SVGGElement>) => {
      e.stopPropagation();
      if (isRepositionMode || isHistoryMode) return;
      markSkipDrag();
      openStopHud(stop);
    },
    [isRepositionMode, isHistoryMode, markSkipDrag, openStopHud],
  );

  const handleStopDoubleClick = useCallback(
    (stop: Stop, e: MouseEvent<SVGGElement>) => {
      e.stopPropagation();
      if (isRepositionMode || isHistoryMode) return;
      markSkipDrag();
      const wx = TOWN_OFFSET.x + stop.position.x;
      const wy = TOWN_OFFSET.y + stop.position.y;
      zoomAtWorldPoint(wx, wy);
      openStopHud(stop);
    },
    [
      isRepositionMode,
      isHistoryMode,
      markSkipDrag,
      openStopHud,
      zoomAtWorldPoint,
    ],
  );

  const [hoveredDistrictId, setHoveredDistrictId] = useState<string | null>(
    null,
  );

  const stopMarkers = useMemo(
    () =>
      currentStops.map((stop) => {
        const updated = stop.status.updated
          ? Date.parse(stop.status.updated)
          : NaN;
        const recently =
          isClient &&
          now !== null &&
          !Number.isNaN(updated) &&
          now - updated < DAY_MS;
        const markerDraggable =
          isRepositionMode &&
          !mayorEditingLocked &&
          stop.id === effectivePlannerStopId &&
          placementQueueState !== "review" &&
          placementQueueState !== "running" &&
          repaintQueueState !== "review" &&
          repaintQueueState !== "running";
        return (
          <g
            key={`${stop.district}-${stop.id}`}
            onMouseEnter={() => setHoveredDistrictId(stop.district)}
            onMouseLeave={() => setHoveredDistrictId(null)}
          >
            <StopMarker
              stop={stop}
              isFocused={focusedStopKey === `${stop.district}/${stop.id}`}
              recentlyUpdated={recently}
              onClick={handleStopClick}
              onDoubleClick={handleStopDoubleClick}
              forceHideSprite={replacementUnderlayStopIds.has(stop.id)}
              draggable={markerDraggable}
              onDragStart={handleMarkerDragStart}
              onDragMove={handleMarkerDragMove}
              onDragEnd={handleMarkerDragEnd}
            />
          </g>
        );
      }),
    [
      currentStops,
      focusedStopKey,
      handleMarkerDragEnd,
      handleMarkerDragMove,
      handleMarkerDragStart,
      handleStopClick,
      handleStopDoubleClick,
      isClient,
      effectivePlannerStopId,
      isRepositionMode,
      now,
      replacementUnderlayStopIds,
      placementQueueState,
      repaintQueueState,
      mayorEditingLocked,
    ],
  );

  const showWelcomeHint =
    !mobileSafeMode &&
    !boardStop &&
    pathDistrict === null &&
    !showDigitalBoard &&
    !showAboutPane &&
    !isHistoryMode;

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

  return {
    router,
    localStops,
    isClient,
    searchParamsString,
    query,
    siteTypeOverride,
    forcedMobileSafeMode,
    perfEnabled,
    perfAutorun,
    routeWithCurrentSearch,
    now,
    svgRef,
    stageRef,
    cameraGroupRef,
    perfProfiler,
    perfProbe,
    getCameraSnapshot,
    isDragging,
    cameraTransform,
    markSkipDrag,
    resetDragInteraction,
    setCameraImmediate,
    stageHandlers,
    wasDragging,
    zoomAtWorldPoint,
    selectedStop,
    setSelectedStop,
    dismissedStopIdRef,
    transitioningToStopIdRef,
    boardAnnouncementTimerRef,
    populateResetTimerRef,
    activeDragIdRef,
    activeDragPointerRef,
    movedStops,
    setMovedStops,
    liveStops,
    showCentralBoard,
    setShowCentralBoard,
    showDigitalBoard,
    setShowDigitalBoard,
    showAboutPane,
    setShowAboutPane,
    centralBoardOpacity,
    setCentralBoardOpacity,
    digitalBoardOpacity,
    setDigitalBoardOpacity,
    showPerfPanel,
    setShowPerfPanel,
    perfPanelOpacity,
    setPerfPanelOpacity,
    responsiveMobileSafeMode,
    mobileSafeMode,
    detectedDesktop,
    prefersFullArt,
    mobileDrawerExpanded,
    setMobileDrawerExpanded,
    populating,
    setPopulating,
    bellStartedAt,
    bellCompletedAtByStopId,
    bellErrorMessage,
    bellCanalInfo,
    boardAnnouncement,
    mobileDefaultCameraAppliedRef,
    hasAppliedApiStopsRef,
    isRepositionMode,
    isHistoryMode,
    mayorEditingLocked,
    currentStops,
    bellTownHealthSummary,
    repositionableStops,
    plannerStopId,
    setPlannerStopId,
    effectivePlannerStopId,
    plannerStop,
    clearRepositionDrag,
    releaseHeldInteraction,
    handleResetStop,
    handleResetAll,
    handleDistrictChange,
    changedStops,
    handlePlacementAccepted,
    handlePlacementRejected,
    placementControlsBusy,
    placementQueueState,
    placementQueueMessage,
    canQueuePlacement,
    queuePlacementLabel,
    canAcceptPlacement,
    canRejectPlacement,
    handleQueuePlacement,
    handleAcceptPlacement,
    handleRejectPlacement,
    customPrompt,
    setCustomPrompt,
    previewUnderlayHrefs,
    replacementUnderlayStopIds,
    repaintControlsBusy,
    repaintQueueState,
    repaintQueueMessage: queueRepaintMessage,
    repaintCliOutput,
    canQueueRepaint,
    queueRepaintLabel,
    canAcceptRepaint,
    canRejectRepaint,
    canCancelRepaint,
    handleQueueRepaint,
    handleAcceptRepaint,
    handleRejectRepaint,
    handleCancelRepaint,
    handleMarkerDragStart,
    handleMarkerDragMove,
    handleMarkerDragEnd,
    loadTown,
    boats,
    setBoats,
    historyCurrentTime,
    setHistoryCurrentTime,
    currentPlaybackTime,
    isHistoryPlaying,
    setIsHistoryPlaying,
    historySpeed,
    setHistorySpeed,
    historyStart,
    setHistoryStart,
    historyEnd,
    setHistoryEnd,
    effectiveStartStr,
    effectiveEndStr,
    effectiveStartMs,
    effectiveEndMs,
    lastFrameTimeRef,
    historyBoats,
    loadCanal,
    handlePopulate,
    handleEasterEgg,
    handleTourism,
    handleAboutPaneOpen,
    runOfficialPerfProfile,
    downloadPerfReport,
    hydratedSelectedStop,
    districtSlug,
    pathDistrict,
    pathStopId,
    pathSelectedStop,
    boardStop,
    focusedStopKey,
    detailBoardVisible,
    mobileDrawerVisible,
    areChromeBoardsHidden,
    openStopHud,
    closeHud,
    enterDistrict,
    handleStageClick,
    handleStageDoubleClick,
    handleStopClick,
    handleStopDoubleClick,
    hoveredDistrictId,
    setHoveredDistrictId,
    stopMarkers,
    showWelcomeHint,
    stageControlTop,
    stageControlBottom,
  };
}
