"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { activeQueue, mostActiveStops, type Stop } from "@/lib/town";
import { DISTRICTS } from "@/lib/willville";
import {
  alphaColor,
  isNumberedRow,
  normalizeBoardText as normalize,
  stopLabel,
} from "./boardUtils";

const MOBILE_BOARD_COLUMNS = 24;
const MOBILE_BOARD_ROWS = 8;
const ROW_DELAY_MS = 42;
const COLUMN_DELAY_MS = 14;

type Props = {
  stops: Stop[];
  selectedStop?: Stop | null;
  activeDistrict?: string | null;
  announcementRows?: string[] | null;
  announcementLabel?: string;
  panelOpacity?: number;
};

export function MobileCentralBoard({
  stops,
  selectedStop,
  activeDistrict,
  announcementRows,
  announcementLabel,
  panelOpacity = 1,
}: Props) {
  const queue = useMemo(() => {
    const active = mostActiveStops(stops);
    return active.length > 0 ? active : activeQueue(stops);
  }, [stops]);

  const rows = useMemo(() => {
    if (announcementRows && announcementRows.length > 0) {
      return normalizeRows(announcementRows);
    }
    if (selectedStop) {
      return selectedStopRows(selectedStop);
    }
    if (activeDistrict) {
      return districtRows(activeDistrict, stops);
    }
    return timetableRows(queue);
  }, [activeDistrict, announcementRows, queue, selectedStop, stops]);

  const selectedKey = announcementRows?.length
    ? `announcement-${announcementLabel ?? "status"}-${announcementRows.join("|")}`
    : selectedStop
      ? `stop-${selectedStop.district}-${selectedStop.id}`
      : activeDistrict
        ? `district-${activeDistrict}`
        : "timetable";

  const splitFlapCellCss = splitFlapCellStyles(panelOpacity);

  return (
    <section
      className="mobile-central-split-flap"
      aria-label="Time Central Station mobile split-flap board"
      style={shellStyle}
    >
      <div style={headerStyle(panelOpacity)}>
        <span>Time Central</span>
        <span>
          {announcementRows?.length
            ? (announcementLabel ?? "Status Update")
            : activeDistrict
              ? "Local"
              : "Express"}
        </span>
      </div>

      <div style={boardStyle(panelOpacity)}>
        {rows.map((row, rowIndex) => (
          <SplitFlapRow
            key={rowIndex}
            row={row}
            rowIndex={rowIndex}
            boardKey={selectedKey}
            panelOpacity={panelOpacity}
          />
        ))}
      </div>

      <style>{splitFlapCellCss}</style>
    </section>
  );
}

function splitFlapCellStyles(panelOpacity: number): string {
  const topGlow = alphaColor(255, 255, 255, panelOpacity * 0.08);
  const topBorder = alphaColor(255, 255, 255, panelOpacity * 0.055);
  const cellShadow = alphaColor(255, 255, 255, panelOpacity * 0.08);
  const cellBackground = alphaColor(23, 23, 23, panelOpacity);

  return `
        .mobile-central-split-flap .split-flap-cell {
          filter: brightness(0.94);
        }

        .mobile-central-split-flap .split-flap-cell::before,
        .mobile-central-split-flap .split-flap-cell::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          height: calc(50% - 1px);
          background:
            linear-gradient(180deg, ${topGlow}, rgba(255, 255, 255, 0)),
            ${cellBackground};
          border: 1px solid ${topBorder};
          box-shadow: inset 0 1px 0 ${cellShadow};
          z-index: 0;
        }

        .mobile-central-split-flap .split-flap-cell::before {
          top: 0;
          border-radius: 2px 2px 1px 1px;
          transform-origin: bottom;
        }

        .mobile-central-split-flap .split-flap-cell::after {
          bottom: 0;
          border-radius: 1px 1px 2px 2px;
          transform-origin: top;
        }

        .mobile-central-split-flap .split-flap-cell[data-flipping="true"] {
          animation: mobile-split-flap-pop 420ms cubic-bezier(.2, .72, .18, 1);
        }

        .mobile-central-split-flap .split-flap-cell[data-flipping="true"]::before {
          animation: mobile-split-flap-top 420ms cubic-bezier(.2, .72, .18, 1);
        }

        .mobile-central-split-flap .split-flap-cell[data-flipping="true"]::after {
          animation: mobile-split-flap-bottom 420ms cubic-bezier(.2, .72, .18, 1);
        }

        @keyframes mobile-split-flap-pop {
          0% { filter: brightness(0.58); }
          55% { filter: brightness(1.28); }
          100% { filter: brightness(1); }
        }

        @keyframes mobile-split-flap-top {
          0% { transform: rotateX(0deg); }
          45% { transform: rotateX(-82deg); }
          100% { transform: rotateX(0deg); }
        }

        @keyframes mobile-split-flap-bottom {
          0%, 40% { transform: rotateX(76deg); }
          100% { transform: rotateX(0deg); }
        }
      `;
}

