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

const BOARD_COLUMNS = 28;
const BOARD_ROWS = 6;

function stopLabel(stop: Stop): string {
  return stop.repo?.split("/").pop() ?? stop.id;
}
const EMPTY_ROW = " ".repeat(BOARD_COLUMNS);

type Props = {
  stops: Stop[];
  selectedStop?: Stop | null;
  activeDistrict?: string | null;
  onSelectStop: (stop: Stop) => void;
  announcementRows?: string[] | null;
  announcementLabel?: string;
};

export function CentralBoard({
  stops,
  selectedStop,
  activeDistrict,
  onSelectStop,
  announcementRows,
  announcementLabel,
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
      style={shellStyle}
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
            linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0)),
            #171717;
          border: 1px solid rgba(255,255,255,0.055);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
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
  const normalized = rows.slice(0, BOARD_ROWS);
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
  const chars = padded(row).split("");
  return (
    <div
      style={{
        ...rowStyle,
        gridTemplateColumns: `repeat(${BOARD_COLUMNS}, clamp(15px, 2.25vw, 23px))`,
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

  const rows: string[] = [center(districtName), center(stopName)];

  const wrapped = wrapText(descText, BOARD_COLUMNS);
  for (let i = 0; i < 4; i += 1) {
    const line = wrapped[i] ?? "";
    rows.push(center(line));
  }

  return rows.slice(0, BOARD_ROWS);
}

function districtRows(districtId: string, stops: Stop[]): string[] {
  const district = DISTRICTS.find((d) => d.id === districtId);
  const districtName = district?.displayName ?? districtId;

  const rows: string[] = [center(districtName), center("LOCAL DEPARTURES")];

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

    let rightPart = (stop.status.state || "IDEA").toUpperCase();
    if (stop.stars && stop.stars > 0) {
      rightPart = `${stop.stars}*`;
    } else if (stop.commits7d && stop.commits7d > 0) {
      rightPart = `${stop.commits7d}C`;
    }

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
    rows.push(rowStr);
  }

  return rows.slice(0, BOARD_ROWS);
}

function timetableRows(queue: Stop[]): string[] {
  const rows = [center("TIME CENTRAL STATION"), center("MAYOR'S EXPRESS")];

  const departures = queue.slice(0, 4);
  for (let i = 0; i < 4; i += 1) {
    const stop = departures[i];
    if (!stop) {
      rows.push(EMPTY_ROW);
      continue;
    }
    const commits7d = stop.commits7d;
    const commits3d = stop.commits3d;
    const [commits, period] =
      commits7d != null ? [commits7d, "7D"] : [commits3d ?? 0, "3D"];
    const activity = commits > 0 ? `${commits}C/${period}` : "";
    rows.push(
      fit(`${String(i + 1).padStart(2, "0")} ${stopLabel(stop)} ${activity}`),
    );
  }

  return rows.slice(0, BOARD_ROWS);
}

function padded(input: string): string {
  return fit(input).padEnd(BOARD_COLUMNS, " ");
}

function center(input: string): string {
  const normalized = normalize(input);
  const trimmed =
    normalized.length > BOARD_COLUMNS
      ? `${normalized.slice(0, BOARD_COLUMNS - 1)}…`
      : normalized;
  const left = Math.max(0, Math.floor((BOARD_COLUMNS - trimmed.length) / 2));
  return `${" ".repeat(left)}${trimmed}`.padEnd(BOARD_COLUMNS, " ");
}

function fit(input: string): string {
  const normalized = normalize(input);
  if (normalized.length <= BOARD_COLUMNS) return normalized;
  return `${normalized.slice(0, BOARD_COLUMNS - 1)}…`;
}

function normalize(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "AND")
    .replace(/[^A-Z0-9 .,'#/:!?…-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
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
    const previous = padded(previousRows[rowIndex] ?? "");
    const next = padded(row);
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
  const buffer = makeNoiseBuffer(ctx, duration, (t) => {
    const attack = Math.min(1, t / 0.18);
    const release = Math.min(1, (1 - t) / 0.35);
    const slowWave = 0.58 + Math.sin(t * Math.PI * 6) * 0.18;
    return Math.max(0, Math.min(1, attack, release)) * slowWave;
  });

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
  const buffer = makeNoiseBuffer(ctx, duration, (t) => {
    const attack = Math.min(1, t / 0.08);
    const release = Math.pow(Math.max(0, 1 - t), 2.2);
    const fibers = 0.7 + Math.random() * 0.3;
    return attack * release * fibers;
  });

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

function makeNoiseBuffer(
  ctx: AudioContext,
  duration: number,
  envelope: (progress: number) => number,
) {
  const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const channel = buffer.getChannelData(0);
  let previous = 0;
  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / sampleCount;
    previous = previous * 0.72 + (Math.random() * 2 - 1) * 0.28;
    channel[i] = previous * envelope(t) * 0.62;
  }
  return buffer;
}

const shellStyle: CSSProperties = {
  position: "relative",
  zIndex: 2,
  width: "min(760px, calc(100vw - 16px))",
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
  padding: "8px 16px",
  background: "linear-gradient(180deg, #1a1a1a 0%, #070707 100%)",
  border: "1px solid rgba(245,230,200,0.18)",
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
  gap: 2,
  padding: 6,
  background:
    "linear-gradient(180deg, rgba(15,15,15,0.99) 0%, rgba(3,3,3,0.99) 100%)",
  border: "1px solid rgba(245,230,200,0.18)",
  borderRadius: "0 0 5px 5px",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -18px 40px rgba(0,0,0,0.75)",
};

const rowStyle: CSSProperties = {
  display: "grid",
  gap: 2,
  justifyContent: "center",
};

const cellStyle: CSSProperties = {
  position: "relative",
  aspectRatio: "0.82 / 1",
  minWidth: 0,
  display: "grid",
  placeItems: "center",
  background: "#090909",
  borderRadius: 3,
  boxShadow:
    "inset 0 0 0 1px rgba(255,255,255,0.04), 0 1px 0 rgba(255,255,255,0.04)",
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
  background: "rgba(0,0,0,0.45)",
  boxShadow: "0 -1px 0 rgba(255,255,255,0.06)",
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
  border: "1px solid rgba(245,230,200,0.28)",
  background: "#0c0c0c",
  color: "#f6f0de",
  fontFamily: "var(--font-geist-mono), monospace",
  fontSize: 10,
  fontWeight: 800,
  cursor: "pointer",
};
