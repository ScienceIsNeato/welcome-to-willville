import { DISTRICTS, type District } from "@/lib/willville";

type Point = {
  x: number;
  y: number;
};

type WallLoop = {
  id: string;
  path: string;
  duration: number;
};

const WALL_PATH_LENGTH = 3600;

const CUSTOM_LOOP_POINTS: Partial<Record<District["id"], Point[]>> = {
  "the-press-row": [
    { x: 373, y: 49 },
    { x: 430, y: 44 },
    { x: 490, y: 47 },
    { x: 540, y: 80 },
    { x: 562, y: 137 },
    { x: 579, y: 188 },
    { x: 613, y: 234 },
    { x: 639, y: 295 },
    { x: 688, y: 378 },
    { x: 656, y: 455 },
    { x: 560, y: 463 },
    { x: 466, y: 418 },
    { x: 419, y: 382 },
    { x: 357, y: 363 },
    { x: 317, y: 368 },
    { x: 256, y: 372 },
    { x: 199, y: 342 },
    { x: 112, y: 301 },
    { x: 63, y: 218 },
    { x: 113, y: 144 },
    { x: 193, y: 108 },
    { x: 264, y: 88 },
    { x: 320, y: 67 },
  ],
  "web-row": [
    { x: 807, y: 43 },
    { x: 843, y: 43 },
    { x: 883, y: 44 },
    { x: 922, y: 54 },
    { x: 946, y: 88 },
    { x: 964, y: 123 },
    { x: 975, y: 160 },
    { x: 977, y: 197 },
    { x: 970, y: 234 },
    { x: 957, y: 267 },
    { x: 944, y: 299 },
    { x: 931, y: 333 },
    { x: 913, y: 367 },
    { x: 884, y: 393 },
    { x: 848, y: 407 },
    { x: 809, y: 410 },
    { x: 772, y: 404 },
    { x: 731, y: 403 },
    { x: 699, y: 391 },
    { x: 678, y: 354 },
    { x: 659, y: 324 },
    { x: 639, y: 297 },
    { x: 623, y: 267 },
    { x: 613, y: 235 },
    { x: 607, y: 198 },
    { x: 604, y: 160 },
    { x: 608, y: 119 },
    { x: 623, y: 80 },
    { x: 660, y: 60 },
    { x: 702, y: 53 },
    { x: 739, y: 48 },
    { x: 773, y: 44 },
  ],
  "the-foundry": [
    { x: 1137, y: 49 },
    { x: 1179, y: 49 },
    { x: 1219, y: 49 },
    { x: 1260, y: 50 },
    { x: 1308, y: 51 },
    { x: 1360, y: 56 },
    { x: 1412, y: 79 },
    { x: 1459, y: 112 },
    { x: 1499, y: 162 },
    { x: 1525, y: 220 },
    { x: 1502, y: 282 },
    { x: 1442, y: 325 },
    { x: 1379, y: 346 },
    { x: 1330, y: 358 },
    { x: 1296, y: 370 },
    { x: 1264, y: 373 },
    { x: 1236, y: 374 },
    { x: 1212, y: 386 },
    { x: 1183, y: 404 },
    { x: 1147, y: 422 },
    { x: 1102, y: 431 },
    { x: 1026, y: 457 },
    { x: 942, y: 466 },
    { x: 913, y: 403 },
    { x: 953, y: 331 },
    { x: 976, y: 275 },
    { x: 985, y: 231 },
    { x: 994, y: 190 },
    { x: 1005, y: 148 },
    { x: 1022, y: 106 },
    { x: 1048, y: 69 },
    { x: 1091, y: 51 },
  ],
  "hallow-hollow": [
    { x: 1002, y: 597 },
    { x: 1067, y: 599 },
    { x: 1133, y: 636 },
    { x: 1176, y: 650 },
    { x: 1207, y: 677 },
    { x: 1232, y: 701 },
    { x: 1260, y: 706 },
    { x: 1296, y: 706 },
    { x: 1338, y: 711 },
    { x: 1378, y: 732 },
    { x: 1453, y: 751 },
    { x: 1514, y: 798 },
    { x: 1520, y: 861 },
    { x: 1502, y: 922 },
    { x: 1455, y: 968 },
    { x: 1402, y: 999 },
    { x: 1351, y: 1021 },
    { x: 1307, y: 1040 },
    { x: 1262, y: 1056 },
    { x: 1217, y: 1068 },
    { x: 1169, y: 1072 },
    { x: 1121, y: 1068 },
    { x: 1072, y: 1055 },
    { x: 1031, y: 1025 },
    { x: 1016, y: 976 },
    { x: 1009, y: 929 },
    { x: 989, y: 890 },
    { x: 967, y: 850 },
    { x: 952, y: 805 },
    { x: 922, y: 740 },
    { x: 901, y: 673 },
    { x: 948, y: 628 },
  ],
  "the-sawmill-district": [
    { x: 534, y: 670 },
    { x: 645, y: 672 },
    { x: 744, y: 680 },
    { x: 853, y: 698 },
    { x: 922, y: 761 },
    { x: 930, y: 850 },
    { x: 1021, y: 930 },
    { x: 1030, y: 1049 },
    { x: 980, y: 1127 },
    { x: 842, y: 1131 },
    { x: 683, y: 1127 },
    { x: 555, y: 1107 },
    { x: 515, y: 1008 },
    { x: 545, y: 890 },
    { x: 584, y: 791 },
  ],
  "the-hearth": [
    { x: 582, y: 612 },
    { x: 639, y: 634 },
    { x: 681, y: 680 },
    { x: 686, y: 743 },
    { x: 656, y: 803 },
    { x: 619, y: 849 },
    { x: 597, y: 888 },
    { x: 578, y: 923 },
    { x: 562, y: 962 },
    { x: 547, y: 1008 },
    { x: 517, y: 1045 },
    { x: 472, y: 1058 },
    { x: 424, y: 1058 },
    { x: 379, y: 1055 },
    { x: 335, y: 1048 },
    { x: 292, y: 1032 },
    { x: 248, y: 1016 },
    { x: 201, y: 992 },
    { x: 152, y: 961 },
    { x: 104, y: 919 },
    { x: 83, y: 861 },
    { x: 92, y: 798 },
    { x: 152, y: 752 },
    { x: 218, y: 734 },
    { x: 245, y: 701 },
    { x: 280, y: 682 },
    { x: 324, y: 686 },
    { x: 358, y: 689 },
    { x: 387, y: 687 },
    { x: 417, y: 676 },
    { x: 457, y: 652 },
    { x: 513, y: 620 },
  ],
};

