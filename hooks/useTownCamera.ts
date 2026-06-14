"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import {
  useMotionValue,
  useTransform,
  animate,
  type AnimationPlaybackControls,
} from "framer-motion";
import { useGesture } from "@use-gesture/react";
import { WORLD, TOWN_CENTER } from "@/lib/willville";
import type { TownPerfProbe } from "@/hooks/useTownInteractionProfiler";

export type Camera = { cx: number; cy: number; scale: number };
export type CameraCorner =
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight";

// 0.015 lets you zoom out far enough to see the full 2-year Gulf Stream in one
// view after panning east — the town shrinks to a ~36px dot at that scale.
// Previous floor was 0.6 (town always filled the screen).
export const MIN_SCALE = 0.015;
const MAX_SCALE = 128;
const DOUBLE_CLICK_ZOOM = 1.4;

const INITIAL_CAMERA: Camera = {
  cx: TOWN_CENTER.x,
  cy: TOWN_CENTER.y,
  scale: 1,
};

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 80,
  damping: 18,
  mass: 0.9,
};

function isTownControlTarget(event: Event | undefined): boolean {
  return !!(event?.target as Element | null)?.closest?.("[data-town-control]");
}

function clampScale(s: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

function clampCamera(c: Camera): Camera {
  const scale = clampScale(c.scale);
  return { cx: c.cx, cy: c.cy, scale };
}

export function cameraAtCorner(corner: CameraCorner, scale: number): Camera {
  return clampCamera({
    cx: corner.endsWith("Left") ? 0 : WORLD.width,
    cy: corner.startsWith("top") ? 0 : WORLD.height,
    scale,
  });
}

/** Map screen pixels → world coordinates under the current camera. */
export function screenToWorld(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
  camera: Camera,
): { wx: number; wy: number } {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) {
    return { wx: camera.cx, wy: camera.cy };
  }
  const vb = pt.matrixTransform(ctm.inverse());
  const s = camera.scale;
  return {
    wx: camera.cx + (vb.x - WORLD.width / 2) / s,
    wy: camera.cy + (vb.y - WORLD.height / 2) / s,
  };
}

/** viewBox→screen mapping: a uniform scale `s` + translate `(e,f)` (no skew). */
export type RootCtm = { s: number; e: number; f: number };

function readRootCtm(svg: SVGSVGElement | null): RootCtm {
  const ctm = svg?.getScreenCTM();
  if (!ctm) return { s: 1, e: 0, f: 0 };
  return { s: ctm.a, e: ctm.e, f: ctm.f };
}

/**
 * CSS transform for the GPU wrapper (transform-origin 0 0) that visually turns
 * the SVG rendered at `committed` into the view at `live`. Derived so that
 * W ∘ render(committed) == render(live): committing (re-render `<g>` at `live`
 * + reset W to identity) is therefore pixel-identical and never jumps.
 *
 * Screen position of world point p under a camera is
 *   S(p) = R.s·((p − c)·scale + WORLD/2) + (R.e, R.f)
 * (matches screenToWorld inverted). Matching W(S_committed)=S_live for all p
 * gives k = live.scale/committed.scale and the translates below.
 */
export function computeWrapperTransform(
  committed: Camera,
  live: Camera,
  R: RootCtm,
): string {
  const W2 = WORLD.width / 2;
  const H2 = WORLD.height / 2;
  const k = live.scale / committed.scale;
  const tx =
    R.s * ((committed.cx - live.cx) * live.scale + W2) +
    R.e -
    k * (R.s * W2 + R.e);
  const ty =
    R.s * ((committed.cy - live.cy) * live.scale + H2) +
    R.f -
    k * (R.s * H2 + R.f);
  return `translate(${tx}px, ${ty}px) scale(${k})`;
}

// Stage 1 (wheel zoom) gesture/settle hybrid tuning.
const ZOOM_SETTLE_MS = 140; // commit (crisp re-render) this long after last zoom
const ZOOM_WRAPPER_MAX = 1.6; // re-baseline before the GPU-scaled raster gets soft

