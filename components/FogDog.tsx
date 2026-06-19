"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A little dog that trots a looping meander around the Fog of Dog stop (in The
 * Graveyard district), leaving a trail of paw prints that fade behind it.
 *
 * Coordinates are TOWN space — this layer renders inside TownStage's
 * `translate(TOWN_OFFSET …)` group alongside WorldWorkerLayer. Movement uses the
 * same SVG-native `<animateMotion>` the workers use (no rAF). The paw prints are
 * static marks sampled along the path; each one is invisible until the dog
 * reaches it (per-print animation-delay = its fraction of the loop), stamps in,
 * then fades — repeating every loop. Purely decorative; no pointer events.
 *
 * Fog of Dog stop sits at TOWN {1233, 361}; the loop stays within The
 * Graveyard's bounds.
 */

const LOOP_SECONDS = 26;
const PAW_COUNT = 16;

// Closed meander loop around the Fog of Dog stop (TOWN coords).
const DOG_PATH =
  "M1233,300 C1318,302 1360,356 1322,418 C1294,462 1232,452 1180,432 " +
  "C1128,412 1108,360 1150,318 C1180,288 1208,286 1233,300 Z";

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
        @keyframes fog-dog-bob {
          0%, 100% { transform: translateY(0); }
          25%      { transform: translateY(-0.7px); }
          50%      { transform: translateY(0); }
          75%      { transform: translateY(-0.7px); }
        }
        .fog-dog-bob { animation: fog-dog-bob 0.5s ease-in-out infinite; }
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

      {/* The dog itself, trotting the loop and facing its direction of travel. */}
      <g>
        <g className="fog-dog-bob">
          <Dog />
        </g>
        <animateMotion
          dur={`${LOOP_SECONDS}s`}
          repeatCount="indefinite"
          rotate="auto"
          path={DOG_PATH}
          calcMode="linear"
        />
      </g>
    </g>
  );
}

// Top-down paw: a pad + three toe beans. Dark fill with a thin cream edge so it
// reads on both the dark graveyard ground and any lighter patches it crosses.
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

// Small top-down stylized dog, nose pointing +x (so rotate="auto" aims it along
// the path). Warm tan body with darker patches to sit in the Graveyard palette.
function Dog() {
  // Cream outline on the coat shapes so the dog reads against the dark, brown
  // graveyard instead of blending in.
  const outline = "#f5e6c8";
  const coat = "#d79a55";
  const coatDark = "#a76a2f";
  return (
    <g
      strokeLinejoin="round"
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
    >
      {/* soft ground shadow */}
      <ellipse cx={0} cy={2} rx={11} ry={4.5} fill="rgba(0,0,0,0.28)" />
      {/* tail */}
      <path
        d="M-9,0 q-6,-1 -8,-4"
        stroke={coat}
        strokeWidth={2.8}
        fill="none"
      />
      {/* body */}
      <ellipse
        cx={-1}
        cy={0}
        rx={9.5}
        ry={6}
        fill={coat}
        stroke={outline}
        strokeWidth={1.1}
      />
      {/* darker back patch */}
      <ellipse cx={-2} cy={-1} rx={6} ry={3.6} fill={coatDark} />
      {/* head */}
      <circle
        cx={8}
        cy={0}
        r={4.8}
        fill={coat}
        stroke={outline}
        strokeWidth={1.1}
      />
      {/* ears */}
      <ellipse cx={6.5} cy={-3.8} rx={1.8} ry={2.6} fill={coatDark} />
      <ellipse cx={6.5} cy={3.8} rx={1.8} ry={2.6} fill={coatDark} />
      {/* snout */}
      <ellipse cx={12} cy={0} rx={2.4} ry={1.8} fill="#ecc596" />
      {/* nose */}
      <circle cx={13.7} cy={0} r={1} fill="#241710" />
      {/* collar */}
      <path
        d="M3.5,-4 A4.8,4.8 0 0 1 3.5,4"
        stroke="#e0483a"
        strokeWidth={1.5}
        fill="none"
      />
    </g>
  );
}
