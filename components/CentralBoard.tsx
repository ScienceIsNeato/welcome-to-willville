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
import { makeNoiseBuffer } from "@/lib/audio-noise";
import {
  isNumberedRow,
  normalizeBoardText as normalize,
  stopLabel,
} from "./boardUtils";
import { BOARD_COLUMNS, BOARD_ROWS, EMPTY_ROW } from "./centralBoardConstants";

type Props = {
  stops: Stop[];
  selectedStop?: Stop | null;
  activeDistrict?: string | null;
  onSelectStop: (stop: Stop) => void;
  announcementRows?: string[] | null;
  announcementLabel?: string;
  panelOpacity?: number;
};

export function CentralBoard({
  stops,
  selectedStop,
  activeDistrict,
  onSelectStop,
  announcementRows,
  announcementLabel,
  panelOpacity = 1,
}: Props) {
  const didMountRef = useRef(false);
  const previousBoardRef = useRef<string[]>([]);

  // Fall back to heuristics-based activeQueue until commit data arrives.
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
  }, [announcementRows, selectedStop, activeDistrict, queue, stops]);

  const selectedKey = announcementRows?.length
    ? `announcement-${announcementLabel ?? "status"}-${announcementRows.join("|")}`
    : selectedStop
      ? `stop-${selectedStop.district}-${selectedStop.id}`
      : activeDistrict
        ? `district-${activeDistrict}`
        : "timetable";

  useEffect(() => {
    const previous = previousBoardRef.current;
    if (didMountRef.current) {
      if (userHasInteracted) {
        playFlipTicks(previous, rows);
      } else {
        // Stash so first user gesture can replay the flip sound
        pendingFlip = { prev: previous, next: rows };
      }
    }
    previousBoardRef.current = rows;
    didMountRef.current = true;
  }, [rows]);

  const buttonsToDisplay = useMemo(() => {
    if (announcementRows && announcementRows.length > 0) {
      return [];
    }
    if (activeDistrict) {
      const dbStops = stops.filter((s) => s.district === activeDistrict);
      return [...dbStops]
        .sort((a, b) => {
          const starsA = a.stars ?? 0;
          const starsB = b.stars ?? 0;
          if (starsA !== starsB) return starsB - starsA;
          const commitsA = a.commits7d ?? 0;
          const commitsB = b.commits7d ?? 0;
          if (commitsA !== commitsB) return commitsB - commitsA;
          return a.displayName.localeCompare(b.displayName);
        })
        .slice(0, 6);
    }
    return queue.slice(0, 6);
  }, [announcementRows, activeDistrict, stops, queue]);

  return (
    <section
      className="central-split-flap"
      aria-label="Time Central Station split-flap board"
      style={
        {
          ...shellStyle,
          "--panel-opacity": String(panelOpacity),
        } as CSSProperties
      }
    >
      <div style={headerStyle}>
        <span>Time Central Station</span>
        <span>
          {announcementRows?.length
            ? (announcementLabel ?? "Status Update")
            : activeDistrict
              ? "Local Metro"
              : "Mayor's Express"}
        </span>
      </div>

      <div style={boardStyle}>
        {rows.map((row, rowIndex) => (
          <SplitFlapRow
            key={rowIndex}
            row={row}
            rowIndex={rowIndex}
            boardKey={selectedKey}
          />
        ))}
      </div>

      {buttonsToDisplay.length > 0 && (
        <div
          style={queueButtonsStyle}
          aria-label={
            activeDistrict ? "Local district stops" : "Mayor's Express stops"
          }
        >
          {buttonsToDisplay.map((stop, index) => (
            <button
              key={`${stop.district}-${stop.id}`}
              type="button"
              data-central-board-button
              data-stop-id={stop.id}
              aria-label={`Open ${stopLabel(stop)}`}
              onClick={(e) => {
                e.stopPropagation();
                playButtonTick();
                onSelectStop(stop);
              }}
              style={queueButtonStyle}
            >
              {String(index + 1).padStart(2, "0")}
            </button>
          ))}
        </div>
      )}

      <style>{`
        .central-split-flap .split-flap-cell {
          filter: brightness(0.92);
        }

        .central-split-flap .split-flap-cell::before,
        .central-split-flap .split-flap-cell::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          height: calc(50% - 1px);
          background:
            linear-gradient(180deg, rgb(255 255 255 / calc(0.08 * var(--panel-opacity, 1))), rgb(255 255 255 / 0)),
            rgb(23 23 23 / var(--panel-opacity, 1));
          border: 1px solid rgb(255 255 255 / calc(0.055 * var(--panel-opacity, 1)));
          box-shadow: inset 0 1px 0 rgb(255 255 255 / calc(0.08 * var(--panel-opacity, 1)));
          z-index: 0;
        }

        .central-split-flap .split-flap-cell::before {
          top: 0;
          border-radius: 3px 3px 1px 1px;
          transform-origin: bottom;
        }

        .central-split-flap .split-flap-cell::after {
          bottom: 0;
          border-radius: 1px 1px 3px 3px;
          transform-origin: top;
        }

        .central-split-flap .split-flap-cell[data-flipping="true"] {
          animation: split-flap-pop 460ms cubic-bezier(.2, .72, .18, 1);
        }

        .central-split-flap .split-flap-cell[data-flipping="true"]::before {
          animation: split-flap-top 460ms cubic-bezier(.2, .72, .18, 1);
        }

        .central-split-flap .split-flap-cell[data-flipping="true"]::after {
          animation: split-flap-bottom 460ms cubic-bezier(.2, .72, .18, 1);
        }

        @keyframes split-flap-pop {
          0% { filter: brightness(0.55); }
          55% { filter: brightness(1.35); }
          100% { filter: brightness(1); }
        }

        @keyframes split-flap-top {
          0% { transform: rotateX(0deg); }
          45% { transform: rotateX(-82deg); }
          100% { transform: rotateX(0deg); }
        }

        @keyframes split-flap-bottom {
          0%, 40% { transform: rotateX(76deg); }
          100% { transform: rotateX(0deg); }
        }
      `}</style>
    </section>
  );
}

