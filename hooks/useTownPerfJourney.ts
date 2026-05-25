"use client";

import { useCallback, type RefObject } from "react";
import { TOWN_CENTER } from "@/lib/willville";
import type { Stop } from "@/lib/town";
import {
  MIN_SCALE,
  cameraAtCorner,
  screenToWorld,
  type Camera,
} from "@/hooks/useTownCamera";
import { useTownInteractionProfiler } from "@/hooks/useTownInteractionProfiler";
import {
  dispatchClickGesture,
  dispatchDoubleClickGesture,
  dispatchDragGesture,
  dispatchWheelGesture,
  findStopAt,
  pointAtElementCenter,
  pointInRect,
  waitForNextFrame,
} from "@/components/townStageUtils";

const PERF_REGION_SCALE = 2.2;
const PERF_TARGET_MAX_SCALE = 4.5;
const PERF_ZOOM_IN_DELTA_Y = -160;
const PERF_ZOOM_OUT_DELTA_Y = 160;
const PERF_WHEEL_LIMIT = 24;
const PERF_DRAG_STEPS = 8;
const PERF_DRAG_LIMIT = 24;

type Options = {
  currentStops: Stop[];
  getCameraSnapshot: () => Camera;
  perfEnabled: boolean;
  perfProfiler: ReturnType<typeof useTownInteractionProfiler>;
  setCameraImmediate: (target: Camera) => void;
  stageRef: RefObject<HTMLDivElement | null>;
  svgRef: RefObject<SVGSVGElement | null>;
};

