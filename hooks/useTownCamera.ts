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

export type Camera = { cx: number; cy: number; scale: number };

export const MIN_SCALE = 0.6;
export const MAX_SCALE = 4;
const ZOOM_FACTOR = 1.12;
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

function clampScale(s: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

function clampCamera(c: Camera): Camera {
  const halfW = WORLD.width / (2 * c.scale);
  const halfH = WORLD.height / (2 * c.scale);
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
  return { cx, cy, scale: clampScale(c.scale) };
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
) {
  // MotionValues drive the visual transform directly — no React renders mid-drag.
  const mvCx = useMotionValue(INITIAL_CAMERA.cx);
  const mvCy = useMotionValue(INITIAL_CAMERA.cy);
  const mvScale = useMotionValue(INITIAL_CAMERA.scale);

  const W2 = WORLD.width / 2;
  const H2 = WORLD.height / 2;

  // Fixed-pivot derived transforms (pivot = world centre = W/2, H/2).
  // Mathematically equivalent to translate(W/2-cx, H/2-cy) scale(s) around (cx,cy).
  const gX = useTransform(
    [mvCx, mvScale] as const,
    ([cx, s]: number[]) => (W2 - cx) * s,
  );
  const gY = useTransform(
    [mvCy, mvScale] as const,
    ([cy, s]: number[]) => (H2 - cy) * s,
  );

  const [isDragging, setIsDragging] = useState(false);
  const hudDragRef = useRef(false);
  const didTriggerDragRef = useRef(false);

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

  // Returns the current visual camera position (reads MotionValues, not React state).
  const getCameraSnapshot = useCallback(
    (): Camera => ({
      cx: mvCx.get(),
      cy: mvCy.get(),
      scale: mvScale.get(),
    }),
    [mvCx, mvCy, mvScale],
  );

  useGesture(
    {
      onDragStart: ({ event }) => {
        hudDragRef.current = !!(event.target as Element)?.closest?.(
          "[data-project-hud]",
        );
        if (!hudDragRef.current) {
          stopAnims();
          didTriggerDragRef.current = false;
        }
      },
      onDrag: ({ delta: [dx, dy] }) => {
        if (hudDragRef.current) return;
        if (!didTriggerDragRef.current) {
          didTriggerDragRef.current = true;
          setIsDragging(true);
        }
        // vbScale: CSS pixels per SVG viewBox unit (accounts for letterboxing).
        const ctm = svgRef.current?.getScreenCTM();
        const vbScale = ctm ? ctm.a : 1;
        const s = mvScale.get();
        const clamped = clampCamera({
          cx: mvCx.get() - dx / (vbScale * s),
          cy: mvCy.get() - dy / (vbScale * s),
          scale: s,
        });
        mvCx.set(clamped.cx);
        mvCy.set(clamped.cy);
        // No setIsDragging / setState here — zero React renders mid-drag.
      },
      onDragEnd: () => {
        if (!hudDragRef.current) {
          setIsDragging(false);
          didTriggerDragRef.current = false;
        }
        hudDragRef.current = false;
      },
      onWheel: ({ delta: [, dy] }) => {
        stopAnims();
        const s = clampScale(
          dy < 0 ? mvScale.get() * ZOOM_FACTOR : mvScale.get() / ZOOM_FACTOR,
        );
        const clamped = clampCamera({
          cx: mvCx.get(),
          cy: mvCy.get(),
          scale: s,
        });
        mvCx.set(clamped.cx);
        mvCy.set(clamped.cy);
        mvScale.set(clamped.scale);
      },
    },
    {
      target: stageRef,
      drag: {
        filterTaps: true,
        threshold: 4,
        pointer: { touch: true },
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
    gX,
    gY,
    mvScale,
    focusWorldPoint,
    resetToTown,
    zoomAtWorldPoint,
    markSkipDrag: () => {},
    stageHandlers: {},
  };
}