export function useTownCamera(
  svgRef: RefObject<SVGSVGElement | null>,
  stageRef: RefObject<HTMLDivElement | null>,
  cameraGroupRef: RefObject<SVGGElement | null>,
  wrapperRef: RefObject<HTMLDivElement | null>,
  perf?: TownPerfProbe,
) {
  // MotionValues drive the visual transform directly — no React renders mid-drag.
  const mvCx = useMotionValue(INITIAL_CAMERA.cx);
  const mvCy = useMotionValue(INITIAL_CAMERA.cy);
  const mvScale = useMotionValue(INITIAL_CAMERA.scale);

  const W2 = WORLD.width / 2;
  const H2 = WORLD.height / 2;

  const cameraTransform = useTransform(
    [mvCx, mvCy, mvScale] as const,
    ([cx, cy, s]: number[]) =>
      `translate(${W2 - cx * s} ${H2 - cy * s}) scale(${s})`,
  );

  const [isDragging, setIsDragging] = useState(false);
  const hudDragRef = useRef(false);
  const didTriggerDragRef = useRef(false);
  const wasDraggingRef = useRef(false);

  const resetDragInteraction = useCallback(() => {
    setIsDragging(false);
    hudDragRef.current = false;
    didTriggerDragRef.current = false;
    if (svgRef.current) {
      svgRef.current.style.pointerEvents = "auto";
    }
  }, [svgRef]);

  // In-flight spring animations — cancelled when drag starts.
  const animsRef = useRef<AnimationPlaybackControls[]>([]);
  const stopAnims = useCallback(() => {
    animsRef.current.forEach((a) => a.stop());
    animsRef.current = [];
  }, []);

  const animateTo = useCallback(
    (target: Camera) => {
      stopAnims();
      const c = clampCamera(target);
      animsRef.current = [
        animate(mvCx, c.cx, SPRING_CONFIG),
        animate(mvCy, c.cy, SPRING_CONFIG),
        animate(mvScale, c.scale, SPRING_CONFIG),
      ];
    },
    [stopAnims, mvCx, mvCy, mvScale],
  );

  const setCameraImmediate = useCallback(
    (target: Camera) => {
      stopAnims();
      const next = clampCamera(target);
      mvCx.set(next.cx);
      mvCy.set(next.cy);
      mvScale.set(next.scale);
    },
    [stopAnims, mvCx, mvCy, mvScale],
  );

  // Returns the current visual camera position (reads MotionValues, not React state).
  const getCameraSnapshot = useCallback(
    (): Camera => ({
      cx: mvCx.get(),
      cy: mvCy.get(),
      scale: mvScale.get(),
    }),
    [mvCx, mvCy, mvScale],
  );

  // --- Zoom gesture/settle hybrid (Stage 1: wheel) -------------------------
  // During an active zoom gesture the camera <g> is frozen at `commitBaseline`
  // (no per-frame SVG re-raster — that's the Retina blank). Instead the GPU
  // `wrapper` is CSS-scaled to show the live camera. On settle we re-render the
  // <g> crisp once and reset the wrapper. `zoomActiveRef` tells the <g> camera
  // subscription (in useTownStageState) to stand down while we drive the wrapper.
  const zoomActiveRef = useRef(false);
  const commitBaselineRef = useRef<Camera>(INITIAL_CAMERA);
  const rootCtmRef = useRef<RootCtm>({ s: 1, e: 0, f: 0 });
  const settleTimerRef = useRef<number | null>(null);

  const writeGroupTransform = useCallback(() => {
    const g = cameraGroupRef.current;
    if (!g) return;
    const value = cameraTransform.get();
    if (perf)
      perf.measure("domApply", () => g.setAttribute("transform", value));
    else g.setAttribute("transform", value);
  }, [cameraGroupRef, cameraTransform, perf]);

  const applyWrapperTransform = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    wrapper.style.transform = computeWrapperTransform(
      commitBaselineRef.current,
      getCameraSnapshot(),
      rootCtmRef.current,
    );
  }, [wrapperRef, getCameraSnapshot]);

  const clearSettle = useCallback(() => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  const beginZoomGesture = useCallback(() => {
    commitBaselineRef.current = getCameraSnapshot();
    rootCtmRef.current = readRootCtm(svgRef.current);
    zoomActiveRef.current = true;
  }, [getCameraSnapshot, svgRef]);

  // Crisp re-render at the live camera, then drop the wrapper — same task so no
  // intermediate frame. Safe to call when no gesture is active (no-op).
  const commitZoom = useCallback(() => {
    clearSettle();
    if (!zoomActiveRef.current) return;
    writeGroupTransform();
    const wrapper = wrapperRef.current;
    if (wrapper) wrapper.style.transform = "none";
    commitBaselineRef.current = getCameraSnapshot();
    zoomActiveRef.current = false;
  }, [clearSettle, writeGroupTransform, wrapperRef, getCameraSnapshot]);

  const scheduleSettle = useCallback(() => {
    clearSettle();
    settleTimerRef.current = window.setTimeout(commitZoom, ZOOM_SETTLE_MS);
  }, [clearSettle, commitZoom]);

  // Called AFTER the wheel step has updated the live camera (the gesture is
  // already begun, so `commitBaseline` is the pre-step camera). Drive the
  // wrapper while zooming in (k>=1, magnifies the painted raster — no reveal,
  // no blank). Zooming out below baseline, or scaling past the soft-raster
  // bound, force-commits and re-baselines so the wrapper stays in [1, MAX].
  const onWheelZoomStep = useCallback(() => {
    const k = mvScale.get() / commitBaselineRef.current.scale;
    if (k < 1 || k > ZOOM_WRAPPER_MAX) {
      commitZoom();
      beginZoomGesture();
    }
    applyWrapperTransform();
    scheduleSettle();
  }, [
    mvScale,
    commitZoom,
    beginZoomGesture,
    applyWrapperTransform,
    scheduleSettle,
  ]);

  const panByPixels = useCallback(
    (dx: number, dy: number) => {
      const ctm = perf
        ? perf.measure("layoutRead", () => svgRef.current?.getScreenCTM())
        : svgRef.current?.getScreenCTM();
      const vbScale = ctm ? ctm.a : 1;
      const scale = mvScale.get();
      const clamped = perf
        ? perf.measure("cameraMath", () =>
            clampCamera({
              cx: mvCx.get() - dx / (vbScale * scale),
              cy: mvCy.get() - dy / (vbScale * scale),
              scale,
            }),
          )
        : clampCamera({
            cx: mvCx.get() - dx / (vbScale * scale),
            cy: mvCy.get() - dy / (vbScale * scale),
            scale,
          });

      if (perf) {
        perf.measure("motionWrites", () => {
          mvCx.set(clamped.cx);
          mvCy.set(clamped.cy);
        });
        perf.scheduleFrameSample();
        return;
      }

      mvCx.set(clamped.cx);
      mvCy.set(clamped.cy);
    },
    [mvCx, mvCy, mvScale, perf, svgRef],
  );

  const zoomToScaleAtViewportPoint = useCallback(
    (clientX: number, clientY: number, targetScale: number) => {
      stopAnims();

      const snapshot = getCameraSnapshot();
      const svg = svgRef.current;
      const mouseWorld = svg
        ? perf
          ? perf.measure("layoutRead", () =>
              screenToWorld(svg, clientX, clientY, snapshot),
            )
          : screenToWorld(svg, clientX, clientY, snapshot)
        : null;

      const scale = perf
        ? perf.measure("cameraMath", () => clampScale(targetScale))
        : clampScale(targetScale);

      let cx = snapshot.cx;
      let cy = snapshot.cy;

      if (mouseWorld) {
        const next = perf
          ? perf.measure("cameraMath", () => ({
              cx:
                mouseWorld.wx -
                (mouseWorld.wx - snapshot.cx) * (snapshot.scale / scale),
              cy:
                mouseWorld.wy -
                (mouseWorld.wy - snapshot.cy) * (snapshot.scale / scale),
            }))
          : {
              cx:
                mouseWorld.wx -
                (mouseWorld.wx - snapshot.cx) * (snapshot.scale / scale),
              cy:
                mouseWorld.wy -
                (mouseWorld.wy - snapshot.cy) * (snapshot.scale / scale),
            };
        cx = next.cx;
        cy = next.cy;
      }

      const clamped = perf
        ? perf.measure("cameraMath", () => clampCamera({ cx, cy, scale }))
        : clampCamera({ cx, cy, scale });

      if (perf) {
        perf.measure("motionWrites", () => {
          mvCx.set(clamped.cx);
          mvCy.set(clamped.cy);
          mvScale.set(clamped.scale);
        });
        perf.scheduleFrameSample();
        return;
      }

      mvCx.set(clamped.cx);
      mvCy.set(clamped.cy);
      mvScale.set(clamped.scale);
    },
    [getCameraSnapshot, mvCx, mvCy, mvScale, perf, stopAnims, svgRef],
  );

  const wheelZoomAtViewportPoint = useCallback(
    (clientX: number, clientY: number, dy: number) => {
      const factor = Math.min(1.2, Math.max(0.8, Math.exp(-dy * 0.001)));
      zoomToScaleAtViewportPoint(clientX, clientY, mvScale.get() * factor);
    },
    [mvScale, zoomToScaleAtViewportPoint],
  );

  useGesture(
    {
      onDragStart: ({ event }) => {
        // A drag reveals new content the wrapper can't fake — land any pending
        // zoom (crisp <g>, wrapper reset) before pan takes the direct path.
        commitZoom();
        if (isTownControlTarget(event)) {
          hudDragRef.current = true;
          return;
        }
        hudDragRef.current =
          !!(event.target as Element)?.closest?.("[data-project-hud]") ||
          !!(event.target as Element)?.closest?.('[data-no-pan="true"]');
        if (!hudDragRef.current) {
          if (event.cancelable) event.preventDefault();
          stopAnims();
          didTriggerDragRef.current = false;
          wasDraggingRef.current = false;
        }
      },
      onDrag: ({ delta: [dx, dy], pinching, event }) => {
        if (hudDragRef.current || pinching) return;
        if (event.cancelable) event.preventDefault();
        if (!didTriggerDragRef.current) {
          didTriggerDragRef.current = true;
          setIsDragging(true);
          const pointerType =
            event && "pointerType" in event
              ? (event as PointerEvent).pointerType
              : undefined;
          if (svgRef.current && pointerType !== "touch") {
            svgRef.current.style.pointerEvents = "none";
          }
        }
        wasDraggingRef.current = true;
        panByPixels(dx, dy);
        // No setIsDragging / setState here — zero React renders mid-drag.
      },
      onDragEnd: () => {
        resetDragInteraction();
        setTimeout(() => {
          wasDraggingRef.current = false;
        }, 50);
      },
      onWheel: ({ delta: [, dy], event }) => {
        if (isTownControlTarget(event)) return;
        if (event && event.cancelable) {
          event.preventDefault();
        }
        const clientX =
          event && typeof (event as any).clientX === "number"
            ? (event as any).clientX
            : 0;
        const clientY =
          event && typeof (event as any).clientY === "number"
            ? (event as any).clientY
            : 0;
        // Snapshot the pre-step baseline BEFORE the camera moves, then drive the
        // wrapper from the resulting delta (Stage 1 hybrid — see onWheelZoomStep).
        if (!zoomActiveRef.current) beginZoomGesture();
        wheelZoomAtViewportPoint(clientX, clientY, dy);
        onWheelZoomStep();
      },
      onPinchStart: ({ event }) => {
        if (isTownControlTarget(event)) return;
        if (event && event.cancelable) {
          event.preventDefault();
        }
        // Avoid drag/pinch contention when a second finger lands.
        resetDragInteraction();
      },
      onPinch: ({ event, origin: [ox, oy], offset: [scale] }) => {
        if (isTownControlTarget(event)) return;
        if (event && event.cancelable) {
          event.preventDefault();
        }
        zoomToScaleAtViewportPoint(ox, oy, scale);
      },
    },
    {
      target: stageRef,
      drag: {
        filterTaps: true,
        threshold: 4,
        pointer: { capture: false },
      },
      pinch: {
        eventOptions: { passive: false },
        pointer: { touch: true },
        scaleBounds: { min: MIN_SCALE, max: MAX_SCALE },
        from: () => [mvScale.get(), 0],
      },
      wheel: { eventOptions: { passive: false } },
    },
  );

  const focusWorldPoint = useCallback(
    (wx: number, wy: number, scale: number) => {
      animateTo({ cx: wx, cy: wy, scale });
    },
    [animateTo],
  );

  const resetToTown = useCallback(() => {
    animateTo(INITIAL_CAMERA);
  }, [animateTo]);

  const zoomAtWorldPoint = useCallback(
    (wx: number, wy: number) => {
      animateTo({
        cx: wx,
        cy: wy,
        scale: clampScale(mvScale.get() * DOUBLE_CLICK_ZOOM),
      });
    },
    [animateTo, mvScale],
  );

  return {
    getCameraSnapshot,
    isDragging,
    cameraTransform,
    mvScale,
    focusWorldPoint,
    panByPixels,
    resetToTown,
    resetDragInteraction,
    setCameraImmediate,
    wheelZoomAtViewportPoint,
    zoomAtWorldPoint,
    // Zoom gesture/settle hybrid: the <g> camera subscription skips while this
    // is true (the wrapper is driving), and click handlers commit any pending
    // zoom so hit-testing sees a crisp <g> + identity wrapper.
    zoomActiveRef,
    commitPendingZoom: commitZoom,
    markSkipDrag: () => {},
    stageHandlers: {},
    wasDragging: () => wasDraggingRef.current,
  };
}