export function useTownPerfJourney({
  currentStops,
  getCameraSnapshot,
  perfEnabled,
  perfProfiler,
  setCameraImmediate,
  stageRef,
  svgRef,
}: Options) {
  const waitForCameraSettled = useCallback(async () => {
    let stableFrames = 0;
    let previous = getCameraSnapshot();

    for (let frame = 0; frame < 90; frame += 1) {
      const waitStartedAt = performance.now();
      await waitForNextFrame();
      perfProfiler.recordDuration(
        "settleWait",
        performance.now() - waitStartedAt,
      );
      const next = getCameraSnapshot();
      const delta =
        Math.abs(next.cx - previous.cx) +
        Math.abs(next.cy - previous.cy) +
        Math.abs(next.scale - previous.scale);
      previous = next;
      stableFrames = delta < 0.05 ? stableFrames + 1 : 0;
      if (stableFrames >= 4) {
        return;
      }
    }
  }, [getCameraSnapshot, perfProfiler]);

  const waitForFrames = useCallback(async (count: number) => {
    for (let frame = 0; frame < count; frame += 1) {
      await waitForNextFrame();
    }
  }, []);

  const waitForPathMatch = useCallback(
    async (matcher: (parts: string[]) => boolean) => {
      for (let frame = 0; frame < 90; frame += 1) {
        const parts = window.location.pathname.split("/").filter(Boolean);
        if (matcher(parts)) {
          return true;
        }
        await waitForNextFrame();
      }
      return false;
    },
    [],
  );

  const findGroundPoint = useCallback(
    (candidates: Array<[number, number]>) => {
      const stage = stageRef.current;
      const svg = svgRef.current;
      if (!stage || !svg) return null;

      const bounds = stage.getBoundingClientRect();
      const snapshot = getCameraSnapshot();

      for (const [xRatio, yRatio] of candidates) {
        const point = pointInRect(bounds, xRatio, yRatio);
        const { wx, wy } = screenToWorld(
          svg,
          point.clientX,
          point.clientY,
          snapshot,
        );
        if (!findStopAt(currentStops, wx, wy, snapshot.scale)) {
          return point;
        }
      }

      return pointInRect(bounds, candidates[0][0], candidates[0][1]);
    },
    [currentStops, getCameraSnapshot, stageRef, svgRef],
  );

  const collectVisibleElements = useCallback(
    <T extends Element>(selector: string): T[] => {
      const stage = stageRef.current;
      if (!stage) return [];
      const bounds = stage.getBoundingClientRect();

      return Array.from(document.querySelectorAll<T>(selector)).filter(
        (element) => {
          const rect = element.getBoundingClientRect();
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            rect.right >= bounds.left &&
            rect.left <= bounds.right &&
            rect.bottom >= bounds.top &&
            rect.top <= bounds.bottom
          );
        },
      );
    },
    [stageRef],
  );

  const clickElement = useCallback(
    async (element: Element | null) => {
      if (!element) return false;
      dispatchClickGesture(element, pointAtElementCenter(element));
      await waitForFrames(10);
      return true;
    },
    [waitForFrames],
  );

  const clickVisibleStop = useCallback(
    async (excludedStopIds: Set<string>) => {
      const stage = stageRef.current;
      if (!stage) return null;
      const bounds = stage.getBoundingClientRect();
      const center = pointInRect(bounds, 0.5, 0.55);
      const candidates = collectVisibleElements<SVGGElement>(
        "[data-stop-marker][data-stop-id]",
      )
        .filter((element) => {
          const stopId = element.getAttribute("data-stop-id");
          return stopId && !excludedStopIds.has(stopId);
        })
        .sort((left, right) => {
          const leftPoint = pointAtElementCenter(left);
          const rightPoint = pointAtElementCenter(right);
          const leftDist =
            Math.abs(leftPoint.clientX - center.clientX) +
            Math.abs(leftPoint.clientY - center.clientY);
          const rightDist =
            Math.abs(rightPoint.clientX - center.clientX) +
            Math.abs(rightPoint.clientY - center.clientY);
          return leftDist - rightDist;
        });

      const target = candidates[0] ?? null;
      if (!target) return null;
      await clickElement(target);
      return target.getAttribute("data-stop-id");
    },
    [clickElement, collectVisibleElements, stageRef],
  );

  const clickVisibleDistrictLabel = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage) return false;
    const bounds = stage.getBoundingClientRect();
    const center = pointInRect(bounds, 0.5, 0.5);
    const labels = collectVisibleElements<SVGTextElement>(
      "[data-district-label]",
    ).sort((left, right) => {
      const leftPoint = pointAtElementCenter(left);
      const rightPoint = pointAtElementCenter(right);
      const leftDist =
        Math.abs(leftPoint.clientX - center.clientX) +
        Math.abs(leftPoint.clientY - center.clientY);
      const rightDist =
        Math.abs(rightPoint.clientX - center.clientX) +
        Math.abs(rightPoint.clientY - center.clientY);
      return leftDist - rightDist;
    });
    return clickElement(labels[0] ?? null);
  }, [clickElement, collectVisibleElements, stageRef]);

  const clickCentralBoardShortcut = useCallback(async () => {
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        "[data-central-board-button]",
      ),
    );
    return clickElement(buttons[0] ?? null);
  }, [clickElement]);

  const wheelToScale = useCallback(
    async (
      targetScale: number,
      deltaY: number,
      candidates: Array<[number, number]>,
    ) => {
      const stage = stageRef.current;
      if (!stage) return;

      const point = findGroundPoint(candidates);
      if (!point) return;

      let previousScale = getCameraSnapshot().scale;
      for (let iteration = 0; iteration < PERF_WHEEL_LIMIT; iteration += 1) {
        const scale = getCameraSnapshot().scale;
        const hitTarget =
          deltaY < 0
            ? scale >= targetScale - 0.01
            : scale <= targetScale + 0.01;
        if (hitTarget) {
          break;
        }

        dispatchWheelGesture(stage, point, deltaY);
        await waitForNextFrame();

        const nextScale = getCameraSnapshot().scale;
        if (Math.abs(nextScale - previousScale) < 0.001) {
          break;
        }
        previousScale = nextScale;
      }

      await waitForCameraSettled();
    },
    [findGroundPoint, getCameraSnapshot, stageRef, waitForCameraSettled],
  );

  const dragTowardCorner = useCallback(
    async (corner: "topLeft" | "bottomRight") => {
      const stage = stageRef.current;
      if (!stage) return;

      const bounds = stage.getBoundingClientRect();
      const start =
        corner === "topLeft"
          ? pointInRect(bounds, 0.42, 0.42)
          : pointInRect(bounds, 0.58, 0.58);
      const end =
        corner === "topLeft"
          ? pointInRect(bounds, 0.72, 0.72)
          : pointInRect(bounds, 0.28, 0.28);

      for (let iteration = 0; iteration < PERF_DRAG_LIMIT; iteration += 1) {
        const before = getCameraSnapshot();
        const target = cameraAtCorner(corner, before.scale);
        if (
          Math.abs(target.cx - before.cx) < 0.5 &&
          Math.abs(target.cy - before.cy) < 0.5
        ) {
          break;
        }

        await dispatchDragGesture(stage, start, end, PERF_DRAG_STEPS);
        await waitForNextFrame();

        const after = getCameraSnapshot();
        const movement =
          Math.abs(after.cx - before.cx) + Math.abs(after.cy - before.cy);
        if (movement < 0.1) {
          break;
        }
      }
    },
    [getCameraSnapshot, stageRef],
  );

  const runOfficialPerfProfile = useCallback(async () => {
    if (!perfEnabled || perfProfiler.running) return;

    const stage = stageRef.current;
    if (!stage) return;

    setCameraImmediate({
      cx: TOWN_CENTER.x,
      cy: TOWN_CENTER.y,
      scale: 1,
    });
    await waitForNextFrame();

    const zoomPoint = findGroundPoint([
      [0.58, 0.56],
      [0.66, 0.62],
      [0.36, 0.6],
      [0.72, 0.44],
      [0.5, 0.5],
    ]);
    if (!zoomPoint) return;

    perfProfiler.startScenario("mouse-user-journey-sequence");

    const clickedStopIds = new Set<string>();

    await perfProfiler.runStep(
      "region-zoom-double-clicks",
      "Double-click two regions",
      async () => {
        const secondPoint =
          findGroundPoint([
            [0.34, 0.42],
            [0.7, 0.38],
            [0.62, 0.64],
          ]) ?? zoomPoint;

        for (const point of [zoomPoint, secondPoint]) {
          dispatchDoubleClickGesture(stage, point);
          await waitForCameraSettled();
        }
      },
    );

    await perfProfiler.runStep(
      "click-site-one",
      "Click first site",
      async () => {
        const stopId = await clickVisibleStop(clickedStopIds);
        if (stopId) {
          clickedStopIds.add(stopId);
          await waitForPathMatch((parts) => parts.length >= 2);
        }
      },
    );

    await perfProfiler.runStep(
      "click-site-two",
      "Click second site",
      async () => {
        const stopId = await clickVisibleStop(clickedStopIds);
        if (stopId) {
          clickedStopIds.add(stopId);
          await waitForPathMatch((parts) => parts.length >= 2);
        }
      },
    );

    await perfProfiler.runStep("zoom-out-wheel", "Wheel zoom out", async () => {
      await wheelToScale(1.15, PERF_ZOOM_OUT_DELTA_Y, [
        [0.5, 0.5],
        [0.58, 0.56],
      ]);
    });

    await perfProfiler.runStep(
      "drag-pan",
      "Drag map to new region",
      async () => {
        await dragTowardCorner("bottomRight");
      },
    );

    await perfProfiler.runStep(
      "zoom-in-region",
      "Wheel zoom into region",
      async () => {
        await wheelToScale(PERF_REGION_SCALE, PERF_ZOOM_IN_DELTA_Y, [
          [0.72, 0.36],
          [0.68, 0.48],
          [0.6, 0.34],
        ]);
      },
    );

    await perfProfiler.runStep(
      "click-region-label",
      "Click region name",
      async () => {
        const clicked = await clickVisibleDistrictLabel();
        if (clicked) {
          await waitForPathMatch((parts) => parts.length === 1);
        }
      },
    );

    await perfProfiler.runStep(
      "click-board-shortcut",
      "Click Time Central shortcut",
      async () => {
        const clicked = await clickCentralBoardShortcut();
        if (clicked) {
          await waitForPathMatch((parts) => parts.length >= 2);
        }
      },
    );

    await perfProfiler.runStep(
      "zoom-max-wheel",
      "Wheel zoom to test max",
      async () => {
        await wheelToScale(PERF_TARGET_MAX_SCALE, PERF_ZOOM_IN_DELTA_Y, [
          [0.58, 0.56],
          [0.42, 0.48],
        ]);
      },
    );

    await perfProfiler.runStep(
      "drag-after-max",
      "Pan at max zoom",
      async () => {
        await dragTowardCorner("topLeft");
      },
    );

    await perfProfiler.runStep(
      "zoom-out-max",
      "Wheel zoom out to minimum",
      async () => {
        await wheelToScale(MIN_SCALE, PERF_ZOOM_OUT_DELTA_Y, [
          [0.5, 0.5],
          [0.58, 0.56],
        ]);
      },
    );

    perfProfiler.finishScenario();
  }, [
    clickCentralBoardShortcut,
    clickVisibleDistrictLabel,
    clickVisibleStop,
    dragTowardCorner,
    findGroundPoint,
    perfEnabled,
    perfProfiler,
    setCameraImmediate,
    stageRef,
    waitForCameraSettled,
    waitForPathMatch,
    wheelToScale,
  ]);

  return {
    runOfficialPerfProfile,
  };
}
