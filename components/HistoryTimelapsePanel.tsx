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
      className="history-timelapse-panel"
      style={{
        position: "absolute",
        bottom: 16,
        right: 16,
        width: "calc(100% - 32px)",
        maxWidth: 370,
        maxHeight: "calc(100vh - 48px)",
        display: "flex",
        flexDirection: "column",
        background:
          "linear-gradient(135deg, #cc9a6a 0%, #b27f4f 50%, #996738 100%)", // Cork board base
        border: "10px solid #5a3821", // Wood frame
        outline: "1px solid #331d0e",
        boxShadow:
          "inset 0 4px 12px rgba(0,0,0,0.6), 0 16px 32px rgba(0,0,0,0.6)",
        borderRadius: 12,
        padding: "16px 18px",
        fontFamily: "var(--font-sans), sans-serif",
        zIndex: 2500,
        overflowY: "auto",
        pointerEvents: "auto",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header (Branded/Burned into wood style) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
          borderBottom: "2px solid rgba(90, 56, 33, 0.2)",
          paddingBottom: 8,
        }}
      >
        <h2
          style={{
            fontSize: 17,
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
        <button
          onClick={onExit}
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

      {/* Card 1: Clock Display (Simulated Timeline) */}
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
          Simulated Timeline
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

        {/* Play & Reset buttons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button
            onClick={() => onIsPlayingChange(!isPlaying)}
            style={{
              flex: 1,
              background: isPlaying ? "#e65100" : "#1b5e20",
              border: isPlaying ? "1px solid #b23c00" : "1px solid #0d3c12",
              borderRadius: 6,
              color: "#ffffff",
              padding: "8px",
              fontSize: 13,
              fontWeight: "bold",
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isPlaying
                ? "#b23c00"
                : "#0d3c12";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isPlaying
                ? "#e65100"
                : "#1b5e20";
            }}
          >
            {isPlaying ? "⏸ Pause" : "▶ Play Time"}
          </button>
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

        {/* Date Inputs */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label
              style={{
                display: "block",
                fontSize: 10,
                color: "#795548",
                marginBottom: 3,
                fontWeight: "bold",
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
                background: "#ffffff",
                border: "1px solid #cbc2b0",
                borderRadius: 4,
                color: "#3e2723",
                padding: "5px 6px",
                fontSize: 11,
                outline: "none",
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label
              style={{
                display: "block",
                fontSize: 10,
                color: "#795548",
                marginBottom: 3,
                fontWeight: "bold",
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
                background: "#ffffff",
                border: "1px solid #cbc2b0",
                borderRadius: 4,
                color: "#3e2723",
                padding: "5px 6px",
                fontSize: 11,
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Speed Selection */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 10,
              color: "#795548",
              marginBottom: 4,
              fontWeight: "bold",
            }}
          >
            Playback Speed
          </label>
          <div style={{ display: "flex", gap: 4 }}>
            {SPEED_PRESETS.map((preset) => {
              const isSelected = speed === preset.value;
              return (
                <button
                  key={preset.label}
                  onClick={() => onSpeedChange(preset.value)}
                  style={{
                    flex: 1,
                    background: isSelected ? "#5a3821" : "rgba(0,0,0,0.04)",
                    border: isSelected
                      ? "1px solid #331d0e"
                      : "1px solid #cbc2b0",
                    borderRadius: 4,
                    color: isSelected ? "#ffffff" : "#5c4033",
                    padding: "5px 2px",
                    fontSize: 10,
                    fontWeight: "bold",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
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
  );
}
