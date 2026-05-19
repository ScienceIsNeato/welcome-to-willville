import { TOWN, TOWN_OFFSET, WORLD } from "@/lib/willville";

const FIELD_ROWS = [
  "M 0 510 C 280 470 530 500 760 460 C 1040 410 1330 430 1600 470 C 1850 505 2120 470 2400 440 L 2400 1800 L 0 1800 Z",
  "M 0 760 C 300 710 570 760 830 720 C 1110 680 1390 700 1660 750 C 1900 795 2130 760 2400 720 L 2400 1800 L 0 1800 Z",
  "M 0 1040 C 260 995 560 1030 820 990 C 1150 940 1420 985 1680 1045 C 1940 1105 2180 1060 2400 1010 L 2400 1800 L 0 1800 Z",
];

const TREE_CLUMPS = [
  { x: 120, y: 620, s: 0.9 },
  { x: 220, y: 790, s: 1.1 },
  { x: 2100, y: 460, s: 0.75 },
  { x: 2210, y: 570, s: 0.95 },
  { x: 1840, y: 1180, s: 0.85 },
  { x: 340, y: 1310, s: 0.8 },
];

/**
 * Quiet countryside around the town island. The shapes deliberately overlap
 * the town art by a few pixels so panning does not reveal hard color seams.
 */
export function BucolicMargin() {
  const tx = TOWN_OFFSET.x;
  const ty = TOWN_OFFSET.y;
  const tw = TOWN.width;
  const th = TOWN.height;
  const overlap = 10;

  return (
    <g aria-hidden>
      <defs>
        <linearGradient id="country-sky" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#283b6d" />
          <stop offset="48%" stopColor="#426f78" />
          <stop offset="100%" stopColor="#597a5a" />
        </linearGradient>
        <linearGradient id="country-field" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#557d4f" />
          <stop offset="54%" stopColor="#385f43" />
          <stop offset="100%" stopColor="#244631" />
        </linearGradient>
        <linearGradient id="country-field-shadow" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#416f50" stopOpacity="0.78" />
          <stop offset="100%" stopColor="#203b2b" stopOpacity="0.92" />
        </linearGradient>
        <linearGradient id="country-water" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#245f7c" />
          <stop offset="58%" stopColor="#164668" />
          <stop offset="100%" stopColor="#0f304f" />
        </linearGradient>
        <radialGradient id="country-vignette" cx="50%" cy="48%" r="70%">
          <stop offset="55%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#0d0b20" stopOpacity="0.28" />
        </radialGradient>
      </defs>

      <rect width={WORLD.width} height={WORLD.height} fill="url(#country-sky)" />
      <path
        d="M 0 405 C 260 350 500 370 730 330 C 1030 280 1250 335 1510 315 C 1840 288 2110 330 2400 275 L 2400 1800 L 0 1800 Z"
        fill="url(#country-field)"
      />
      {FIELD_ROWS.map((d, index) => (
        <path
          key={d}
          d={d}
          fill={index % 2 === 0 ? "url(#country-field-shadow)" : "#31583d"}
          opacity={0.58 - index * 0.08}
        />
      ))}

      <path
        d={`M ${tx - 240} ${ty + 70} C ${tx - 90} ${ty + 130} ${tx - 42} ${ty + 220} ${tx + overlap} ${ty + 282}`}
        fill="none"
        stroke="#8a7b58"
        strokeWidth={20}
        strokeLinecap="round"
        opacity={0.38}
      />
      <path
        d={`M ${tx + tw + overlap} ${ty + th * 0.71} C ${tx + tw + 150} ${ty + th * 0.78} ${tx + tw + 310} ${ty + th * 0.82} ${WORLD.width} ${ty + th * 0.76} L ${WORLD.width} ${WORLD.height} L ${tx + tw - overlap} ${WORLD.height} Z`}
        fill="url(#country-water)"
        opacity={0.92}
      />
      <path
        d={`M ${tx + tw - overlap} ${ty + th * 0.7} C ${tx + tw + 130} ${ty + th * 0.76} ${tx + tw + 310} ${ty + th * 0.78} ${WORLD.width} ${ty + th * 0.7}`}
        fill="none"
        stroke="#3e8aad"
        strokeWidth={3}
        opacity={0.42}
      />

      <path
        d={`M ${tx - 260} ${ty + th * 0.63} C ${tx - 100} ${ty + th * 0.58} ${tx - 40} ${ty + th * 0.68} ${tx + overlap} ${ty + th * 0.78}`}
        fill="none"
        stroke="#274f3a"
        strokeWidth={90}
        strokeLinecap="round"
        opacity={0.55}
      />
      <path
        d={`M ${tx - 220} ${ty + th + 30} C ${tx + 50} ${ty + th + 120} ${tx + 280} ${ty + th + 115} ${tx + 520} ${ty + th + 35} C ${tx + 760} ${ty + th - 45} ${tx + 1060} ${ty + th + 30} ${tx + tw + 120} ${ty + th + 135}`}
        fill="none"
        stroke="#6c8f5f"
        strokeWidth={135}
        strokeLinecap="round"
        opacity={0.36}
      />

      {TREE_CLUMPS.map((tree, index) => (
        <g key={`${tree.x}-${tree.y}`} transform={`translate(${tree.x} ${tree.y}) scale(${tree.s})`}>
          <ellipse cx={0} cy={18} rx={34} ry={42} fill="#1e3e2b" opacity={0.86} />
          <ellipse cx={-24} cy={30} rx={25} ry={36} fill="#244b33" opacity={0.8} />
          <ellipse cx={26} cy={34} rx={28} ry={38} fill="#183625" opacity={0.72} />
          <rect x={-5} y={48} width={10} height={38} rx={4} fill="#4c3a25" opacity={0.72} />
          {index < 2 && (
            <ellipse cx={12} cy={-6} rx={22} ry={24} fill="#2b563a" opacity={0.62} />
          )}
        </g>
      ))}

      <rect
        x={tx - overlap}
        y={ty - overlap}
        width={tw + overlap * 2}
        height={th + overlap * 2}
        fill="none"
        stroke="#315447"
        strokeWidth={overlap * 2}
        opacity={0.18}
      />
      <rect width={WORLD.width} height={WORLD.height} fill="url(#country-vignette)" />
    </g>
  );
}
