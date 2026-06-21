"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A black lab that trots a looping meander around the fogofdog-frontend stop
 * (in The Zeitgeist district), leaving a trail of paw prints that fade behind it.
 *
 * Coordinates are TOWN space — this layer renders inside TownStage's
 * `translate(TOWN_OFFSET …)` group alongside WorldWorkerLayer. Movement uses the
 * same SVG-native `<animateMotion>` the workers use (no rAF). The paw prints are
 * static marks sampled along the path; each one is invisible until the dog
 * reaches it (per-print animation-delay = its fraction of the loop), stamps in,
 * then fades — repeating every loop. Purely decorative; no pointer events.
 *
 * fogofdog-frontend sits at TOWN {1008, 320}; the loop stays within The
 * Zeitgeist's bounds.
 */

const LOOP_SECONDS = 26;
const PAW_COUNT = 16;

// Closed meander loop around fogofdog-frontend (TOWN coords, center ~{1008, 320}).
const DOG_PATH =
  "M1008,258 C1088,260 1122,308 1090,366 C1066,408 1006,400 956,382 " +
  "C906,364 893,316 935,276 C965,250 988,248 1008,258 Z";

type Paw = { x: number; y: number; angle: number; delay: number; side: 1 | -1 };

export function FogDog() {
  const pathRef = useRef<SVGPathElement>(null);
  const [paws, setPaws] = useState<Paw[]>([]);

  // Sample paw positions + facing angles along the path once it's mounted.
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    if (!total) return;
    const next: Paw[] = [];
    for (let i = 0; i < PAW_COUNT; i += 1) {
      const frac = i / PAW_COUNT;
      const at = path.getPointAtLength(frac * total);
      const ahead = path.getPointAtLength(((frac * total + 2) % total) + 0);
      const angle =
        (Math.atan2(ahead.y - at.y, ahead.x - at.x) * 180) / Math.PI;
      const side: 1 | -1 = i % 2 === 0 ? 1 : -1;
      // nudge each print to the left/right of the path so it reads as
      // alternating footfalls rather than a centered dotted line.
      const rad = (angle * Math.PI) / 180;
      const nx = -Math.sin(rad) * 3.2 * side;
      const ny = Math.cos(rad) * 3.2 * side;
      next.push({
        x: at.x + nx,
        y: at.y + ny,
        angle,
        delay: frac * LOOP_SECONDS,
        side,
      });
    }
    setPaws(next);
  }, []);

  return (
    <g id="fog-dog-layer" aria-hidden="true" style={{ pointerEvents: "none" }}>
      <style>{`
        @keyframes fog-dog-paw {
          0%   { opacity: 0.8; }
          16%  { opacity: 0.8; }
          60%  { opacity: 0; }
          100% { opacity: 0; }
        }
        .fog-dog-paw {
          opacity: 0;
          animation: fog-dog-paw ${LOOP_SECONDS}s linear infinite;
          will-change: opacity;
        }
      `}</style>

      {/* Hidden geometry the paw sampler reads (never painted). */}
      <path ref={pathRef} d={DOG_PATH} fill="none" stroke="none" />

      {/* Paw prints, stamped + fading along the path. */}
      {paws.map((paw, i) => (
        <g
          key={i}
          className="fog-dog-paw"
          transform={`translate(${paw.x.toFixed(2)} ${paw.y.toFixed(2)}) rotate(${paw.angle.toFixed(1)})`}
          style={{ animationDelay: `${paw.delay.toFixed(2)}s` }}
        >
          <PawPrint />
        </g>
      ))}

      {/* The dog itself — real art pulled from the kennel-storefront totem sprite. */}
      <g>
        <animateMotion
          dur={`${LOOP_SECONDS}s`}
          repeatCount="indefinite"
          rotate="auto"
          path={DOG_PATH}
          calcMode="linear"
        />
        {/* Image centered on (0,0); dog faces +x to match rotate="auto". */}
        <image
          href="/art/stops/fogdog-walker.png"
          x={-18}
          y={-14}
          width={36}
          height={28}
        />
      </g>
    </g>
  );
}

// Top-down paw: a pad + three toe beans. Dark fill with a thin cream edge.
function PawPrint() {
  return (
    <g
      fill="#2e2014"
      stroke="#efe1c2"
      strokeWidth={0.45}
      vectorEffect="non-scaling-stroke"
    >
      <ellipse cx={0} cy={0} rx={1.6} ry={2} />
      <circle cx={-1.8} cy={-1.5} r={0.78} />
      <circle cx={0} cy={-2.2} r={0.78} />
      <circle cx={1.8} cy={-1.5} r={0.78} />
    </g>
  );
}
