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

export const MIN_SCALE = 0.6;
export const MAX_SCALE = 128;
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
  const halfW = WORLD.width / (2 * scale);
  const halfH = WORLD.height / (2 * scale);
  const worldHalfW = WORLD.width / 2;
  const worldHalfH = WORLD.height / 2;
  // Zoomed out (world fits in viewport): lock camera to world centre.
  // Zoomed in: clamp so world edges stay flush with viewport edges.
  const cx =
    halfW >= worldHalfW
      ? worldHalfW
      : Math.min(WORLD.width - halfW, Math.max(halfW, c.cx));
  const cy =
    halfH >= worldHalfH
      ? worldHalfH
      : Math.min(WORLD.height - halfH, Math.max(halfH, c.cy));
  return { cx, cy, scale };
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

export function useTownCamera(
  svgRef: RefObject<SVGSVGElement | null>,
  stageRef: RefObject<HTMLDivElement | null>,
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

  const wheelZoomAtViewportPoint = useCallback(
    (clientX: number, clientY: number, dy: number) => {
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

      const factor = Math.min(1.2, Math.max(0.8, Math.exp(-dy * 0.001)));
      const scale = perf
        ? perf.measure("cameraMath", () => clampScale(snapshot.scale * factor))
        : clampScale(snapshot.scale * factor);

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

  useGesture(
    {
      onDragStart: ({ event }) => {
        if (isTownControlTarget(event)) {
          hudDragRef.current = true;
          return;
        }
        hudDragRef.current = !!(event.target as Element)?.closest?.(
          "[data-project-hud]",
        );
        if (!hudDragRef.current) {
          stopAnims();
          didTriggerDragRef.current = false;
          wasDraggingRef.current = false;
        }
      },
      onDrag: ({ delta: [dx, dy] }) => {
        if (hudDragRef.current) return;
        if (!didTriggerDragRef.current) {
          didTriggerDragRef.current = true;
          setIsDragging(true);
          if (svgRef.current) {
            svgRef.current.style.pointerEvents = "none";
          }
        }
        wasDraggingRef.current = true;
        panByPixels(dx, dy);
        // No setIsDragging / setState here — zero React renders mid-drag.
      },
      onDragEnd: () => {
        if (!hudDragRef.current) {
          setIsDragging(false);
          didTriggerDragRef.current = false;
          if (svgRef.current) {
            svgRef.current.style.pointerEvents = "auto";
          }
        }
        hudDragRef.current = false;
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
        wheelZoomAtViewportPoint(clientX, clientY, dy);
      },
    },
    {
      target: stageRef,
      drag: {
        filterTaps: true,
        threshold: 4,
        pointer: { capture: false, touch: true },
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
    setCameraImmediate,
    wheelZoomAtViewportPoint,
    zoomAtWorldPoint,
    markSkipDrag: () => {},
    stageHandlers: {},
    wasDragging: () => wasDraggingRef.current,
  };
}