function SplitFlapRow({
  row,
  rowIndex,
  boardKey,
  panelOpacity,
}: {
  row: string;
  rowIndex: number;
  boardKey: string;
  panelOpacity: number;
}) {
  const chars = padRenderedRow(row).split("");

  return (
    <div
      style={{
        ...rowStyle,
        gridTemplateColumns: `repeat(${MOBILE_BOARD_COLUMNS}, minmax(0, 1fr))`,
      }}
    >
      {chars.map((char, index) => (
        <SplitFlapCell
          key={index}
          char={char}
          index={index}
          rowIndex={rowIndex}
          boardKey={boardKey}
          panelOpacity={panelOpacity}
        />
      ))}
    </div>
  );
}

function SplitFlapCell({
  char,
  index,
  rowIndex,
  boardKey,
  panelOpacity,
}: {
  char: string;
  index: number;
  rowIndex: number;
  boardKey: string;
  panelOpacity: number;
}) {
  const [displayChar, setDisplayChar] = useState(char);
  const [isFlipping, setIsFlipping] = useState(false);
  const previousCharRef = useRef<string | null>(null);

  useEffect(() => {
    if (previousCharRef.current !== null && previousCharRef.current === char) {
      return;
    }
    previousCharRef.current = char;

    const delay =
      rowIndex * ROW_DELAY_MS +
      (index % MOBILE_BOARD_COLUMNS) * COLUMN_DELAY_MS;
    let swap = 0;
    let finish = 0;
    const start = window.setTimeout(() => {
      setIsFlipping(true);
      swap = window.setTimeout(() => setDisplayChar(char), 160);
      finish = window.setTimeout(() => setIsFlipping(false), 380);
    }, delay);

    return () => {
      window.clearTimeout(start);
      window.clearTimeout(swap);
      window.clearTimeout(finish);
    };
  }, [boardKey, char, index, rowIndex]);

  const visible = displayChar !== " ";
  const delay =
    rowIndex * ROW_DELAY_MS + (index % MOBILE_BOARD_COLUMNS) * COLUMN_DELAY_MS;

  return (
    <span
      className="split-flap-cell"
      data-filled={visible}
      data-flipping={isFlipping}
      style={{
        ...cellStyle(panelOpacity),
        transitionDelay: `${delay}ms`,
      }}
      aria-hidden={!visible}
    >
      <span style={characterStyle}>{visible ? displayChar : ""}</span>
      <span style={creaseStyle(panelOpacity)} />
    </span>
  );
}

function selectedStopRows(stop: Stop): string[] {
  const district = DISTRICTS.find((entry) => entry.id === stop.district);
  const districtName = district?.displayName ?? stop.district;
  const commits = stop.commits7d ?? stop.commits3d ?? 0;
  const prs = stop.openPrCount ?? 0;
  const state = (stop.status.state || "active").toUpperCase();

  return fillRows([
    formatBoardRow(districtName, "center"),
    formatBoardRow(stopLabel(stop), "center"),
    formatBoardRow(`${state} ${prs} PR ${commits}C`, "center"),
    formatBoardRow("PULL UP FOR DETAILS", "center"),
  ]);
}

function districtRows(districtId: string, stops: Stop[]): string[] {
  const district = DISTRICTS.find((entry) => entry.id === districtId);
  const districtName = district?.displayName ?? districtId;
  const sorted = [...stops.filter((stop) => stop.district === districtId)].sort(
    (a, b) => {
      const starsA = a.stars ?? 0;
      const starsB = b.stars ?? 0;
      if (starsA !== starsB) return starsB - starsA;
      const commitsA = a.commits7d ?? 0;
      const commitsB = b.commits7d ?? 0;
      if (commitsA !== commitsB) return commitsB - commitsA;
      return a.displayName.localeCompare(b.displayName);
    },
  );

  return fillRows([
    formatBoardRow(districtName, "center"),
    formatBoardRow("TAP A SITE", "center"),
    compactQueueRow(sorted[0], 1),
    compactQueueRow(sorted[1], 2),
  ]);
}

function timetableRows(queue: Stop[]): string[] {
  return fillRows([
    formatBoardRow("TIME CENTRAL", "center"),
    formatBoardRow("TAP A SITE", "center"),
    compactQueueRow(queue[0], 1),
    compactQueueRow(queue[1], 2),
  ]);
}

function compactQueueRow(stop: Stop | undefined, index: number): string {
  if (!stop) {
    return formatBoardRow("WATCH THE LAMPS", "center");
  }

  const signal =
    stop.stars && stop.stars > 0
      ? `${stop.stars}*`
      : `${stop.commits7d ?? stop.commits3d ?? 0}C`;
  return formatBoardRow(
    `${String(index).padStart(2, "0")} ${stopLabel(stop)} ${signal}`,
    "left",
  );
}

