"use client";

import { useMemo, useRef, useState } from "react";
import { type CanalBoat } from "@/lib/canal";

type HistoryTimelapsePanelProps = {
  currentTime: number;
  isPlaying: boolean;
  speed: number; // simulated ms per real sec
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  boats: CanalBoat[];
  mobileSafeMode?: boolean;
  onCurrentTimeChange: (time: number) => void;
  onIsPlayingChange: (playing: boolean) => void;
  onSpeedChange: (speed: number) => void;
  onExit: () => void;
};

const MIN_BOARD_OPACITY = 0.3;

// Preset speeds: labels and simulated ms per real-time second
const SPEED_PRESETS = [
  { label: "1h/s", value: 3600 * 1000 },
  { label: "1d/s", value: 24 * 3600 * 1000 },
  { label: "3d/s", value: 3 * 24 * 3600 * 1000 },
  { label: "7d/s", value: 7 * 24 * 3600 * 1000 },
  { label: "30d/s", value: 30 * 24 * 3600 * 1000 },
];

export function HistoryTimelapsePanel({
  currentTime,
  isPlaying,
  speed,
  startDate,
  endDate,
  boats,
  mobileSafeMode = false,
  onCurrentTimeChange,
  onIsPlayingChange,
  onSpeedChange,
  onExit,
}: HistoryTimelapsePanelProps) {
  // Inner-surface transparency (see the map behind it) — slider in the header.
  // Only the inner surface fades; the wood frame stays opaque. Default 75%.
  const [boardOpacity, setBoardOpacity] = useState(0.75);

  // Drag-to-move via the header grip. Applied imperatively to panelRef so a
  // drag doesn't re-render the whole board each frame; React never owns the
  // `transform`, so the opacity re-render below can't clobber the drag offset.
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
    x: 0,
    y: 0,
  });

  const onGripPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const d = dragRef.current;
    d.active = true;
    d.startX = e.clientX;
    d.startY = e.clientY;
    d.baseX = d.x;
    d.baseY = d.y;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onGripPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d.active) return;
    e.stopPropagation();
    d.x = d.baseX + (e.clientX - d.startX);
    d.y = d.baseY + (e.clientY - d.startY);
    if (panelRef.current) {
      panelRef.current.style.transform = `translate(${d.x}px, ${d.y}px)`;
    }
  };
  const onGripPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current.active = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const startMs = useMemo(
    () => (startDate ? Date.parse(startDate) : 0),
    [startDate],
  );
  const endMs = useMemo(() => (endDate ? Date.parse(endDate) : 0), [endDate]);

  // Compile timeline events from boats
  const events = useMemo(() => {
    const list: Array<{
      time: number;
      type: "open" | "merge" | "scuttle";
      text: string;
    }> = [];
    for (const b of boats) {
      const cTime = Date.parse(b.createdAt);
      const uTime = Date.parse(b.updatedAt);
      const repoName = b.repo.split("/")[1] ?? b.repo;

      if (!isNaN(cTime)) {
        list.push({
          time: cTime,
          type: "open",
          text: `⛵ PR #${b.prNumber} opened by @${b.author} in ${repoName}`,
        });
      }

      if (!isNaN(uTime)) {
        if (b.lock === "open-sea") {
          list.push({
            time: uTime,
            type: "merge",
            text: `✅ PR #${b.prNumber} merged and sent out to sea`,
          });
        } else if (b.lock === "scuttle") {
          list.push({
            time: uTime,
            type: "scuttle",
            text: `🥀 PR #${b.prNumber} scuttled/closed without merge`,
          });
        }
      }
    }
    return list.sort((a, b) => a.time - b.time);
  }, [boats]);

  // Filter events up to current playback time
  const visibleEvents = useMemo(() => {
    return events
      .filter((e) => e.time <= currentTime)
      .slice(-8)
      .reverse();
  }, [events, currentTime]);

  const formattedDate = useMemo(() => {
    if (!currentTime || isNaN(currentTime)) return "---";
    const dateObj = new Date(currentTime);
    return dateObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [currentTime]);

  const handleReset = () => {
    onCurrentTimeChange(startMs);
    onIsPlayingChange(false);
  };

  // Speed lives on the play button now: a chip shows the current preset and
  // cycles to the next on tap (wrapping around). Falls back to the first preset
  // if the current speed isn't one of the presets.
  const speedIndex = SPEED_PRESETS.findIndex((p) => p.value === speed);
  const currentSpeedLabel =
    SPEED_PRESETS[speedIndex >= 0 ? speedIndex : 1].label;
  const cycleSpeed = () => {
    const next = SPEED_PRESETS[(speedIndex + 1) % SPEED_PRESETS.length];
    onSpeedChange(next.value);
  };

  const cardStyle: React.CSSProperties = {
    position: "relative",
    background: "linear-gradient(135deg, #fdfbf7 0%, #f5eedc 100%)",
    border: "1px solid #d2c5b0",
    borderRadius: 4,
    padding: "16px 14px 14px",
    color: "#3e2723",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
    marginBottom: 16,
  };

  const renderPin = (color: "red" | "blue" | "brass") => {
    const pinGrad =
      color === "red"
        ? "radial-gradient(circle at 35% 35%, #ff8787 0%, #e03131 80%, #c92a2a 100%)"
        : color === "blue"
          ? "radial-gradient(circle at 35% 35%, #74c0fc 0%, #1c7ed6 80%, #1971c2 100%)"
          : "radial-gradient(circle at 35% 35%, #ffd43b 0%, #f59f00 80%, #d9480f 100%)";
    return (
      <div
        style={{
          position: "absolute",
          top: -7,
          left: "50%",
          transform: "translateX(-50%)",
          width: 11,
          height: 11,
          borderRadius: "50%",
          background: pinGrad,
          boxShadow:
            "0 2px 3px rgba(0, 0, 0, 0.4), inset -1px -1px 2px rgba(0,0,0,0.3)",
          pointerEvents: "none",
          zIndex: 10,
        }}
      />
    );
  };

  return (
    <div
      ref={panelRef}
      className="history-timelapse-panel"
      data-town-control
      style={{
        position: "absolute",
        bottom: 16,
        right: 16,
        width: "calc(100% - 32px)",
        maxWidth: mobileSafeMode ? 300 : 370,
        maxHeight: mobileSafeMode ? "min(440px, 60dvh)" : "calc(100vh - 48px)",
        display: "flex",
        flexDirection: "column",
        // Opaque wood frame — only the inner surface (below) fades, so the board
        // always reads as a solid framed board sitting over the map.
        border: "10px solid #5a3821",
        outline: "1px solid #331d0e",
        boxShadow: "0 16px 32px rgba(0,0,0,0.6)",
        borderRadius: 12,
        fontFamily: "var(--font-sans), sans-serif",
        zIndex: 2500,
        overflow: "hidden",
        pointerEvents: "auto",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Inner surface — this is the only part that goes transparent. */}
      <div
        style={{
          opacity: boardOpacity,
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #cc9a6a 0%, #b27f4f 50%, #996738 100%)", // Cork board base
          boxShadow: "inset 0 4px 12px rgba(0,0,0,0.6)",
          padding: mobileSafeMode ? "12px 14px" : "16px 18px",
        }}
      >
        {/* Header — also the drag handle (grab the title bar to move the board). */}
        <div
          onPointerDown={onGripPointerDown}
          onPointerMove={onGripPointerMove}
          onPointerUp={onGripPointerUp}
          onPointerCancel={onGripPointerUp}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 16,
            borderBottom: "2px solid rgba(90, 56, 33, 0.2)",
            paddingBottom: 8,
            cursor: "grab",
            touchAction: "none",
          }}
        >
          <h2
            style={{
              // Full title on its own row so it's never clipped.
              fontSize: mobileSafeMode ? 15 : 17,
              fontWeight: 800,
              margin: 0,
              letterSpacing: 0.5,
              color: "#3c210f",
              textShadow: "0 1px 0 rgba(255, 255, 255, 0.45)",
              fontFamily: "Georgia, serif",
            }}
          >
            Harbormaster&apos;s Recordkeeping
          </h2>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 8,
            }}
          >
            {/* Transparency slider — stop propagation so adjusting it doesn't drag */}
            <input
              type="range"
              min={Math.round(MIN_BOARD_OPACITY * 100)}
              max={100}
              step={1}
              value={Math.round(boardOpacity * 100)}
              aria-label="Recordkeeping board opacity"
              title="Board transparency"
              onPointerDown={(e) => e.stopPropagation()}
              onChange={(e) => setBoardOpacity(Number(e.target.value) / 100)}
              style={{ width: mobileSafeMode ? 56 : 72, cursor: "pointer" }}
            />
            <button
              onClick={onExit}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                background: "#d32f2f",
                border: "1px solid #b71c1c",
                borderRadius: 6,
                color: "#ffffff",
                padding: "5px 11px",
                fontSize: 11,
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#b71c1c";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#d32f2f";
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Card 1: Clock Display (Historical Timeline) */}
        <div style={cardStyle}>
          {renderPin("red")}
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              color: "#795548",
              textAlign: "center",
              fontWeight: "bold",
              marginBottom: 4,
            }}
          >
            Historical Timeline
          </div>
          <div
            style={{
              fontFamily: "Georgia, monospace",
              fontSize: 15,
              fontWeight: "bold",
              color: "#3e2723",
              textAlign: "center",
              letterSpacing: 0.5,
            }}
          >
            {formattedDate}
          </div>
        </div>

        {/* Card 2: Controls & Date Selection */}
        <div style={cardStyle}>
          {renderPin("blue")}

          {/* Play (with speed chip) & Reset buttons */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {/* Play/pause + speed chip share one rounded frame so the speed reads
              as "on" the play button. Two tap zones: left toggles play, the
              right chip cycles speed. */}
            <div
              style={{
                flex: 1,
                display: "flex",
                borderRadius: 6,
                overflow: "hidden",
                border: "1px solid #331d0e", // dark brown, matches the wood frame
                boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
              }}
            >
              <button
                onClick={() => onIsPlayingChange(!isPlaying)}
                style={{
                  flex: 1,
                  // Dark brown to match the wood frame; the playing state is a
                  // slightly warmer brown so there's still a clear toggle cue.
                  background: isPlaying ? "#8a5a2b" : "#5a3821",
                  border: "none",
                  color: "#ffffff",
                  padding: "8px",
                  fontSize: 13,
                  fontWeight: "bold",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isPlaying
                    ? "#6f4720"
                    : "#41280f";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isPlaying
                    ? "#8a5a2b"
                    : "#5a3821";
                }}
              >
                {isPlaying ? "⏸ Pause" : "▶ Play"}
              </button>
              <button
                onClick={cycleSpeed}
                aria-label={`Playback speed ${currentSpeedLabel}, tap to change`}
                title="Tap to change playback speed"
                style={{
                  background: "rgba(0,0,0,0.22)",
                  border: "none",
                  borderLeft: "1px solid rgba(255,255,255,0.25)",
                  color: "#ffffff",
                  padding: "8px 10px",
                  fontSize: 12,
                  fontWeight: "bold",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(0,0,0,0.34)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(0,0,0,0.22)";
                }}
              >
                {currentSpeedLabel} ⇅
              </button>
            </div>
            <button
              onClick={handleReset}
              style={{
                background: "#ffffff",
                border: "1px solid #cbc2b0",
                borderRadius: 6,
                color: "#5c4033",
                padding: "8px 12px",
                fontSize: 13,
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f5eedc";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#ffffff";
              }}
            >
              🔄 Reset
            </button>
          </div>

          {/* Slider */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                color: "#795548",
                marginBottom: 4,
              }}
            >
              <span>Start: {startDate}</span>
              <span>End: {endDate}</span>
            </div>
            <input
              type="range"
              min={startMs || 0}
              max={endMs || 100}
              value={isNaN(currentTime) ? 0 : currentTime}
              onChange={(e) => onCurrentTimeChange(Number(e.target.value))}
              style={{
                width: "100%",
                accentColor: "#5a3821",
                background: "rgba(0,0,0,0.08)",
                height: 6,
                borderRadius: 3,
                outline: "none",
                cursor: "pointer",
              }}
            />
          </div>
        </div>

        {/* Card 3: Activity Log */}
        <div style={{ ...cardStyle, marginBottom: 0 }}>
          {renderPin("brass")}
          <label
            style={{
              display: "block",
              fontSize: 10,
              color: "#795548",
              fontWeight: "bold",
              marginBottom: 6,
            }}
          >
            Activity Log ({visibleEvents.length} events active)
          </label>
          <div
            style={{
              background: "rgba(0,0,0,0.04)",
              border: "1px solid #cbc2b0",
              borderRadius: 4,
              padding: "8px",
              minHeight: 120,
              maxHeight: 170,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {visibleEvents.length === 0 ? (
              <div
                style={{
                  fontSize: 11,
                  color: "#795548",
                  opacity: 0.6,
                  fontStyle: "italic",
                  textAlign: "center",
                  marginTop: 40,
                }}
              >
                No events in this period yet.
              </div>
            ) : (
              visibleEvents.map((e, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 11,
                    lineHeight: "1.4",
                    color: "#3e2723",
                    opacity: i === 0 ? 1 : 0.65,
                    borderLeft: `3px solid ${
                      e.type === "merge"
                        ? "#2e7d32" // Darker forest green
                        : e.type === "scuttle"
                          ? "#c62828" // Darker crimson red
                          : "#b68900" // Darker gold/brass
                    }`,
                    paddingLeft: 8,
                    transition: "opacity 0.2s",
                  }}
                >
                  {e.text}
                  <div style={{ fontSize: 9, color: "#795548", marginTop: 2 }}>
                    {new Date(e.time).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
