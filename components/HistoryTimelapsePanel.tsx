"use client";

import { useMemo } from "react";
import { type CanalBoat } from "@/lib/canal";

type HistoryTimelapsePanelProps = {
  currentTime: number;
  isPlaying: boolean;
  speed: number; // simulated ms per real sec
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  boats: CanalBoat[];
  onCurrentTimeChange: (time: number) => void;
  onIsPlayingChange: (playing: boolean) => void;
  onSpeedChange: (speed: number) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onExit: () => void;
};

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
  onCurrentTimeChange,
  onIsPlayingChange,
  onSpeedChange,
  onStartDateChange,
  onEndDateChange,
  onExit,
}: HistoryTimelapsePanelProps) {
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
      .slice(-5)
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

  return (
    <div
      className="history-timelapse-panel"
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        width: "calc(100% - 32px)",
        maxWidth: 360,
        maxHeight: "calc(100vh - 32px)",
        display: "flex",
        flexDirection: "column",
        background:
          "linear-gradient(180deg, rgba(28,20,38,0.92) 0%, rgba(15,10,22,0.96) 100%)",
        color: "var(--willville-paper, #f5e6c8)",
        borderRadius: 12,
        border: "1px solid rgba(230,198,106,0.35)",
        boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        padding: "16px 18px",
        fontFamily: "var(--font-sans), sans-serif",
        zIndex: 2500,
        overflowY: "auto",
        pointerEvents: "auto",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            margin: 0,
            letterSpacing: 0.5,
            color: "rgb(230,198,106)",
          }}
        >
          Time Central Station
        </h2>
        <button
          onClick={onExit}
          style={{
            background: "rgba(220,80,80,0.15)",
            border: "1px solid rgba(220,80,80,0.4)",
            borderRadius: 6,
            color: "#ff8b8b",
            padding: "4px 10px",
            fontSize: 12,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(220,80,80,0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(220,80,80,0.15)";
          }}
        >
          Exit Time Lapse
        </button>
      </div>

      {/* Clock Display */}
      <div
        style={{
          background: "rgba(0, 0, 0, 0.4)",
          borderRadius: 8,
          padding: "12px 14px",
          textAlign: "center",
          border: "1px solid rgba(255, 255, 255, 0.05)",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 1.5,
            opacity: 0.5,
            marginBottom: 4,
          }}
        >
          Simulated Timeline
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 16,
            fontWeight: "bold",
            color: "rgb(255, 215, 0)",
            letterSpacing: 0.5,
          }}
        >
          {formattedDate}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => onIsPlayingChange(!isPlaying)}
          style={{
            flex: 1,
            background: isPlaying
              ? "rgba(230,198,106,0.15)"
              : "rgba(100,200,100,0.15)",
            border: isPlaying
              ? "1px solid rgba(230,198,106,0.4)"
              : "1px solid rgba(100,200,100,0.4)",
            borderRadius: 8,
            color: isPlaying ? "rgb(230,198,106)" : "rgb(100,200,100)",
            padding: "10px",
            fontSize: 14,
            fontWeight: "bold",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = isPlaying
              ? "rgba(230,198,106,0.25)"
              : "rgba(100,200,100,0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = isPlaying
              ? "rgba(230,198,106,0.15)"
              : "rgba(100,200,100,0.15)";
          }}
        >
          {isPlaying ? "⏸ Pause" : "▶ Play Time"}
        </button>
        <button
          onClick={handleReset}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8,
            color: "var(--willville-paper)",
            padding: "10px 14px",
            fontSize: 14,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          }}
        >
          🔄 Reset
        </button>
      </div>

      {/* Range Scrubbing Slider */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            opacity: 0.6,
            marginBottom: 6,
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
            accentColor: "rgb(230,198,106)",
            background: "rgba(255,255,255,0.1)",
            height: 6,
            borderRadius: 3,
            outline: "none",
            cursor: "pointer",
          }}
        />
      </div>

      {/* Date Pickers */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <label
            style={{
              display: "block",
              fontSize: 11,
              opacity: 0.5,
              marginBottom: 4,
            }}
          >
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              if (e.target.value) {
                onStartDateChange(e.target.value);
                const nextStartMs = Date.parse(e.target.value);
                if (currentTime < nextStartMs) {
                  onCurrentTimeChange(nextStartMs);
                }
              }
            }}
            style={{
              width: "100%",
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              color: "var(--willville-paper)",
              padding: "6px",
              fontSize: 12,
              outline: "none",
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label
            style={{
              display: "block",
              fontSize: 11,
              opacity: 0.5,
              marginBottom: 4,
            }}
          >
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              if (e.target.value) {
                onEndDateChange(e.target.value);
                const nextEndMs = Date.parse(e.target.value);
                if (currentTime > nextEndMs) {
                  onCurrentTimeChange(nextEndMs);
                }
              }
            }}
            style={{
              width: "100%",
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              color: "var(--willville-paper)",
              padding: "6px",
              fontSize: 12,
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Playback Speed presets */}
      <div style={{ marginBottom: 20 }}>
        <label
          style={{
            display: "block",
            fontSize: 11,
            opacity: 0.5,
            marginBottom: 6,
          }}
        >
          Playback Speed
        </label>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {SPEED_PRESETS.map((preset) => {
            const isSelected = speed === preset.value;
            return (
              <button
                key={preset.label}
                onClick={() => onSpeedChange(preset.value)}
                style={{
                  flex: 1,
                  background: isSelected
                    ? "rgba(230,198,106,0.2)"
                    : "rgba(255,255,255,0.05)",
                  border: isSelected
                    ? "1px solid rgba(230,198,106,0.5)"
                    : "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 6,
                  color: isSelected
                    ? "rgb(230,198,106)"
                    : "var(--willville-paper)",
                  padding: "6px 2px",
                  fontSize: 11,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Event Log */}
      <div>
        <label
          style={{
            display: "block",
            fontSize: 11,
            opacity: 0.5,
            marginBottom: 8,
          }}
        >
          Activity Log ({visibleEvents.length} events active)
        </label>
        <div
          style={{
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 8,
            padding: "10px",
            minHeight: 100,
            maxHeight: 160,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {visibleEvents.length === 0 ? (
            <div
              style={{
                fontSize: 12,
                opacity: 0.4,
                fontStyle: "italic",
                textAlign: "center",
                marginTop: 30,
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
                  opacity: i === 0 ? 1 : 0.6,
                  borderLeft: `2px solid ${
                    e.type === "merge"
                      ? "rgb(100,200,100)"
                      : e.type === "scuttle"
                        ? "var(--willville-hell, #ff6b6b)"
                        : "rgb(230,198,106)"
                  }`,
                  paddingLeft: 8,
                  transition: "opacity 0.2s",
                }}
              >
                {e.text}
                <div style={{ fontSize: 9, opacity: 0.5, marginTop: 2 }}>
                  {new Date(e.time).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
