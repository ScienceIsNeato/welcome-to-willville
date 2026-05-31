import { DISTRICTS, TOWN } from "@/lib/willville";
import {
  CANAL_SECTION,
  GENERATED_TOWN_LAYOUT,
  pointsToPath,
  wallLoopPathForDistrict,
} from "@/lib/town-layout";
import { RAINBOW_BRICK_LAYERS } from "@/lib/rainbow-brick-layers";

type WallLoop = {
  id: string;
  path: string;
  duration: number;
};

const WALL_PATH_LENGTH = 3600;

function loopForDistrict(
  district: (typeof DISTRICTS)[number],
  index: number,
): WallLoop {
  return {
    id: district.id,
    path: wallLoopPathForDistrict(district.id),
    duration: 96 + index * 9,
  };
}

export function DynamicWalls() {
  const loops = DISTRICTS.map(loopForDistrict);

  return (
    <g className="dynamic-walls" aria-hidden="true">
      <defs>
        <clipPath id="willville-wall-land-clip">
          <path d={GENERATED_TOWN_LAYOUT.landPath} />
        </clipPath>
        <mask
          id="willville-wall-pixel-mask"
          maskUnits="userSpaceOnUse"
          x={0}
          y={0}
          width={TOWN.width}
          height={TOWN.height}
        >
          <rect
            x={0}
            y={0}
            width={TOWN.width}
            height={TOWN.height}
            fill="black"
          />
          {loops.map((loop) => (
            <path
              key={`mask-${loop.id}`}
              d={loop.path}
              fill="none"
              stroke="white"
              strokeWidth={20}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          <path
            d={pointsToPath(CANAL_SECTION.polygon)}
            fill="none"
            stroke="black"
            strokeWidth={72}
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
        </mask>
      </defs>

      <g
        clipPath="url(#willville-wall-land-clip)"
        mask="url(#willville-wall-pixel-mask)"
      >
        <rect
          className="dynamic-wall-source-shadow"
          x={0}
          y={0}
          width={TOWN.width}
          height={TOWN.height}
        />
        <rect
          className="dynamic-wall-base"
          x={0}
          y={0}
          width={TOWN.width}
          height={TOWN.height}
        />
        {loops.map((loop, loopIndex) => (
          <g key={loop.id} className="dynamic-wall-loop">
            <path
              d={loop.path}
              className="dynamic-wall-loop-bed"
              fill="none"
              pathLength={WALL_PATH_LENGTH}
            />
            <path
              d={loop.path}
              className="dynamic-wall-loop-stones dynamic-wall-loop-stones-a"
              fill="none"
              pathLength={WALL_PATH_LENGTH}
              style={
                {
                  animationName: "dynamic-wall-dash-left",
                  animationDuration: `${loop.duration}s`,
                  animationTimingFunction: "linear",
                  animationIterationCount: "infinite",
                  willChange: "stroke-dashoffset",
                  "--dash-start": "0",
                  "--dash-len": `${WALL_PATH_LENGTH}`,
                } as React.CSSProperties
              }
            />
            <path
              d={loop.path}
              className="dynamic-wall-loop-stones dynamic-wall-loop-stones-b"
              fill="none"
              pathLength={WALL_PATH_LENGTH}
              style={
                {
                  animationName: "dynamic-wall-dash-left",
                  animationDuration: `${loop.duration * 1.08}s`,
                  animationTimingFunction: "linear",
                  animationIterationCount: "infinite",
                  willChange: "stroke-dashoffset",
                  "--dash-start": `${90 + loopIndex * 9}`,
                  "--dash-len": `${WALL_PATH_LENGTH}`,
                } as React.CSSProperties
              }
            />
            {RAINBOW_BRICK_LAYERS.map((brickLayer) => (
              <path
                key={`${loop.id}-${brickLayer.className}`}
                d={loop.path}
                className={`dynamic-wall-loop-stones dynamic-wall-loop-rainbow-bricks ${brickLayer.className}`}
                fill="none"
                pathLength={WALL_PATH_LENGTH}
                style={
                  {
                    animationName: "dynamic-wall-dash-left",
                    animationDuration: `${loop.duration * brickLayer.speed}s`,
                    animationTimingFunction: "linear",
                    animationIterationCount: "infinite",
                    willChange: "stroke-dashoffset",
                    "--dash-start": `${brickLayer.offset + loopIndex * 13}`,
                    "--dash-len": `${WALL_PATH_LENGTH}`,
                  } as React.CSSProperties
                }
              />
            ))}
            <path
              d={loop.path}
              className="dynamic-wall-loop-mortar"
              fill="none"
              pathLength={WALL_PATH_LENGTH}
              style={
                {
                  animationName: "dynamic-wall-dash-left",
                  animationDuration: `${loop.duration}s`,
                  animationTimingFunction: "linear",
                  animationIterationCount: "infinite",
                  willChange: "stroke-dashoffset",
                  "--dash-start": "0",
                  "--dash-len": `${WALL_PATH_LENGTH}`,
                } as React.CSSProperties
              }
            />
            <path
              d={loop.path}
              className="dynamic-wall-loop-glints"
              fill="none"
              pathLength={WALL_PATH_LENGTH}
              style={
                {
                  animationName: "dynamic-wall-dash-right",
                  animationDuration: `${loop.duration * 0.72}s`,
                  animationTimingFunction: "linear",
                  animationIterationCount: "infinite",
                  willChange: "stroke-dashoffset",
                  "--dash-start": `${180 - loopIndex * 11}`,
                  "--dash-len": `${WALL_PATH_LENGTH}`,
                } as React.CSSProperties
              }
            />
          </g>
        ))}
      </g>
    </g>
  );
}
