"use client";

import { useMemo, useRef, useEffect } from "react";
import type { Stop } from "@/lib/town";
import { GENERATED_TOWN_LAYOUT } from "@/lib/town-layout";

type Phase = "running" | "done" | "error";

type Props = {
  stops: Stop[];
  phase: Phase;
};

type Messenger = {
  id: string;
  outboundPath: string;
  returnPath: string;
};

const BELL = GENERATED_TOWN_LAYOUT.landmarks.bellTower;
const OUTBOUND_SECONDS = 2.2;
const RETURN_SECONDS = 1.6;
const MAX_RIPPLE_SECONDS = 1.2;

function messengerRoute(
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const mid = {
    x: Math.round((from.x + to.x) / 2),
    y: Math.round((from.y + to.y) / 2),
  };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const bend = Math.min(100, Math.max(30, distance * 0.15));
  const nx = -dy / distance;
  const ny = dx / distance;
  const cx1 = Math.round(mid.x + nx * bend);
  const cy1 = Math.round(mid.y + ny * bend);
  const cx2 = Math.round(mid.x - nx * bend * 0.7);
  const cy2 = Math.round(mid.y - ny * bend * 0.7);
  return {
    outbound: `M ${from.x} ${from.y} C ${cx1} ${cy1}, ${cx1} ${cy1}, ${to.x} ${to.y}`,
    inbound: `M ${to.x} ${to.y} C ${cx2} ${cy2}, ${cx2} ${cy2}, ${from.x} ${from.y}`,
  };
}

/**
 * Small glowing dots that fan out from the bell tower to every stop when the
 * bell is rung, then return after manifests are gathered.
 *
 * All animations use begin="indefinite" and are kicked off imperatively via
 * beginElementAt(delay) so timing is relative to mount, not document start.
 */
export function BellMessengers({ stops, phase }: Props) {
  const messengers = useMemo<Messenger[]>(
    () =>
      stops.map((stop) => {
        const route = messengerRoute(BELL, stop.position);
        return {
          id: `${stop.district}-${stop.id}`,
          outboundPath: route.outbound,
          returnPath: route.inbound,
        };
      }),
    [stops],
  );

  const stagger = useMemo(
    () =>
      messengers.length > 1
        ? Math.min(MAX_RIPPLE_SECONDS / (messengers.length - 1), 0.06)
        : 0,
    [messengers.length],
  );

  const containerRef = useRef<SVGGElement>(null);

  // Kick off all SMIL animations imperatively on mount / phase change.
  useEffect(() => {
    const g = containerRef.current;
    if (!g) return;
    const anims = g.querySelectorAll<
      SVGAnimateElement | SVGAnimateMotionElement
    >("animateMotion, animate");
    anims.forEach((anim) => {
      const delay = parseFloat(anim.getAttribute("data-delay") ?? "0");
      anim.beginElementAt(delay);
    });
  }, [phase]);

  const isOutbound = phase === "running";
  const isReturn = phase === "done";
  if (!isOutbound && !isReturn) return null;

  const dur = isOutbound ? OUTBOUND_SECONDS : RETURN_SECONDS;
  const color = isOutbound ? "#e6c66a" : "#8cd4a0";
  const radius = isOutbound ? 3.5 : 3;

  return (
    <g
      ref={containerRef}
      key={phase}
      id="bell-messengers"
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    >
      <defs>
        <filter
          id="bell-messenger-glow"
          x="-100%"
          y="-100%"
          width="300%"
          height="300%"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {messengers.map((m, i) => {
        const path = isOutbound ? m.outboundPath : m.returnPath;
        const delay = i * stagger;
        return (
          <circle
            key={m.id}
            r={radius}
            fill={color}
            opacity={0}
            filter="url(#bell-messenger-glow)"
          >
            <animateMotion
              dur={`${dur}s`}
              begin="indefinite"
              data-delay={delay.toFixed(3)}
              repeatCount="1"
              fill="freeze"
              path={path}
              calcMode="spline"
              keyTimes="0;1"
              keySplines="0.25 0.1 0.25 1"
            />
            <animate
              attributeName="opacity"
              values={isOutbound ? "0;0.9;0.9;0" : "0;0.85;0.85;0"}
              keyTimes={isOutbound ? "0;0.06;0.82;1" : "0;0.08;0.78;1"}
              dur={`${dur}s`}
              begin="indefinite"
              data-delay={delay.toFixed(3)}
              repeatCount="1"
              fill="freeze"
              calcMode="linear"
            />
          </circle>
        );
      })}
    </g>
  );
}