function normalizeRows(rows: string[]): string[] {
  const normalized = rows
    .slice(0, BOARD_ROWS)
    .map((row) => formatBoardRow(row, isNumberedRow(row) ? "left" : "center"));
  while (normalized.length < BOARD_ROWS) {
    normalized.push(EMPTY_ROW);
  }
  return normalized;
}

function SplitFlapRow({
  row,
  rowIndex,
  boardKey,
}: {
  row: string;
  rowIndex: number;
  boardKey: string;
}) {
  const chars = padRenderedRow(row).split("");
  return (
    <div
      style={{
        ...rowStyle,
        gridTemplateColumns: `repeat(${BOARD_COLUMNS}, minmax(0, 1fr))`,
      }}
    >
      {chars.map((char, index) => (
        <SplitFlapCell
          key={index}
          char={char}
          index={index}
          rowIndex={rowIndex}
          boardKey={boardKey}
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
}: {
  char: string;
  index: number;
  rowIndex: number;
  boardKey: string;
}) {
  const [displayChar, setDisplayChar] = useState(char);
  const [isFlipping, setIsFlipping] = useState(false);
  const prevCharRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevCharRef.current !== null && prevCharRef.current === char) {
      return;
    }
    prevCharRef.current = char;

    const delay = rowIndex * 58 + (index % BOARD_COLUMNS) * 18;
    let swap = 0;
    let finish = 0;
    const start = window.setTimeout(() => {
      setIsFlipping(true);
      swap = window.setTimeout(() => setDisplayChar(char), 180);
      finish = window.setTimeout(() => setIsFlipping(false), 420);
    }, delay);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(swap);
      window.clearTimeout(finish);
    };
  }, [boardKey, char, index, rowIndex]);

  const visible = displayChar !== " ";
  return (
    <span
      className="split-flap-cell"
      data-filled={visible}
      data-flipping={isFlipping}
      style={{
        ...cellStyle,
        transitionDelay: `${rowIndex * 58 + (index % BOARD_COLUMNS) * 18}ms`,
      }}
      aria-hidden={!visible}
    >
      <span style={characterStyle}>{visible ? displayChar : ""}</span>
      <span style={creaseStyle} />
    </span>
  );
}