function polygonPoints(polygon: string): Point[] {
  return polygon
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return { x, y };
    })
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function smoothLoopPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length < 3) {
    const [first, ...rest] = points;
    return [
      `M ${first.x} ${first.y}`,
      ...rest.map((point) => `L ${point.x} ${point.y}`),
      "Z",
    ].join(" ");
  }

  const tension = 0.24;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length; i++) {
    const p0 = points[(i - 1 + points.length) % points.length];
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const p3 = points[(i + 2) % points.length];
    const c1x = p1.x + (p2.x - p0.x) * tension;
    const c1y = p1.y + (p2.y - p0.y) * tension;
    const c2x = p2.x - (p3.x - p1.x) * tension;
    const c2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return `${d} Z`;
}

function loopForDistrict(district: District, index: number): WallLoop {
  const points = CUSTOM_LOOP_POINTS[district.id] ?? polygonPoints(district.polygon);
  const clockwise = index % 2 === 0;
  const useCustomLoop = district.id in CUSTOM_LOOP_POINTS;
  const path = smoothLoopPath(
    useCustomLoop || clockwise ? points : [...points].reverse(),
  );
  return {
    id: district.id,
    path,
    duration: 22 + index * 2.6,
  };
}

export function DynamicWalls() {
  const loops = DISTRICTS.map(loopForDistrict);

  return (
    <g className="dynamic-walls" aria-hidden="true">
      <defs>
        <mask
          id="willville-wall-pixel-mask"
          maskUnits="userSpaceOnUse"
          x={0}
          y={0}
          width={1600}
          height={1240}
        >
          <image
            href="/art/town/willville-v3-animation-mask.png"
            x={0}
            y={0}
            width={1600}
            height={1240}
            preserveAspectRatio="none"
          />
        </mask>
      </defs>

      <g mask="url(#willville-wall-pixel-mask)">
        <rect
          className="dynamic-wall-source-shadow"
          x={0}
          y={0}
          width={1600}
          height={1240}
        />
        <rect
          className="dynamic-wall-base"
          x={0}
          y={0}
          width={1600}
          height={1240}
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
            >
              <animate
                attributeName="stroke-dashoffset"
                from="0"
                to={`-${WALL_PATH_LENGTH}`}
                dur={`${loop.duration}s`}
                repeatCount="indefinite"
              />
            </path>
            <path
              d={loop.path}
              className="dynamic-wall-loop-stones dynamic-wall-loop-stones-b"
              fill="none"
              pathLength={WALL_PATH_LENGTH}
            >
              <animate
                attributeName="stroke-dashoffset"
                from={`${90 + loopIndex * 9}`}
                to={`${90 + loopIndex * 9 - WALL_PATH_LENGTH}`}
                dur={`${loop.duration * 1.08}s`}
                repeatCount="indefinite"
              />
            </path>
            <path
              d={loop.path}
              className="dynamic-wall-loop-mortar"
              fill="none"
              pathLength={WALL_PATH_LENGTH}
            >
              <animate
                attributeName="stroke-dashoffset"
                from="0"
                to={`-${WALL_PATH_LENGTH}`}
                dur={`${loop.duration}s`}
                repeatCount="indefinite"
              />
            </path>
            <path
              d={loop.path}
              className="dynamic-wall-loop-glints"
              fill="none"
              pathLength={WALL_PATH_LENGTH}
            >
              <animate
                attributeName="stroke-dashoffset"
                from={`${180 - loopIndex * 11}`}
                to={`${180 - loopIndex * 11 + WALL_PATH_LENGTH}`}
                dur={`${loop.duration * 0.72}s`}
                repeatCount="indefinite"
              />
            </path>
          </g>
        ))}
      </g>
    </g>
  );
}