function normalizeRows(rows: string[]): string[] {
  const normalized = rows
    .slice(0, MOBILE_BOARD_ROWS)
    .map((row) => formatBoardRow(row, isNumberedRow(row) ? "left" : "center"));
  return fillRows(normalized);
}

function fillRows(rows: string[]): string[] {
  const nextRows = rows.slice(0, MOBILE_BOARD_ROWS);
  while (nextRows.length < MOBILE_BOARD_ROWS) {
    nextRows.push(emptyRow());
  }
  return nextRows;
}

function emptyRow(): string {
  return " ".repeat(MOBILE_BOARD_COLUMNS);
}

function padRenderedRow(input: string): string {
  if (input.length >= MOBILE_BOARD_COLUMNS) {
    return input.slice(0, MOBILE_BOARD_COLUMNS);
  }
  return input.padEnd(MOBILE_BOARD_COLUMNS, " ");
}

function formatBoardRow(
  input: string,
  align: "left" | "center" = "center",
): string {
  const normalized = normalize(input);
  const trimmed =
    normalized.length > MOBILE_BOARD_COLUMNS
      ? `${normalized.slice(0, MOBILE_BOARD_COLUMNS - 1)}…`
      : normalized;

  if (align === "left") {
    return trimmed.padEnd(MOBILE_BOARD_COLUMNS, " ");
  }

  const left = Math.max(
    0,
    Math.floor((MOBILE_BOARD_COLUMNS - trimmed.length) / 2),
  );
  return `${" ".repeat(left)}${trimmed}`.padEnd(MOBILE_BOARD_COLUMNS, " ");
}

const shellStyle: CSSProperties = {
  position: "relative",
  zIndex: 2,
  width: "100%",
  color: "var(--willville-paper)",
  fontFamily: "var(--font-geist-mono), monospace",
  filter: "drop-shadow(0 14px 24px rgba(0,0,0,0.42))",
  pointerEvents: "auto",
  perspective: 760,
};

function headerStyle(panelOpacity: number): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "center",
    gap: 10,
    padding: "8px 92px 7px 12px",
    background: `linear-gradient(180deg, ${alphaColor(26, 26, 26, panelOpacity)} 0%, ${alphaColor(7, 7, 7, panelOpacity)} 100%)`,
    border: `1px solid ${alphaColor(245, 230, 200, panelOpacity * 0.18)}`,
    borderBottom: 0,
    borderRadius: "12px 12px 0 0",
    color: "#f1e7ce",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 1.3,
    textTransform: "uppercase",
  };
}

function boardStyle(panelOpacity: number): CSSProperties {
  return {
    display: "grid",
    gridTemplateRows: `repeat(${MOBILE_BOARD_ROWS}, minmax(0, 1fr))`,
    gap: 1.5,
    padding: 3,
    background: `linear-gradient(180deg, ${alphaColor(15, 15, 15, panelOpacity * 0.99)} 0%, ${alphaColor(3, 3, 3, panelOpacity * 0.99)} 100%)`,
    border: `1px solid ${alphaColor(245, 230, 200, panelOpacity * 0.18)}`,
    borderRadius: "0 0 12px 12px",
    boxShadow: `inset 0 1px 0 ${alphaColor(255, 255, 255, panelOpacity * 0.06)}, inset 0 -18px 40px ${alphaColor(0, 0, 0, panelOpacity * 0.75)}`,
  };
}

const rowStyle: CSSProperties = {
  display: "grid",
  gap: 1.5,
  width: "100%",
  minWidth: 0,
};

function cellStyle(panelOpacity: number): CSSProperties {
  return {
    position: "relative",
    aspectRatio: "0.88 / 1",
    minWidth: 0,
    display: "grid",
    placeItems: "center",
    background: alphaColor(9, 9, 9, panelOpacity),
    borderRadius: 2,
    boxShadow: `inset 0 0 0 1px ${alphaColor(255, 255, 255, panelOpacity * 0.04)}, 0 1px 0 ${alphaColor(255, 255, 255, panelOpacity * 0.04)}`,
    overflow: "hidden",
    transformStyle: "preserve-3d",
  };
}

const characterStyle: CSSProperties = {
  position: "relative",
  zIndex: 4,
  color: "#f6f0de",
  fontSize: "clamp(10px, 2.7vw, 15px)",
  fontWeight: 900,
  lineHeight: 0.82,
  letterSpacing: 0,
  textShadow: "0 1px 0 #000",
  transform: "none",
};

function creaseStyle(panelOpacity: number): CSSProperties {
  return {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    height: 1,
    transform: "translateY(-50%)",
    zIndex: 2,
    background: alphaColor(0, 0, 0, panelOpacity * 0.45),
    boxShadow: `0 -1px 0 ${alphaColor(255, 255, 255, panelOpacity * 0.06)}`,
  };
}