function wrapText(text: string, maxLen: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (!word) continue;
    if (
      currentLine.length + word.length + (currentLine.length > 0 ? 1 : 0) <=
      maxLen
    ) {
      currentLine += (currentLine.length > 0 ? " " : "") + word;
    } else {
      if (currentLine) lines.push(currentLine);
      if (word.length > maxLen) {
        lines.push(word.slice(0, maxLen));
        currentLine = "";
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function selectedStopRows(stop: Stop): string[] {
  const district = DISTRICTS.find((d) => d.id === stop.district);
  const districtName = district?.displayName ?? stop.district;
  const stopName = stopLabel(stop);
  const descText = stop.status.summary ?? stop.blurb ?? "";

  const rows: string[] = [
    formatBoardRow(districtName, "center"),
    formatBoardRow(stopName, "center"),
  ];

  const wrapped = wrapText(descText, BOARD_COLUMNS);
  for (let i = 0; i < 4; i += 1) {
    const line = wrapped[i] ?? "";
    rows.push(formatBoardRow(line, "center"));
  }

  return rows.slice(0, BOARD_ROWS);
}

function commitSummary(stop: Stop): string {
  const c3 = stop.commits3d ?? 0;
  const c7 = stop.commits7d ?? 0;
  const c21 = stop.commits21d ?? 0;
  if (c3 + c7 + c21 > 0) return `${c3}/${c7}/${c21}`;
  if (stop.stars && stop.stars > 0) return `${stop.stars}*`;
  return (stop.status.state || "IDEA").toUpperCase();
}

function districtRows(districtId: string, stops: Stop[]): string[] {
  const district = DISTRICTS.find((d) => d.id === districtId);
  const districtName = district?.displayName ?? districtId;
  const subtitle = district?.subtitle;

  const rows: string[] = [
    formatBoardRow(districtName, "center"),
    formatBoardRow(subtitle ?? "LOCAL DEPARTURES", "center"),
  ];

  const dbStops = stops.filter((s) => s.district === districtId);
  const sorted = [...dbStops].sort((a, b) => {
    const starsA = a.stars ?? 0;
    const starsB = b.stars ?? 0;
    if (starsA !== starsB) return starsB - starsA;
    const commitsA = a.commits7d ?? 0;
    const commitsB = b.commits7d ?? 0;
    if (commitsA !== commitsB) return commitsB - commitsA;
    return a.displayName.localeCompare(b.displayName);
  });

  for (let i = 0; i < 4; i += 1) {
    const stop = sorted[i];
    if (!stop) {
      rows.push(EMPTY_ROW);
      continue;
    }

    const leftPart = `${String(i + 1).padStart(2, "0")} ${stopLabel(stop)}`;
    const rightPart = commitSummary(stop);

    let rowStr = "";
    if (leftPart.length + 1 + rightPart.length <= BOARD_COLUMNS) {
      const spaces = BOARD_COLUMNS - leftPart.length - rightPart.length;
      rowStr = leftPart + " ".repeat(spaces) + rightPart;
    } else {
      const maxNameLen = BOARD_COLUMNS - 3 - rightPart.length - 2;
      const nameSlice = stopLabel(stop).slice(0, Math.max(1, maxNameLen));
      const truncatedName =
        nameSlice + (stopLabel(stop).length > maxNameLen ? "…" : "");
      const truncatedLeft = `${String(i + 1).padStart(2, "0")} ${truncatedName}`;
      const spaces = Math.max(
        1,
        BOARD_COLUMNS - truncatedLeft.length - rightPart.length,
      );
      rowStr = truncatedLeft + " ".repeat(spaces) + rightPart;
    }
    rows.push(padRenderedRow(rowStr.toUpperCase()));
  }

  return rows.slice(0, BOARD_ROWS);
}

function timetableRows(queue: Stop[]): string[] {
  const rows = [
    formatBoardRow("TIME CENTRAL STATION", "center"),
    formatBoardRow("MAYOR'S EXPRESS", "center"),
  ];

  const departures = queue.slice(0, 4);
  for (let i = 0; i < 4; i += 1) {
    const stop = departures[i];
    if (!stop) {
      rows.push(EMPTY_ROW);
      continue;
    }
    const activity = commitSummary(stop);
    rows.push(
      formatBoardRow(
        `${String(i + 1).padStart(2, "0")} ${stopLabel(stop)} ${activity}`,
        "left",
      ),
    );
  }

  return rows.slice(0, BOARD_ROWS);
}

function padRenderedRow(input: string): string {
  if (input.length >= BOARD_COLUMNS) {
    return input.slice(0, BOARD_COLUMNS);
  }
  return input.padEnd(BOARD_COLUMNS, " ");
}

function formatBoardRow(
  input: string,
  align: "left" | "center" = "center",
): string {
  const normalized = normalize(input);
  const trimmed =
    normalized.length > BOARD_COLUMNS
      ? `${normalized.slice(0, BOARD_COLUMNS - 1)}…`
      : normalized;
  if (align === "left") {
    return trimmed.padEnd(BOARD_COLUMNS, " ");
  }
  const left = Math.max(0, Math.floor((BOARD_COLUMNS - trimmed.length) / 2));
  return `${" ".repeat(left)}${trimmed}`.padEnd(BOARD_COLUMNS, " ");
}

let audioCtx: AudioContext | null = null;
let userHasInteracted = false;
let pendingFlip: { prev: string[]; next: string[] } | null = null;

function onFirstInteraction() {
  if (userHasInteracted) return;
  userHasInteracted = true;
  window.removeEventListener("click", onFirstInteraction, true);
  window.removeEventListener("keydown", onFirstInteraction, true);
  window.removeEventListener("pointerdown", onFirstInteraction, true);
  // Replay the initial board flip sound that was blocked on load
  if (pendingFlip) {
    const { prev, next } = pendingFlip;
    pendingFlip = null;
    playFlipTicks(prev, next);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("click", onFirstInteraction, true);
  window.addEventListener("keydown", onFirstInteraction, true);
  window.addEventListener("pointerdown", onFirstInteraction, true);
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined" || !userHasInteracted) return null;
  try {
    type AudioCtxCtor = typeof AudioContext;
    const Ctor: AudioCtxCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: AudioCtxCtor })
        .webkitAudioContext;
    audioCtx ??= new Ctor();
    void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function playButtonTick() {
  const ctx = getAudioContext();
  if (!ctx) return;
  schedulePaperShuffle(ctx, ctx.currentTime, 0.09, 0.24);
}

function playFlipTicks(previousRows: string[], nextRows: string[]) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const changes: number[] = [];
  nextRows.forEach((row, rowIndex) => {
    const previous = padRenderedRow(previousRows[rowIndex] ?? "");
    const next = padRenderedRow(row);
    for (let i = 0; i < BOARD_COLUMNS; i += 1) {
      if (next[i] !== " " && next[i] !== previous[i]) {
        changes.push(rowIndex * BOARD_COLUMNS + i);
      }
    }
  });

  if (changes.length === 0) return;

  const now = ctx.currentTime;
  scheduleRustleBed(ctx, now, 1, Math.min(0.2, 0.08 + changes.length * 0.001));

  changes.slice(0, 80).forEach((slotIndex) => {
    const rowIndex = Math.floor(slotIndex / BOARD_COLUMNS);
    const colIndex = slotIndex % BOARD_COLUMNS;
    const time = now + Math.min(0.86, rowIndex * 0.09 + colIndex * 0.019);
    const gain = 0.018 + ((rowIndex + colIndex) % 4) * 0.004;
    schedulePaperShuffle(
      ctx,
      time,
      gain,
      0.32 + ((rowIndex + colIndex) % 3) * 0.06,
    );
  });
}

function scheduleRustleBed(
  ctx: AudioContext,
  time: number,
  duration: number,
  gainLevel: number,
) {
  const buffer = makeNoiseBuffer(
    ctx,
    duration,
    (progress) => {
      const attack = Math.min(1, progress / 0.18);
      const release = Math.min(1, (1 - progress) / 0.35);
      const slowWave = 0.58 + Math.sin(progress * Math.PI * 6) * 0.18;
      return Math.max(0, Math.min(1, attack, release)) * slowWave;
    },
    { smoothing: 0.72, randomWeight: 0.28, level: 0.62 },
  );

  const source = ctx.createBufferSource();
  const hush = ctx.createBiquadFilter();
  const air = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  source.buffer = buffer;
  hush.type = "lowpass";
  hush.frequency.setValueAtTime(5200, time);
  hush.Q.setValueAtTime(0.35, time);
  air.type = "bandpass";
  air.frequency.setValueAtTime(2100, time);
  air.Q.setValueAtTime(0.55, time);

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(gainLevel, time + 0.18);
  gain.gain.linearRampToValueAtTime(gainLevel * 0.72, time + 0.62);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  source.connect(hush);
  hush.connect(air);
  air.connect(gain);
  gain.connect(ctx.destination);
  source.start(time);
  source.stop(time + duration);
}

function schedulePaperShuffle(
  ctx: AudioContext,
  time: number,
  gainLevel: number,
  duration: number,
) {
  const buffer = makeNoiseBuffer(
    ctx,
    duration,
    (progress) => {
      const attack = Math.min(1, progress / 0.08);
      const release = Math.pow(Math.max(0, 1 - progress), 2.2);
      const fibers = 0.7 + Math.random() * 0.3;
      return attack * release * fibers;
    },
    { smoothing: 0.72, randomWeight: 0.28, level: 0.62 },
  );

  const source = ctx.createBufferSource();
  const paper = ctx.createBiquadFilter();
  const hush = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  source.buffer = buffer;

  paper.type = "bandpass";
  paper.frequency.setValueAtTime(1500 + Math.random() * 850, time);
  paper.Q.setValueAtTime(0.45, time);

  hush.type = "lowpass";
  hush.frequency.setValueAtTime(3800 + Math.random() * 900, time);
  hush.Q.setValueAtTime(0.5, time);

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(gainLevel, time + 0.055);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  source.connect(paper);
  paper.connect(hush);
  hush.connect(gain);
  gain.connect(ctx.destination);
  source.start(time);
  source.stop(time + duration);
}

const shellStyle: CSSProperties = {
  position: "relative",
  zIndex: 2,
  width: "calc(100vw - 20px)",
  margin: "10px auto 0",
  color: "var(--willville-paper)",
  fontFamily: "var(--font-geist-mono), monospace",
  filter: "drop-shadow(0 22px 40px rgba(0,0,0,0.58))",
  pointerEvents: "auto",
  perspective: 760,
};

const headerStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  alignItems: "center",
  gap: 14,
  padding: "8px 92px 8px 16px",
  background:
    "linear-gradient(180deg, rgb(26 26 26 / var(--panel-opacity, 1)) 0%, rgb(7 7 7 / var(--panel-opacity, 1)) 100%)",
  border: "1px solid rgb(245 230 200 / calc(0.18 * var(--panel-opacity, 1)))",
  borderBottom: 0,
  borderRadius: "5px 5px 0 0",
  color: "#f1e7ce",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 1.8,
  textTransform: "uppercase",
};

const boardStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: `repeat(${BOARD_ROWS}, minmax(0, 1fr))`,
  gap: 2,
  padding: 4,
  background:
    "linear-gradient(180deg, rgb(15 15 15 / calc(0.99 * var(--panel-opacity, 1))) 0%, rgb(3 3 3 / calc(0.99 * var(--panel-opacity, 1))) 100%)",
  border: "1px solid rgb(245 230 200 / calc(0.18 * var(--panel-opacity, 1)))",
  borderRadius: "0 0 5px 5px",
  boxShadow:
    "inset 0 1px 0 rgb(255 255 255 / calc(0.06 * var(--panel-opacity, 1))), inset 0 -18px 40px rgb(0 0 0 / calc(0.75 * var(--panel-opacity, 1)))",
};

const rowStyle: CSSProperties = {
  display: "grid",
  gap: 2,
  width: "100%",
  minWidth: 0,
};

const cellStyle: CSSProperties = {
  position: "relative",
  aspectRatio: "0.82 / 1",
  minWidth: 0,
  display: "grid",
  placeItems: "center",
  background: "rgb(9 9 9 / var(--panel-opacity, 1))",
  borderRadius: 3,
  boxShadow:
    "inset 0 0 0 1px rgb(255 255 255 / calc(0.04 * var(--panel-opacity, 1))), 0 1px 0 rgb(255 255 255 / calc(0.04 * var(--panel-opacity, 1)))",
  overflow: "hidden",
  transformStyle: "preserve-3d",
};

const characterStyle: CSSProperties = {
  position: "relative",
  zIndex: 4,
  color: "#f6f0de",
  fontSize: "clamp(15px, 1.95vw, 25px)",
  fontWeight: 900,
  lineHeight: 0.82,
  letterSpacing: 0,
  textShadow: "0 1px 0 #000",
  transform: "none",
};

const creaseStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  top: "50%",
  height: 1,
  transform: "translateY(-50%)",
  zIndex: 2,
  background: "rgb(0 0 0 / calc(0.45 * var(--panel-opacity, 1)))",
  boxShadow: "0 -1px 0 rgb(255 255 255 / calc(0.06 * var(--panel-opacity, 1)))",
};

const queueButtonsStyle: CSSProperties = {
  position: "absolute",
  right: 16,
  bottom: 14,
  display: "flex",
  gap: 6,
  pointerEvents: "auto",
};

const queueButtonStyle: CSSProperties = {
  width: 28,
  height: 24,
  borderRadius: 3,
  border: "1px solid rgb(245 230 200 / calc(0.28 * var(--panel-opacity, 1)))",
  background: "rgb(12 12 12 / var(--panel-opacity, 1))",
  color: "#f6f0de",
  fontFamily: "var(--font-geist-mono), monospace",
  fontSize: 10,
  fontWeight: 800,
  cursor: "pointer",
};
